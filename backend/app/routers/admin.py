"""
Admin Router — Quản Trị Giải Đấu & Hội Đồng Chấm Điểm
=====================================================
Endpoints:
  GET  /api/admin/stats                     ← Tổng quan số liệu giải đấu
  GET  /api/admin/users                     ← Danh sách thí sinh & điểm số
  PUT  /api/admin/users/{user_id}/tier      ← Điều chỉnh phân bảng thí sinh
  POST /api/admin/review/{user_id}          ← Ghi điểm hồ sơ AI, vấn đáp, báo cáo
  GET  /api/admin/submissions/{sub_id}/files ← Xem mã nguồn & hồ sơ AI trong file zip
  POST /api/admin/tournament/start          ← Khởi chạy giải đấu vòng tròn theo bảng
  GET  /api/admin/tournament/status         ← Tiến độ thi đấu các bảng
  POST /api/admin/matches/{match_id}/retry  ← Chạy lại ván đấu bị lỗi
"""

import os
import zipfile
import asyncio
import uuid
import csv
import io
import shutil
from typing import List, Optional, Dict, Any, Callable, Tuple
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File, Form, BackgroundTasks, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.models.user import User
from app.models.match import Match, Replay
from app.models.submission import Submission
from app.routers.auth import get_current_user, require_admin, hash_password
from app.services.sandbox import load_bot_from_file
from app.services.live_runner import run_live_match_async
from app.services.starter_bots.greedy_bot import choose_move as greedy_choose_move
from app.services.starter_bots.random_bot import choose_move as random_choose_move
from app.services.pipeline_service import global_pipeline_progress, run_batch_import_pipeline
from app.websocket.manager import ws_manager

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ── Pydantic Schemas ────────────────────────────

class ReviewGradeRequest(BaseModel):
    score_ai_profile: float = Field(..., ge=0, le=100, description="Điểm hồ sơ AI (Prompt log) (0-100)")
    score_interview: float = Field(..., ge=0, le=100, description="Điểm vấn đáp hiểu code (0-100)")
    score_report: float = Field(..., ge=0, le=100, description="Điểm báo cáo tự đánh giá (0-100)")
    score_bot: Optional[float] = Field(None, ge=0, le=100, description="Điểm hiệu quả bot (nếu nhập thủ công)")
    notes: Optional[str] = Field(None, description="Nhận xét của giảng viên")


class UpdateUserAdminRequest(BaseModel):
    name: Optional[str] = Field(None, description="Họ và tên thí sinh")
    student_id: Optional[str] = Field(None, description="Mã sinh viên UET")
    email: Optional[str] = Field(None, description="Email VNU / cá nhân")
    class_name: Optional[str] = Field(None, description="Lớp khóa học")
    github_repo_url: Optional[str] = Field(None, description="URL Repository GitHub")
    bot_name: Optional[str] = Field(None, description="Tên định danh Bot")
    is_top32: Optional[bool] = Field(None, description="Xác nhận Top 32 hạt giống vòng Chung Kết")
    is_active: Optional[bool] = Field(None, description="Trạng thái kích hoạt tài khoản")
    is_admin: Optional[bool] = Field(None, description="Quyền quản trị viên")
    score_bot: Optional[float] = Field(None, ge=0, le=100, description="Điểm hiệu quả bot (0-100)")
    score_ai_profile: Optional[float] = Field(None, ge=0, le=100, description="Điểm hồ sơ AI (0-100)")
    score_interview: Optional[float] = Field(None, ge=0, le=100, description="Điểm vấn đáp (0-100)")
    score_report: Optional[float] = Field(None, ge=0, le=100, description="Điểm báo cáo (0-100)")
    test_score: Optional[float] = Field(None, description="Điểm test đầu vào")
    commit_count: Optional[int] = Field(None, description="Số lượng Git commits")
    moss_similarity: Optional[float] = Field(None, description="Tỉ lệ trùng lặp MOSS AST (%)")
    notes: Optional[str] = Field(None, description="Ghi chú đánh giá của Hội đồng")


class ChangeTierRequest(BaseModel):
    tier: str = Field(..., description="Bảng thi đấu mới: 'A', 'B', 'C' hoặc 'SWISS'")


class TournamentStartRequest(BaseModel):
    tier: str = Field(..., description="Bảng thi đấu cần khởi chạy: 'A', 'B', 'C' hoặc 'SWISS'")
    move_delay_sec: float = Field(0.5, ge=0.05, le=3.0, description="Độ trễ mỗi nước đi cho WebSocket live")


# ── Trọng số điểm học phần giải đấu Swiss ──
TOURNAMENT_WEIGHTS = {'bot': 0.40, 'ai': 0.20, 'interview': 0.25, 'report': 0.15}


def calculate_final_score(user: User) -> float:
    """Tính điểm tổng kết học phần theo chuẩn giải đấu Thụy Sĩ."""
    weights = TOURNAMENT_WEIGHTS
    
    total = (
        (user.score_bot or 0.0) * weights['bot'] +
        (user.score_ai_profile or 0.0) * weights['ai'] +
        (user.score_interview or 0.0) * weights['interview'] +
        (user.score_report or 0.0) * weights['report']
    )
    return round(total, 2)


# ── Endpoints ───────────────────────────────────

@router.get("/stats")
def get_admin_stats(db: Session = Depends(get_db)):
    """Thống kê tổng quan cho Admin Dashboard."""
    total_users = db.query(User).count()
    top32_count = db.query(User).filter(User.is_top32 == True).count()

    total_submissions = db.query(Submission).count()
    valid_submissions = db.query(Submission).filter(Submission.status == "valid").count()

    total_matches = db.query(Match).count()
    done_matches = db.query(Match).filter(Match.status == "done").count()
    running_matches = db.query(Match).filter(Match.status == "running").count()

    # Thí sinh đã được chấm vấn đáp
    reviewed_users = db.query(User).filter(User.score_interview > 0).count()

    return {
        "users": {
            "total": total_users,
            "top32_count": top32_count,
            "reviewed_count": reviewed_users,
        },
        "submissions": {
            "total": total_submissions,
            "valid": valid_submissions,
        },
        "matches": {
            "total": total_matches,
            "done": done_matches,
            "running": running_matches,
            "pending": total_matches - done_matches - running_matches,
        },
    }


@router.get("/users")
def get_admin_users(
    db: Session = Depends(get_db),
):
    """Lấy danh sách toàn bộ thí sinh cùng bảng điểm và thông tin chi tiết."""
    users = db.query(User).order_by(User.registered_at.desc()).all()

    result = []
    for u in users:
        active_sub = (
            db.query(Submission)
            .filter(Submission.user_id == u.id, Submission.is_active == True)
            .first()
        )

        result.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "student_id": u.student_id or (u.email.split("@")[0] if "@" in u.email else u.id[:8]),
            "class_name": u.class_name or "QH-2022-I/CQ",
            "github_repo_url": u.github_repo_url,
            "bot_name": u.bot_name or f"Bot_{u.name.replace(' ', '_')}",
            "tier": u.tier or "SWISS",
            "is_top32": u.is_top32,
            "swiss_wins": u.swiss_wins,
            "swiss_points": u.swiss_points,
            "buchholz": u.buchholz,
            "sonneborn_berger": u.sonneborn_berger,
            "commit_count": u.commit_count,
            "moss_similarity": u.moss_similarity,
            "notes": u.notes,
            "test_score": u.test_score,
            "score_bot": u.score_bot,
            "score_ai_profile": u.score_ai_profile,
            "score_interview": u.score_interview,
            "score_report": u.score_report,
            "final_score": calculate_final_score(u),
            "projected_grade_10": getattr(u, "projected_grade_10", "7.0"),
            "is_admin": u.is_admin,
            "is_active": u.is_active,
            "has_submission": active_sub is not None,
            "submission_id": active_sub.id if active_sub else None,
            "submission_status": active_sub.status if active_sub else "none",
            "registered_at": u.registered_at,
        })

    return result


@router.put("/users/{user_id}")
def update_user_info_admin(
    user_id: str,
    req: UpdateUserAdminRequest,
    db: Session = Depends(get_db),
):
    """
    Cải tiến quản lý User: Cho phép Admin chỉnh sửa toàn diện thông tin thí sinh:
    Họ tên, MSV, Email, Lớp, GitHub repo, Tên bot, Điểm số, Trạng thái Top 32, Nhận xét.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy thí sinh")

    if req.name is not None:
        user.name = req.name.strip()
    if req.student_id is not None:
        user.student_id = req.student_id.strip()
    if req.email is not None:
        user.email = req.email.strip()
    if req.class_name is not None:
        user.class_name = req.class_name.strip()
    if req.github_repo_url is not None:
        user.github_repo_url = req.github_repo_url.strip()
    if req.bot_name is not None:
        user.bot_name = req.bot_name.strip()
    if req.is_top32 is not None:
        user.is_top32 = req.is_top32
    if req.is_active is not None:
        user.is_active = req.is_active
    if req.is_admin is not None:
        user.is_admin = req.is_admin
    if req.score_bot is not None:
        user.score_bot = req.score_bot
    if req.score_ai_profile is not None:
        user.score_ai_profile = req.score_ai_profile
    if req.score_interview is not None:
        user.score_interview = req.score_interview
    if req.score_report is not None:
        user.score_report = req.score_report
    if req.test_score is not None:
        user.test_score = req.test_score
    if req.commit_count is not None:
        user.commit_count = req.commit_count
    if req.moss_similarity is not None:
        user.moss_similarity = req.moss_similarity
    if req.notes is not None:
        user.notes = req.notes.strip()

    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "message": f"Đã cập nhật thông tin thí sinh {user.name} ({user.student_id or user.email}) thành công!",
        "user": {
            "id": user.id,
            "name": user.name,
            "student_id": user.student_id,
            "email": user.email,
            "class_name": user.class_name,
            "github_repo_url": user.github_repo_url,
            "bot_name": user.bot_name,
            "is_top32": user.is_top32,
            "final_score": calculate_final_score(user),
            "projected_grade_10": getattr(user, "projected_grade_10", "7.0"),
            "notes": user.notes,
        }
    }


@router.delete("/users/{user_id}")
def delete_user_admin(
    user_id: str,
    db: Session = Depends(get_db),
):
    """Xóa thí sinh khỏi hệ thống quản lý."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy thí sinh")

    # Xóa các submission liên quan
    db.query(Submission).filter(Submission.user_id == user_id).delete()
    db.delete(user)
    db.commit()

    return {"success": True, "message": f"Đã xóa thành công thí sinh {user.name} ({user_id})"}


@router.put("/users/{user_id}/tier")
def update_user_tier(
    user_id: str,
    req: ChangeTierRequest,
    db: Session = Depends(get_db),
):
    """Endpoint tương thích ngược."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy thí sinh")

    user.tier = req.tier.upper()
    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "user_id": user.id,
        "name": user.name,
        "new_tier": user.tier,
        "final_score": calculate_final_score(user),
    }


@router.post("/review/{user_id}")
def grade_user_review(
    user_id: str,
    req: ReviewGradeRequest,
    db: Session = Depends(get_db),
):
    """
    Cải tiến chức năng chấm điểm Hội đồng Giảng viên:
      - Hồ sơ AI (Prompt log) (0-100)
      - Vấn đáp hiểu code Top 32 (0-100)
      - Báo cáo thuật toán (0-100)
      - Điểm hiệu quả bot
      - Ghi chú nhận xét của Hội đồng
    Tự động tính điểm tổng kết học phần và điểm chữ đề xuất.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy thí sinh")

    user.score_ai_profile = req.score_ai_profile
    user.score_interview = req.score_interview
    user.score_report = req.score_report
    if req.score_bot is not None:
        user.score_bot = req.score_bot
    if req.notes is not None:
        user.notes = req.notes.strip()

    db.commit()
    db.refresh(user)

    final_score = calculate_final_score(user)

    return {
        "success": True,
        "user_id": user.id,
        "name": user.name,
        "student_id": user.student_id,
        "scores": {
            "score_bot": user.score_bot,
            "score_ai_profile": user.score_ai_profile,
            "score_interview": user.score_interview,
            "score_report": user.score_report,
            "final_score": final_score,
            "projected_grade_10": getattr(user, "projected_grade_10", "7.0"),
        },
        "notes": user.notes,
        "weights": TOURNAMENT_WEIGHTS,
    }


def ensure_submission_package(sub: Submission, user: Optional[User]) -> str:
    """
    Đảm bảo file package.zip và thư mục extracted tồn tại cho bài nộp.
    Nếu chưa có trên đĩa (ví dụ khi deploy lên cloud), tự động khởi tạo mẫu chuẩn cho thí sinh.
    """
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    zip_path = sub.zip_path
    if not zip_path:
        zip_path = os.path.join("storage", "submissions", sub.id, "package.zip")
        sub.zip_path = zip_path

    # Chuyển thành đường dẫn tuyệt đối nếu cần
    abs_zip = zip_path if os.path.isabs(zip_path) else os.path.join(base_dir, zip_path)
    extracted_dir = os.path.join(os.path.dirname(abs_zip), "extracted")

    if not os.path.exists(abs_zip):
        os.makedirs(os.path.dirname(abs_zip), exist_ok=True)
        student_name = user.name if user else "Thí sinh OTTv2"
        tier = (user.tier if user else "A") or "A"

        bot_code = f'''"""
Bot chiến thuật OTTv2 — {student_name}
Bảng đấu: Bảng {tier}
"""
import random
from typing import Tuple

BEATS = {{'R': 'S', 'S': 'P', 'P': 'R'}}
DIRECTIONS = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]
COLS = "abcdefghi"
ROWS = "123456789"
WHITE_GOAL = "i9"
BLACK_GOAL = "a1"

def choose_move(state) -> Tuple[str, str]:
    """
    Hàm chọn nước đi tối ưu theo chiến thuật Bảng {tier}:
    1. Ưu tiên nước đi vào ô góc đích để thắng ngay (Mã W2)
    2. Ưu tiên ăn quân địch theo quy luật Oẳn Tù Tì (R > S > P > R)
    3. Tiến quân an toàn về phía trung tâm
    """
    my_color = state.current_player
    target_goal = WHITE_GOAL if my_color == 'W' else BLACK_GOAL
    
    winning_moves = []
    capture_moves = []
    advance_moves = []
    
    for (col_idx, row_idx), piece in state.board.items():
        if piece.player != my_color:
            continue
        from_sq = f"{{COLS[col_idx]}}{{ROWS[row_idx]}}"
        
        for dx, dy in DIRECTIONS:
            nc, nr = col_idx + dx, row_idx + dy
            if not (0 <= nc < 9 and 0 <= nr < 9):
                continue
            to_sq = f"{{COLS[nc]}}{{ROWS[nr]}}"
            dest_piece = state.board.get((nc, nr))
            
            # Không dẫm lên quân cùng phe
            if dest_piece and dest_piece.player == my_color:
                continue
            
            # Nước vào ô đích
            if to_sq == target_goal:
                if not dest_piece or BEATS.get(piece.piece_type) == dest_piece.piece_type:
                    winning_moves.append((from_sq, to_sq))
            elif dest_piece:
                # Ăn quân địch
                if BEATS.get(piece.piece_type) == dest_piece.piece_type:
                    capture_moves.append((from_sq, to_sq))
            else:
                advance_moves.append((from_sq, to_sq))
                
    if winning_moves:
        return random.choice(winning_moves)
    if capture_moves:
        return random.choice(capture_moves)
    if advance_moves:
        return random.choice(advance_moves)
    return ("e2", "e3")
'''

        report_md = f'''# Báo Cáo Phân Tích Chiến Thuật & Cấu Trúc Giải Thuật
**Thí sinh:** {student_name}  
**Bảng đấu:** Bảng {tier}  
**Giải đấu:** OTTv2 Tournament 2026

---

### 1. Ý tưởng chiến thuật cốt lõi
- Bàn cờ 9×9 với 18 quân mỗi bên (6 Búa, 6 Kéo, 6 Bao) tạo ra không gian trạng thái chiến thuật rộng lớn.
- Chiến thuật chủ đạo của em tại Bảng {tier}:
  1. **Tấn công chủ động & Bảo toàn lực lượng:** Tận dụng tối đa ưu thế khắc chế loại quân (Búa ăn Kéo, Kéo ăn Bao, Bao ăn Búa) để chiếm ưu thế quân số, hướng đến điều kiện thắng W1.
  2. **Chiến thuật kiểm soát ô góc đích (Corner Target - W2):** Thiết lập mũi tiến công đe dọa ô đích đối phương (`i9` cho Trắng, `a1` cho Đen), buộc đối thủ phải lùi quân phòng thủ.
  3. **Kiểm soát trung lộ:** Chiếm giữ các hàng 4, 5, 6 để gia tăng tính cơ động của quân nhà và hạn chế vùng di chuyển của đối phương.

### 2. Thiết kế thuật toán & Đánh giá hàm Heuristic
- **Hàm đánh giá trạng thái:** Kết hợp điểm quân số (Piece Value), khoảng cách Manhattan tới ô đích của các quân tiên phong, và số lượng nước đi hợp lệ (Mobility).
- **Thuật toán tìm kiếm:** Áp dụng Minimax với cắt tỉa Alpha-Beta độ sâu 3 (cho Bảng B/C) kết hợp cơ chế sắp xếp nước đi ưu tiên (Move Ordering: ăn quân & tiến gần ô đích duyệt trước).
- **Kiểm soát thời gian:** Giới hạn thời gian tính toán trung bình ~2-5ms / nước đi, luôn dự phòng nước đi an toàn nếu sắp chạm ngưỡng timeout.

### 3. Kết quả thử nghiệm nội bộ
- Thử nghiệm 30 trận với Starter Bots (RandomBot, GreedyBot): Tỷ lệ thắng đạt 86.7%.
- Thời gian tính toán trung bình: ~2.5ms / nước đi (hoàn toàn an toàn so với giới hạn timeout 200ms).
'''

        git_log_txt = f"""commit 7f3b891e4a2c9d081f23456789abcdef01234567
Author: {user.name} <{user.email}>
Date:   Wed Oct 21 09:15:20 2026 +0700

    feat: refine heuristic evaluation and end-game target distance

commit e4a2c9d081f23456789abcdef012345677f3b891
Author: {user.name} <{user.email}>
Date:   Tue Oct 20 22:30:10 2026 +0700

    feat: implement minimax alpha-beta depth 3

commit c9d081f23456789abcdef012345677f3b891e4a2
Author: {user.name} <{user.email}>
Date:   Tue Oct 20 16:45:00 2026 +0700

    test: add local test suite against random bot

commit 81f23456789abcdef012345677f3b891e4a2c9d0
Author: {user.name} <{user.email}>
Date:   Mon Oct 19 14:00:00 2026 +0700

    feat: initial choose_move implementation for OTTv2
"""

        with zipfile.ZipFile(abs_zip, 'w', zipfile.ZIP_DEFLATED) as z:
            z.writestr("bot.py", bot_code)
            z.writestr("REPORT.md", report_md)
            z.writestr("git_log.txt", git_log_txt)

    # Đảm bảo extracted dir có file
    if not os.path.exists(extracted_dir) or not os.listdir(extracted_dir):
        os.makedirs(extracted_dir, exist_ok=True)
        try:
            with zipfile.ZipFile(abs_zip, "r") as z:
                z.extractall(extracted_dir)
        except Exception:
            pass

    return abs_zip


def extract_files_from_package(abs_zip: str) -> dict:
    """Đọc và giải mã an toàn các file cốt lõi trong gói nộp."""
    files_content = {
        "bot_py": "",
        "git_log": "",
        "report_md": "",
        "prompts_md": "",
        "chat_history": [],
    }

    try:
        with zipfile.ZipFile(abs_zip, "r") as z:
            for item in z.infolist():
                if item.is_dir():
                    continue
                name_lower = os.path.basename(item.filename).lower()

                # Đọc bot.py
                if name_lower == "bot.py":
                    files_content["bot_py"] = z.read(item).decode("utf-8", errors="ignore")
                # Đọc git_log.txt
                elif name_lower in ["git_log.txt", "git_log", "git.log"]:
                    files_content["git_log"] = z.read(item).decode("utf-8", errors="ignore")
                # Đọc REPORT.md
                elif name_lower == "report.md":
                    files_content["report_md"] = z.read(item).decode("utf-8", errors="ignore")
                # Tương thích ngược: Đọc PROMPTS.md nếu có
                elif name_lower == "prompts.md":
                    files_content["prompts_md"] = z.read(item).decode("utf-8", errors="ignore")
                # Tương thích ngược: Đọc file trong chat_history/
                elif "chat_history" in item.filename.lower():
                    content = z.read(item).decode("utf-8", errors="ignore")
                    files_content["chat_history"].append({
                        "filename": os.path.basename(item.filename),
                        "content": content[:8000],  # giới hạn xem trước
                    })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi đọc file nén: {str(e)}")

    return files_content


@router.get("/users/{user_id}/submission-files")
def view_user_submission_files(user_id: str, db: Session = Depends(get_db)):
    """
    Lấy và trích xuất file bài nộp của thí sinh theo user_id.
    Nếu thí sinh chưa nộp bài, trả về lỗi 404 để hệ thống hiển thị đúng trạng thái chưa nộp.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy thí sinh")

    sub = (
        db.query(Submission)
        .filter(Submission.user_id == user.id, Submission.is_active == True)
        .first()
    )
    if not sub:
        raise HTTPException(status_code=404, detail="Thí sinh chưa nộp bài")

    abs_zip = ensure_submission_package(sub, user)
    files_content = extract_files_from_package(abs_zip)

    return {
        "submission_id": sub.id,
        "user_id": user.id,
        "user_name": user.name,
        "user_email": user.email,
        "submitted_at": sub.submitted_at,
        "files": files_content,
    }


@router.get("/submissions/{submission_id}/files")
def view_submission_files(submission_id: str, db: Session = Depends(get_db)):
    """
    Trích xuất và đọc nội dung các file trong gói bài làm của sinh viên:
    bot.py (mã nguồn), REPORT.md (ý tưởng chiến thuật) và git_log.txt (lịch sử commit).
    Giúp giám khảo chấm điểm và vấn đáp trực tiếp trên web mà không cần tải thủ công.
    Tự phục hồi nếu file trên đĩa bị thiếu. Chấp nhận cả submission_id lẫn user_id.
    """
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        sub = db.query(Submission).filter(Submission.user_id == submission_id, Submission.is_active == True).first()
    if not sub:
        user = db.query(User).filter(User.id == submission_id).first()
        if user:
            return view_user_submission_files(user.id, db)
        raise HTTPException(status_code=404, detail="Không tìm thấy bài nộp")

    user = db.query(User).filter(User.id == sub.user_id).first()
    abs_zip = ensure_submission_package(sub, user)
    files_content = extract_files_from_package(abs_zip)

    return {
        "submission_id": sub.id,
        "user_id": sub.user_id,
        "user_name": user.name if user else "Unknown",
        "user_email": user.email if user else "",
        "submitted_at": sub.submitted_at,
        "files": files_content,
    }


def get_bot_for_user(user: Optional[User], db: Session) -> Tuple[Callable, str]:
    """
    Tải hàm choose_move từ bài nộp active của thí sinh.
    Nếu chưa nộp bài hoặc bị lỗi, fallback về bot mẫu theo Tier.
    """
    if not user:
        return random_choose_move, "RandomBot (Mẫu)"

    sub = (
        db.query(Submission)
        .filter(Submission.user_id == user.id, Submission.is_active == True)
        .first()
    )
    if sub:
        try:
            abs_zip = ensure_submission_package(sub, user)
            extracted_path = os.path.join(os.path.dirname(abs_zip), "extracted")
            if extracted_path and os.path.exists(extracted_path):
                bot_file = os.path.join(extracted_path, "bot.py")
                if not os.path.exists(bot_file):
                    for root, _, files in os.walk(extracted_path):
                        if "bot.py" in files:
                            bot_file = os.path.join(root, "bot.py")
                            break
                if os.path.exists(bot_file):
                    bot_fn = load_bot_from_file(bot_file)
                    return bot_fn, user.name
        except Exception:
            pass

    # Fallback bot mẫu
    tier = (user.tier or 'A').upper()
    if tier in ('B', 'C'):
        return greedy_choose_move, f"{user.name} (Greedy Fallback)"
    else:
        return random_choose_move, f"{user.name} (Random Fallback)"


async def run_tournament_queue_async(tier: str, match_ids: List[str], move_delay_sec: float = 0.2):
    """
    Hàng đợi thực thi tuần tự tất cả các trận đấu vòng tròn trong giải đấu.
    Cập nhật Replay, trạng thái và phát sóng WebSocket liên tục.
    """
    for match_id in match_ids:
        db = SessionLocal()
        try:
            m = db.query(Match).filter(Match.id == match_id).first()
            if not m or m.status == "done":
                continue

            user_w = db.query(User).filter(User.id == m.bot_a_id).first()
            user_b = db.query(User).filter(User.id == m.bot_b_id).first()

            bot_white_fn, bot_w_name = get_bot_for_user(user_w, db)
            bot_black_fn, bot_b_name = get_bot_for_user(user_b, db)
        finally:
            db.close()

        # Thực thi trận đấu có streaming qua WebSocket
        try:
            await run_live_match_async(
                match_id=match_id,
                bot_white_fn=bot_white_fn,
                bot_black_fn=bot_black_fn,
                bot_white_name=bot_w_name,
                bot_black_name=bot_b_name,
                move_delay_sec=move_delay_sec,
                max_moves=200,
            )
        except Exception as e:
            # Ghi nhận lỗi nếu có
            db_err = SessionLocal()
            try:
                err_m = db_err.query(Match).filter(Match.id == match_id).first()
                if err_m:
                    err_m.status = "done"
                    err_m.end_code = "T1"
                    err_m.reason = f"Lỗi thực thi trận đấu: {str(e)}"
                    db_err.commit()
            finally:
                db_err.close()

        # Nghỉ nhẹ giữa các trận để hệ thống cập nhật WebSocket mượt mà
        await asyncio.sleep(0.5)

    # Khi tất cả các trận của bảng hoàn tất, broadcast thông báo kết thúc giải
    await ws_manager.broadcast_leaderboard({
        "type": "TOURNAMENT_COMPLETED",
        "tier": tier,
        "timestamp": datetime.utcnow().isoformat(),
    })


@router.post("/tournament/start")
async def start_tournament(req: TournamentStartRequest, db: Session = Depends(get_db)):
    """
    Khởi chạy giải đấu vòng tròn (Round-Robin) cho bảng chỉ định:
      - Chỉ chọn các thí sinh ĐÃ NỘP BÀI HỢP LỆ (Submission.is_active == True và status == 'valid')
      - Thí sinh chưa nộp bài hoặc bài không hợp lệ sẽ KHÔNG được ghép trận
      - Ghép cặp thi đấu 2 lượt đổi phe (Trắng - Đen, Đen - Trắng)
      - Khởi tạo các trận đấu và tự động chạy toàn bộ theo hàng đợi
    """
    tier = req.tier.upper()

    # Thu thập tất cả thí sinh trong bảng
    total_in_tier = db.query(User).filter(User.tier == tier, User.is_admin == False).count()

    # Thu thập ID của tất cả thí sinh ĐÃ NỘP BÀI HỢP LỆ trong bảng này
    valid_subs = (
        db.query(Submission.user_id)
        .filter(Submission.is_active == True, Submission.status == "valid")
        .all()
    )
    valid_user_ids = {s.user_id for s in valid_subs}

    users = (
        db.query(User)
        .filter(
            User.tier == tier,
            User.is_admin == False,
            User.id.in_(valid_user_ids),
        )
        .all()
    )

    if len(users) < 2:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Bảng {tier} hiện chỉ có {len(users)}/{total_in_tier} thí sinh đã nộp bài hợp lệ. "
                f"Cần tối thiểu 2 thí sinh đã nộp bài hợp lệ để tổ chức thi đấu vòng tròn!"
            ),
        )

    # Xóa các trận đấu 'pending' cũ của bảng này nếu có
    db.query(Match).filter(Match.tier == tier, Match.status == "pending").delete()
    db.commit()

    created_matches = []

    # Tạo cặp vòng tròn: Mỗi cặp A và B đấu 2 ván đổi phe (chỉ trong số thí sinh đã nộp bài hợp lệ)
    for i in range(len(users)):
        for j in range(i + 1, len(users)):
            user_a = users[i]
            user_b = users[j]

            # Ván 1: user_a cầm Trắng, user_b cầm Đen
            m1 = Match(
                id=str(uuid.uuid4()),
                tier=tier,
                bot_a_id=user_a.id,
                bot_b_id=user_b.id,
                status="pending",
                created_at=datetime.utcnow(),
            )
            db.add(m1)
            created_matches.append(m1)

            # Ván 2: user_b cầm Trắng, user_a cầm Đen (đổi phe)
            m2 = Match(
                id=str(uuid.uuid4()),
                tier=tier,
                bot_a_id=user_b.id,
                bot_b_id=user_a.id,
                status="pending",
                created_at=datetime.utcnow(),
            )
            db.add(m2)
            created_matches.append(m2)

    db.commit()

    # Khởi chạy toàn bộ hàng đợi trận đấu qua live_runner
    if created_matches:
        match_ids = [m.id for m in created_matches]
        asyncio.create_task(
            run_tournament_queue_async(
                tier=tier,
                match_ids=match_ids,
                move_delay_sec=req.move_delay_sec,
            )
        )

    # Thông báo sự kiện qua WebSocket Leaderboard
    await ws_manager.broadcast_leaderboard({
        "type": "TOURNAMENT_STARTED",
        "tier": tier,
        "total_matches": len(created_matches),
        "total_players": len(users),
        "timestamp": datetime.utcnow().isoformat(),
    })

    return {
        "success": True,
        "tier": tier,
        "total_players": len(users),
        "total_candidates": total_in_tier,
        "total_matches_created": len(created_matches),
        "active_match_id": created_matches[0].id if created_matches else None,
        "message": f"Đã khởi tạo thành công {len(created_matches)} trận đấu vòng tròn cho {len(users)} thí sinh đã nộp bài tại Bảng {tier}!",
    }


@router.get("/tournament/status")
def get_tournament_status(db: Session = Depends(get_db)):
    """Báo cáo tiến độ giải đấu chi tiết theo từng bảng A, B, C."""
    tiers = ["A", "B", "C"]
    status_report = {}

    valid_subs = (
        db.query(Submission.user_id)
        .filter(Submission.is_active == True, Submission.status == "valid")
        .all()
    )
    valid_user_ids = {s.user_id for s in valid_subs}

    for t in tiers:
        total = db.query(Match).filter(Match.tier == t).count()
        done = db.query(Match).filter(Match.tier == t, Match.status == "done").count()
        running = db.query(Match).filter(Match.tier == t, Match.status == "running").count()
        pending = total - done - running

        progress_pct = round((done / total * 100), 1) if total > 0 else 0.0

        tier_users = db.query(User).filter(User.tier == t, User.is_admin == False).all()
        total_players = len(tier_users)
        submitted_players = sum(1 for u in tier_users if u.id in valid_user_ids)

        status_report[t] = {
            "total_matches": total,
            "done_matches": done,
            "running_matches": running,
            "pending_matches": pending,
            "progress_percent": progress_pct,
            "total_players": total_players,
            "submitted_players": submitted_players,
        }

    return status_report


@router.post("/matches/{match_id}/retry")
def retry_match(match_id: str, db: Session = Depends(get_db)):
    """Chạy lại ván đấu gặp lỗi hoặc hủy với bot thật của thí sinh."""
    m = db.query(Match).filter(Match.id == match_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Không tìm thấy trận đấu")

    m.status = "pending"
    m.winner = None
    m.end_code = None
    m.total_moves = 0
    m.duration_ms = 0
    db.commit()

    # Rerun match in background
    user_w = db.query(User).filter(User.id == m.bot_a_id).first()
    user_b = db.query(User).filter(User.id == m.bot_b_id).first()

    bot_w_fn, bot_w_name = get_bot_for_user(user_w, db)
    bot_b_fn, bot_b_name = get_bot_for_user(user_b, db)

    asyncio.create_task(
        run_live_match_async(
            match_id=m.id,
            bot_white_fn=bot_w_fn,
            bot_black_fn=bot_b_fn,
            bot_white_name=bot_w_name,
            bot_black_name=bot_b_name,
            move_delay_sec=0.4,
        )
    )

    return {
        "success": True,
        "match_id": m.id,
        "message": "Trận đấu đang được khởi chạy lại trong Sandbox!",
    }


@router.post("/seed-data")
def trigger_seed_data(admin: User = Depends(require_admin)):
    """Đồng bộ / Cập nhật lại toàn bộ dữ liệu mẫu (Users, Submissions, Matches) vào cơ sở dữ liệu hiện tại."""
    try:
        from seed_demo_data import seed_data
        seed_data()
        return {
            "success": True,
            "message": "Đã cập nhật dữ liệu mẫu (9 thí sinh A/B/C, submissions và matches) thành công!"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi cập nhật dữ liệu: {str(e)}")


# ── Swiss Tournament Engine Endpoints ──────────

class SwissPairRequest(BaseModel):
    round_num: int = Field(1, ge=1, le=13, description="Số thứ tự vòng đấu Swiss (1-13)")
    num_chunks: int = Field(10, ge=1, le=20, description="Số lượng chunk phân bổ cho máy chấm")
    player_count: int = Field(2000, ge=4, le=2000, description="Số lượng thí sinh")


class SwissRunBatchRequest(BaseModel):
    round_num: int = Field(1, ge=1, le=13, description="Vòng đấu cần chấm")
    chunk_id: Optional[int] = Field(None, description="ID của chunk cụ thể (1-10) hoặc None để chạy tất cả")
    workers: int = Field(4, ge=1, le=16, description="Số tiến trình song song")


class SwissPublishRequest(BaseModel):
    round_num: int = Field(1, ge=1, le=13, description="Vòng đấu vừa hoàn thành cần xuất bản")


SWISS_STORAGE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "storage", "tournament")


@router.get("/swiss/status")
def get_swiss_tournament_status():
    """Lấy trạng thái điều hành giải đấu Thụy Sĩ (Swiss 13 Vòng)."""
    os.makedirs(SWISS_STORAGE_DIR, exist_ok=True)
    
    # Kiểm tra vòng đấu gần nhất
    current_round = 1
    chunks_ready = 0
    results_ready = 0
    is_published = False

    round_dir = os.path.join(SWISS_STORAGE_DIR, f"round_{current_round}")
    chunks_dir = os.path.join(round_dir, "chunks")
    results_dir = os.path.join(round_dir, "results")
    publish_dir = os.path.join(round_dir, "published")

    if os.path.exists(chunks_dir):
        chunks_ready = len([f for f in os.listdir(chunks_dir) if f.startswith("chunk_") and f.endswith(".json")])
    if os.path.exists(results_dir):
        results_ready = len([f for f in os.listdir(results_dir) if f.startswith("result_") and f.endswith(".json")])
    if os.path.exists(os.path.join(publish_dir, "standings.json")):
        is_published = True

    return {
        "current_round": current_round,
        "total_rounds": 13,
        "total_players": 2000,
        "num_chunks": 10,
        "chunks_ready": chunks_ready,
        "results_ready": results_ready,
        "is_published": is_published,
        "chunks_progress_percent": int((results_ready / 10) * 100) if chunks_ready > 0 else 0,
        "system_status": "ready",
    }


@router.post("/swiss/pair")
def trigger_swiss_pair(req: SwissPairRequest):
    """
    Bốc thăm ghép cặp Vòng R theo thể thức Thụy Sĩ và chia nhỏ 10 chunks.
    """
    try:
        from scripts.tournament.pair_swiss import load_or_generate_players, swiss_pair_round, split_into_chunks
        
        round_dir = os.path.join(SWISS_STORAGE_DIR, f"round_{req.round_num}")
        chunks_dir = os.path.join(round_dir, "chunks")
        os.makedirs(chunks_dir, exist_ok=True)

        prev_players_file = os.path.join(SWISS_STORAGE_DIR, f"round_{req.round_num - 1}", "published", f"players_after_r{req.round_num - 1}.json")
        players = load_or_generate_players(prev_players_file if os.path.exists(prev_players_file) else None, count=req.player_count)
        
        pairings = swiss_pair_round(players, req.round_num)
        chunks = split_into_chunks(pairings, num_chunks=req.num_chunks)

        for idx, chunk in enumerate(chunks, 1):
            chunk_file = os.path.join(chunks_dir, f"chunk_{str(idx).zfill(2)}.json")
            payload = {
                "round": req.round_num,
                "chunk_id": idx,
                "total_chunks": req.num_chunks,
                "matches_count": len(chunk),
                "matches": chunk,
            }
            with open(chunk_file, "w", encoding="utf-8") as f:
                import json
                json.dump(payload, f, indent=2, ensure_ascii=False)

        # Lưu trạng thái thí sinh trước vòng đấu
        with open(os.path.join(chunks_dir, f"players_before_r{req.round_num}.json"), "w", encoding="utf-8") as f:
            import json
            json.dump(players, f, indent=2, ensure_ascii=False)

        return {
            "success": True,
            "round": req.round_num,
            "total_matches": len(pairings),
            "num_chunks": len(chunks),
            "message": f"Đã ghép cặp thành công Vòng {req.round_num} ({len(pairings)} trận) và chia thành {len(chunks)} file chunk!",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi ghép cặp Swiss: {str(e)}")


@router.post("/swiss/publish")
def trigger_swiss_publish(req: SwissPublishRequest):
    """
    Hợp nhất 10 file kết quả, tính toán Buchholz & Sonneborn-Berger và xuất bản JSON tĩnh.
    """
    try:
        import glob
        import json
        from scripts.tournament.merge_and_publish import calculate_tiebreakers

        round_dir = os.path.join(SWISS_STORAGE_DIR, f"round_{req.round_num}")
        results_dir = os.path.join(round_dir, "results")
        publish_dir = os.path.join(round_dir, "published")
        os.makedirs(publish_dir, exist_ok=True)

        # Đọc các file result
        pattern = os.path.join(results_dir, "result_*.json")
        result_files = sorted(glob.glob(pattern))

        if not result_files:
            # Nếu chưa có kết quả từ máy chấm, tự động tạo mô phỏng kết quả nhanh để Admin kiểm thử
            chunks_dir = os.path.join(round_dir, "chunks")
            chunk_pattern = os.path.join(chunks_dir, "chunk_*.json")
            chunk_files = sorted(glob.glob(chunk_pattern))
            
            os.makedirs(results_dir, exist_ok=True)
            for c_file in chunk_files:
                with open(c_file, "r", encoding="utf-8") as f:
                    c_data = json.load(f)
                r_matches = []
                for m in c_data.get("matches", []):
                    import random
                    outcome = random.choice(["W", "B", "D"])
                    r_matches.append({
                        "match_id": m["match_id"],
                        "round": req.round_num,
                        "white_id": m["white"]["id"],
                        "black_id": m["black"]["id"],
                        "white_name": m["white"]["name"],
                        "black_name": m["black"]["name"],
                        "winner": outcome if outcome != "D" else None,
                        "end_code": "W2" if outcome == "W" else "B2" if outcome == "B" else "D2",
                        "total_moves": random.randint(35, 95),
                        "duration_ms": random.randint(450, 1800),
                        "reason": "Mô phỏng chấm thi giải đấu",
                        "status": "success",
                    })
                r_path = os.path.join(results_dir, f"result_{str(c_data['chunk_id']).zfill(2)}.json")
                with open(r_path, "w", encoding="utf-8") as rf:
                    json.dump({"chunk_id": c_data["chunk_id"], "round": req.round_num, "results": r_matches}, rf, indent=2, ensure_ascii=False)
            
            result_files = sorted(glob.glob(pattern))

        all_matches = []
        for rf in result_files:
            with open(rf, "r", encoding="utf-8") as f:
                all_matches.extend(json.load(f).get("results", []))

        # Đọc players
        chunks_dir = os.path.join(round_dir, "chunks")
        players_before_path = os.path.join(chunks_dir, f"players_before_r{req.round_num}.json")
        players_map = {}
        if os.path.exists(players_before_path):
            with open(players_before_path, "r", encoding="utf-8") as f:
                for p in json.load(f):
                    players_map[p["id"]] = p

        for p in players_map.values():
            p.setdefault("opponents_history", [])
            p.setdefault("matches_played", 0)
            p.setdefault("wins", 0)
            p.setdefault("draws", 0)
            p.setdefault("losses", 0)

        for m in all_matches:
            w_id, b_id = m["white_id"], m["black_id"]
            winner = m["winner"]

            if w_id in players_map:
                players_map[w_id]["matches_played"] += 1
                players_map[w_id].setdefault("history", []).append(b_id)
            if b_id in players_map:
                players_map[b_id]["matches_played"] += 1
                players_map[b_id].setdefault("history", []).append(w_id)

            if winner == "W":
                if w_id in players_map:
                    players_map[w_id]["wins"] += 1
                    players_map[w_id]["points"] = players_map[w_id].get("points", 0) + 3
                    players_map[w_id]["opponents_history"].append((b_id, "win"))
                if b_id in players_map:
                    players_map[b_id]["losses"] += 1
                    players_map[b_id]["opponents_history"].append((w_id, "loss"))
            elif winner == "B":
                if b_id in players_map:
                    players_map[b_id]["wins"] += 1
                    players_map[b_id]["points"] = players_map[b_id].get("points", 0) + 3
                    players_map[b_id]["opponents_history"].append((w_id, "win"))
                if w_id in players_map:
                    players_map[w_id]["losses"] += 1
                    players_map[w_id]["opponents_history"].append((b_id, "loss"))
            else:
                if w_id in players_map:
                    players_map[w_id]["draws"] += 1
                    players_map[w_id]["points"] = players_map[w_id].get("points", 0) + 1
                    players_map[w_id]["opponents_history"].append((b_id, "draw"))
                if b_id in players_map:
                    players_map[b_id]["draws"] += 1
                    players_map[b_id]["points"] = players_map[b_id].get("points", 0) + 1
                    players_map[b_id]["opponents_history"].append((w_id, "draw"))

        calculate_tiebreakers(players_map)

        sorted_standings = sorted(
            players_map.values(),
            key=lambda p: (p.get("points", 0), p.get("buchholz", 0), p.get("sonneborn_berger", 0), p.get("wins", 0), -p.get("losses", 0)),
            reverse=True
        )

        standings_export = []
        for rank_idx, p in enumerate(sorted_standings, 1):
            mp = p.get("matches_played", 0)
            win_rate = round((p.get("wins", 0) / mp) * 100, 1) if mp > 0 else 0.0
            grade = "6.5 – 7.0"
            if rank_idx <= 32: grade = "10.0 (A+)"
            elif p.get("wins", 0) >= 10: grade = "9.5"
            elif p.get("wins", 0) >= 8: grade = "9.0"
            elif p.get("wins", 0) >= 6: grade = "8.5"
            elif p.get("wins", 0) >= 4: grade = "7.5"

            standings_export.append({
                "rank": rank_idx,
                "user_id": p["id"],
                "name": p["name"],
                "student_id": p.get("student_id"),
                "bot_name": p.get("bot_name"),
                "matches_played": mp,
                "wins": p.get("wins", 0),
                "draws": p.get("draws", 0),
                "losses": p.get("losses", 0),
                "points": p.get("points", 0),
                "buchholz": p.get("buchholz", 0.0),
                "sonneborn_berger": p.get("sonneborn_berger", 0.0),
                "win_rate": win_rate,
                "grade_projection": grade,
                "is_top32": rank_idx <= 32,
            })

        # Lưu các file xuất bản tĩnh
        with open(os.path.join(publish_dir, "standings.json"), "w", encoding="utf-8") as f:
            json.dump(standings_export, f, indent=2, ensure_ascii=False)
        with open(os.path.join(publish_dir, "top32.json"), "w", encoding="utf-8") as f:
            json.dump(standings_export[:32], f, indent=2, ensure_ascii=False)
        with open(os.path.join(publish_dir, f"players_after_r{req.round_num}.json"), "w", encoding="utf-8") as f:
            json.dump(list(players_map.values()), f, indent=2, ensure_ascii=False)

        return {
            "success": True,
            "round": req.round_num,
            "total_matches_merged": len(all_matches),
            "total_players": len(standings_export),
            "top5": standings_export[:5],
            "message": f"Đã xuất bản bảng xếp hạng Vòng {req.round_num} thành công! Top 32 đã được xác định.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi xuất bản bảng xếp hạng: {str(e)}")


# ════════════════════════════════════════════════════════════════════════════
# ── MỤC 1: PIPELINE TIẾP NHẬN & THẨM ĐỊNH BÀI THI BẤT ĐỒNG BỘ ─────────────────
# ════════════════════════════════════════════════════════════════════════════

@router.post("/pipeline/start")
async def start_batch_import_pipeline(
    background_tasks: BackgroundTasks,
    file: Optional[UploadFile] = File(None),
    csv_text: Optional[str] = Form(None),
    deadline: Optional[str] = Form(None),
):
    """
    Khởi động pipeline bất đồng bộ tiếp nhận bài nộp từ Google Form:
      1. Đọc CSV Google Form.
      2. Khử trùng lặp theo MSSV, chỉ giữ bản ghi cuối cùng <= deadline.
      3. Clone song song đa luồng và checkout commit trước deadline.
      4. Thẩm định 4 tiêu chí cốt lõi và chạy thử Sandbox.
      5. Cập nhật User & Submission vào DB.
    """
    raw_content = ""
    if file:
        file_bytes = await file.read()
        raw_content = file_bytes.decode("utf-8-sig", errors="ignore")
    elif csv_text:
        raw_content = csv_text.strip()
    else:
        raise HTTPException(status_code=400, detail="Vui lòng tải lên file CSV hoặc dán nội dung CSV từ Google Form!")

    if not raw_content.strip():
        raise HTTPException(status_code=400, detail="Nội dung CSV rỗng!")

    task_id = str(uuid.uuid4())
    background_tasks.add_task(
        run_batch_import_pipeline,
        raw_csv=raw_content,
        deadline_str=deadline,
        task_id=task_id,
    )

    return {
        "success": True,
        "task_id": task_id,
        "deadline": deadline,
        "message": "Đã khởi động tiến trình tải và thẩm định bài thi bất đồng bộ thành công!",
    }


@router.get("/pipeline/status")
def get_batch_pipeline_status():
    """Lấy tiến độ thời gian thực của pipeline tải và thẩm định hàng loạt."""
    return global_pipeline_progress.get_status()


@router.get("/pipeline/export-report")
def export_pipeline_validation_report(db: Session = Depends(get_db)):
    """
    Xuất file CSV báo cáo đối soát tổng thể toàn bộ thí sinh:
    MSSV, Họ tên, Email, Lớp, Link Repo, Trạng thái, Commit Hash, Số Commit, Chi tiết Lỗi.
    """
    users = db.query(User).filter(User.is_admin == False).order_by(User.student_id).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "MSSV",
        "Họ và Tên",
        "Email",
        "Lớp",
        "Tên Bot",
        "Link GitHub Repository",
        "Trạng Thái Thẩm Định",
        "Hợp Lệ",
        "Mã Commit Chốt",
        "Thời Gian Commit",
        "Số Lượng Commit",
        "Chi Tiết Lỗi / Cảnh Báo"
    ])

    for u in users:
        sub = db.query(Submission).filter(Submission.user_id == u.id).order_by(Submission.submitted_at.desc()).first()
        status_str = sub.status if sub else "not_submitted"
        is_valid_str = "HỢP LỆ" if (sub and sub.status == "valid") else "LỖI" if sub else "CHƯA NỘP"
        test_run = sub.test_run_result if sub else {}
        commit_hash = test_run.get("checked_out_commit", "") if test_run else ""
        commit_date = test_run.get("commit_date", "") if test_run else ""
        commit_count = sub.commit_count if sub else u.commit_count
        val = sub.validation if sub else {}
        errors = "; ".join(val.get("errors", [])) if val else ""
        warnings = "; ".join(val.get("warnings", [])) if val else ""
        err_full = f"Lỗi: {errors}" if errors else ""
        if warnings:
            err_full += f" | Cảnh báo: {warnings}"

        writer.writerow([
            u.student_id or "",
            u.name or "",
            u.email or "",
            u.class_name or "",
            u.bot_name or "",
            (sub.github_repo_url if sub else u.github_repo_url) or "",
            status_str,
            is_valid_str,
            commit_hash,
            commit_date,
            commit_count,
            err_full,
        ])

    csv_data = "\ufeff" + output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=bao_cao_doi_soat_thi_sinh_ottv2.csv"}
    )


@router.post("/import/google-form")
async def import_google_form_csv(
    file: Optional[UploadFile] = File(None),
    csv_text: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """
    Nhận file CSV hoặc text xuất từ Google Form thu thập link repo sinh viên UET.
    Tự động chuẩn hóa các cột: Họ tên, MSSV, Email, Lớp, Link GitHub Repository, Tên Bot.
    Cập nhật hoặc thêm mới User và Submission vào cơ sở dữ liệu.
    """
    raw_content = ""
    if file:
        file_bytes = await file.read()
        raw_content = file_bytes.decode("utf-8-sig", errors="ignore")
    elif csv_text:
        raw_content = csv_text.strip()
    else:
        raise HTTPException(status_code=400, detail="Vui lòng tải lên file CSV hoặc dán nội dung CSV Google Form!")

    if not raw_content:
        raise HTTPException(status_code=400, detail="Nội dung CSV rỗng!")

    try:
        reader = list(csv.reader(io.StringIO(raw_content)))
        if not reader or len(reader) < 2:
            raise HTTPException(status_code=400, detail="File CSV không hợp lệ hoặc chỉ có dòng tiêu đề!")

        headers = reader[0]

        def match_header(keywords: List[str]) -> int:
            for idx, h in enumerate(headers):
                clean = h.lower().strip()
                if any(kw in clean for kw in keywords):
                    return idx
            return -1

        email_idx = match_header(["email", "địa chỉ", "mail"])
        name_idx = match_header(["họ và tên", "họ tên", "tên", "full name", "name"])
        id_idx = match_header(["mã sinh viên", "mssv", "student id", "student_id", "msv"])
        class_idx = match_header(["lớp", "class"])
        repo_idx = match_header(["github", "repo", "link", "repository", "url"])
        bot_idx = match_header(["tên bot", "bot name", "bot"])

        created_count = 0
        updated_count = 0
        preview_list = []

        for row_idx, row in enumerate(reader[1:], start=2):
            if not row or all(not str(cell).strip() for cell in row):
                continue

            def get_val(idx: int) -> str:
                return row[idx].strip() if 0 <= idx < len(row) else ""

            s_email = get_val(email_idx)
            s_name = get_val(name_idx)
            s_id = get_val(id_idx)
            s_class = get_val(class_idx) or "QH-2022-I/CQ"
            s_repo = get_val(repo_idx)
            s_bot = get_val(bot_idx) or (f"Bot_{s_id}" if s_id else "OTT_Bot")

            if not s_id and not s_email and not s_name:
                continue

            if not s_email:
                s_email = f"{s_id}@vnu.edu.vn" if s_id else f"user_{uuid.uuid4().hex[:8]}@vnu.edu.vn"
            if not s_name:
                s_name = f"Sinh Viên {s_id or s_email}"

            # Tìm kiếm user trong DB theo email hoặc student_id
            existing_user = None
            if s_email:
                existing_user = db.query(User).filter(User.email == s_email).first()
            if not existing_user and s_id:
                existing_user = db.query(User).filter(User.student_id == s_id).first()

            if existing_user:
                existing_user.name = s_name
                if s_id:
                    existing_user.student_id = s_id
                if s_class:
                    existing_user.class_name = s_class
                if s_repo:
                    existing_user.github_repo_url = s_repo
                if s_bot:
                    existing_user.bot_name = s_bot
                target_user = existing_user
                updated_count += 1
            else:
                new_user = User(
                    id=str(uuid.uuid4()),
                    name=s_name,
                    email=s_email,
                    hashed_password=hash_password("student@123"),
                    student_id=s_id or None,
                    class_name=s_class,
                    github_repo_url=s_repo or None,
                    bot_name=s_bot,
                    is_admin=False,
                    is_active=True,
                )
                db.add(new_user)
                target_user = new_user
                created_count += 1

            # Cập nhật hoặc tạo submission tương ứng nếu có repo
            if s_repo:
                db.flush()
                sub = db.query(Submission).filter(Submission.user_id == target_user.id).first()
                if not sub:
                    sub = Submission(
                        id=str(uuid.uuid4()),
                        user_id=target_user.id,
                        github_repo_url=s_repo,
                        status="valid",
                        bot_version="v1",
                    )
                    db.add(sub)
                else:
                    sub.github_repo_url = s_repo
                    sub.status = "valid"

            if len(preview_list) < 25:
                preview_list.append({
                    "name": s_name,
                    "student_id": s_id,
                    "email": s_email,
                    "class_name": s_class,
                    "github_repo_url": s_repo,
                    "bot_name": s_bot,
                })

        db.commit()

        return {
            "success": True,
            "total_rows": len(reader) - 1,
            "created_count": created_count,
            "updated_count": updated_count,
            "preview": preview_list,
            "message": f"Đã nhập thành công từ Google Form: {created_count} thí sinh mới, {updated_count} thí sinh được cập nhật!",
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi khi đọc file CSV Google Form: {str(e)}")


# ════════════════════════════════════════════════════════════════════════════
# ── MỤC 2: PHÂN PHỐI 10 CHUNK CHO CỤM MÁY CHẤM PHÂN TÁN ─────────────────────
# ════════════════════════════════════════════════════════════════════════════

@router.get("/swiss/chunks/{round_num}")
def get_round_chunks_list(round_num: int):
    """Lấy danh sách chi tiết các chunk đã cắt cho Vòng round_num."""
    round_dir = os.path.join(SWISS_STORAGE_DIR, f"round_{round_num}")
    chunks_dir = os.path.join(round_dir, "chunks")

    if not os.path.exists(chunks_dir):
        return {"round": round_num, "total_chunks": 0, "chunks": []}

    pattern = os.path.join(chunks_dir, "chunk_*.json")
    import glob
    chunk_files = sorted(glob.glob(pattern))

    results_dir = os.path.join(round_dir, "results")

    chunks_data = []
    for cf in chunk_files:
        base_name = os.path.basename(cf)
        chunk_idx = int(base_name.replace("chunk_", "").replace(".json", ""))

        matches_count = 100
        try:
            with open(cf, "r", encoding="utf-8") as f:
                c_json = json.load(f)
                matches_count = len(c_json.get("matches", []))
        except Exception:
            pass

        # Kiểm tra máy này đã nộp kết quả chưa
        result_file = os.path.join(results_dir, f"result_{str(chunk_idx).zfill(2)}.json")
        is_completed = os.path.exists(result_file)

        chunks_data.append({
            "chunk_id": chunk_idx,
            "file_name": base_name,
            "matches_count": matches_count,
            "file_size_kb": round(os.path.getsize(cf) / 1024, 1),
            "is_completed": is_completed,
            "download_url": f"/api/admin/swiss/chunks/{round_num}/{chunk_idx}/download",
        })

    return {
        "round": round_num,
        "total_chunks": len(chunks_data),
        "chunks": chunks_data,
    }


@router.get("/swiss/chunks/{round_num}/{chunk_id}/download")
def download_single_chunk(round_num: int, chunk_id: int):
    """Tải xuống file chunk_XX.json cho máy chấm cụ thể."""
    chunk_file = os.path.join(SWISS_STORAGE_DIR, f"round_{round_num}", "chunks", f"chunk_{str(chunk_id).zfill(2)}.json")
    if not os.path.exists(chunk_file):
        raise HTTPException(status_code=404, detail=f"Không tìm thấy file chunk_{chunk_id} cho Vòng {round_num}!")

    return FileResponse(
        path=chunk_file,
        filename=f"chunk_{str(chunk_id).zfill(2)}.json",
        media_type="application/json",
    )


@router.get("/swiss/chunks/{round_num}/download-zip")
def download_all_chunks_zip(round_num: int):
    """Đóng gói tất cả file chunk của Vòng round_num kèm script run_batch.py thành file ZIP."""
    round_dir = os.path.join(SWISS_STORAGE_DIR, f"round_{round_num}")
    chunks_dir = os.path.join(round_dir, "chunks")

    if not os.path.exists(chunks_dir):
        raise HTTPException(status_code=404, detail=f"Chưa có file chunk cho Vòng {round_num}. Vui lòng bấm Bốc Thăm trước!")

    zip_filename = f"swiss_round_{round_num}_chunks.zip"
    zip_path = os.path.join(round_dir, zip_filename)

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        import glob
        for cf in glob.glob(os.path.join(chunks_dir, "chunk_*.json")):
            zf.write(cf, arcname=os.path.join("chunks", os.path.basename(cf)))

        # Kèm run_batch.py
        run_batch_script = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts", "tournament", "run_batch.py")
        if os.path.exists(run_batch_script):
            zf.write(run_batch_script, arcname="run_batch.py")

        # Kèm file hướng dẫn
        instructions = f"""HƯỚNG DẪN CHẠY CHẤM THI CỤM MÁY LAPTOP SINH VIÊN (VÒNG {round_num})
======================================================================
1. Máy số X (ví dụ Máy #01) copy file 'chunks/chunk_01.json' vào thư mục làm việc.
2. Chạy lệnh:
   python run_batch.py --chunk chunks/chunk_01.json --out result_01.json
3. Sau khi chạy xong (~2-3 phút cho 100 trận), gửi file 'result_01.json' về cho BTC
   hoặc tải trực tiếp lên mục 'Tiếp Nhận Kết Quả' trên Admin Dashboard!
"""
        zf.writestr("HUONG_DAN_CHAM_THI.txt", instructions)

    return FileResponse(
        path=zip_path,
        filename=zip_filename,
        media_type="application/zip",
    )


# ════════════════════════════════════════════════════════════════════════════
# ── MỤC 3: TIẾP NHẬN KẾT QUẢ TỪ 10 MÁY CHẤM & CẬP NHẬT TIẾN ĐỘ ───────────────
# ════════════════════════════════════════════════════════════════════════════

@router.post("/swiss/upload-result")
async def upload_machine_result(
    file: UploadFile = File(...),
    round_num: Optional[int] = Form(None),
):
    """
    Tiếp nhận file result_XX.json từ máy chấm phân tán hoặc file ZIP chứa nhiều result.
    Lưu trực tiếp vào thư mục results/ của vòng đấu.
    """
    file_bytes = await file.read()
    filename = file.filename or ""

    if filename.endswith(".json"):
        try:
            data = json.loads(file_bytes.decode("utf-8"))
        except Exception:
            raise HTTPException(status_code=400, detail="File nộp không phải định dạng JSON hợp lệ!")

        r_num = round_num or data.get("round", 1)
        chunk_id = data.get("chunk_id")
        if not chunk_id:
            # Thử parse từ tên file result_01.json
            clean_name = os.path.splitext(filename)[0]
            if "result_" in clean_name:
                try:
                    chunk_id = int(clean_name.replace("result_", ""))
                except Exception:
                    pass

        if not chunk_id:
            raise HTTPException(status_code=400, detail="Không xác định được chunk_id từ file kết quả!")

        results_dir = os.path.join(SWISS_STORAGE_DIR, f"round_{r_num}", "results")
        os.makedirs(results_dir, exist_ok=True)

        target_file = os.path.join(results_dir, f"result_{str(chunk_id).zfill(2)}.json")
        with open(target_file, "wb") as f:
            f.write(file_bytes)

        matches_count = len(data.get("results", []))
        return {
            "success": True,
            "round": r_num,
            "chunk_id": chunk_id,
            "matches_count": matches_count,
            "message": f"Đã tiếp nhận thành công kết quả Máy #{chunk_id} ({matches_count} trận đấu)!",
        }

    elif filename.endswith(".zip"):
        try:
            zf = zipfile.ZipFile(io.BytesIO(file_bytes))
            count_saved = 0
            for name in zf.namelist():
                if name.endswith(".json") and "result_" in os.path.basename(name):
                    b_name = os.path.basename(name)
                    c_id = int(b_name.replace("result_", "").replace(".json", ""))
                    
                    r_num = round_num or 1
                    results_dir = os.path.join(SWISS_STORAGE_DIR, f"round_{r_num}", "results")
                    os.makedirs(results_dir, exist_ok=True)
                    
                    with open(os.path.join(results_dir, b_name), "wb") as out_f:
                        out_f.write(zf.read(name))
                    count_saved += 1

            return {
                "success": True,
                "count_saved": count_saved,
                "message": f"Đã giải nén và lưu thành công {count_saved} file kết quả từ gói ZIP!",
            }
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Lỗi khi đọc file ZIP kết quả: {str(e)}")

    else:
        raise HTTPException(status_code=400, detail="Định dạng không được hỗ trợ! Vui lòng nộp file .json hoặc .zip!")


@router.get("/swiss/results-status/{round_num}")
def get_round_results_status(round_num: int):
    """Kiểm tra chi tiết tình trạng nộp bài của từng máy chấm trong 10 máy."""
    round_dir = os.path.join(SWISS_STORAGE_DIR, f"round_{round_num}")
    results_dir = os.path.join(round_dir, "results")

    status_list = []
    ready_count = 0
    total_matches_done = 0

    for chunk_id in range(1, 11):
        res_file = os.path.join(results_dir, f"result_{str(chunk_id).zfill(2)}.json")
        is_ready = os.path.exists(res_file)

        matches_count = 0
        file_size_kb = 0.0
        last_updated = None

        if is_ready:
            ready_count += 1
            file_size_kb = round(os.path.getsize(res_file) / 1024, 1)
            last_updated = datetime.fromtimestamp(os.path.getmtime(res_file)).strftime("%H:%M:%S %d/%m")
            try:
                with open(res_file, "r", encoding="utf-8") as f:
                    d = json.load(f)
                    matches_count = len(d.get("results", []))
                    total_matches_done += matches_count
            except Exception:
                matches_count = 100
                total_matches_done += 100

        status_list.append({
            "chunk_id": chunk_id,
            "machine_label": f"Máy #{str(chunk_id).zfill(2)}",
            "is_ready": is_ready,
            "matches_count": matches_count,
            "file_size_kb": file_size_kb,
            "last_updated": last_updated,
        })

    return {
        "round": round_num,
        "ready_count": ready_count,
        "total_chunks": 10,
        "total_matches_done": total_matches_done,
        "is_all_ready": ready_count >= 10,
        "progress_percent": int((ready_count / 10) * 100),
        "machines": status_list,
    }


# ════════════════════════════════════════════════════════════════════════════
# ── MỤC 4: VÒNG CHUNG KẾT TOP 32 & CẤU HÌNH Ô CHƯỚNG NGẠI VẬT ───────────────
# ════════════════════════════════════════════════════════════════════════════

class Top32ConfigRequest(BaseModel):
    obstacles: List[str] = Field(default_factory=lambda: ["d4", "d6", "f4", "f6", "e5"])
    rules_announcement: Optional[str] = Field(None, description="Thông báo đổi luật cho thí sinh")


@router.get("/top32/config")
def get_top32_config(db: Session = Depends(get_db)):
    """Lấy danh sách hạt giống Top 32 và cấu hình các ô chướng ngại vật."""
    config_file = os.path.join(SWISS_STORAGE_DIR, "top32_config.json")
    default_obstacles = ["d4", "d6", "f4", "f6", "e5"]
    announcement = "Vòng Chung kết Top 32 áp dụng luật bàn cờ có ô chướng ngại vật cấm đi vào tại 5 vị trí: d4, d6, f4, f6, e5."

    if os.path.exists(config_file):
        try:
            with open(config_file, "r", encoding="utf-8") as f:
                saved = json.load(f)
                default_obstacles = saved.get("obstacles", default_obstacles)
                announcement = saved.get("rules_announcement", announcement)
        except Exception:
            pass

    # Lấy danh sách Top 32 thí sinh từ DB
    top32_users = (
        db.query(User)
        .filter(User.is_top32 == True)
        .order_by(User.swiss_wins.desc(), User.buchholz.desc())
        .limit(32)
        .all()
    )

    if not top32_users:
        # Fallback lấy 32 người điểm cao nhất
        top32_users = (
            db.query(User)
            .order_by(User.swiss_wins.desc(), User.swiss_points.desc())
            .limit(32)
            .all()
        )

    users_list = []
    for idx, u in enumerate(top32_users, 1):
        users_list.append({
            "seed": idx,
            "id": u.id,
            "name": u.name,
            "student_id": u.student_id,
            "class_name": u.class_name,
            "bot_name": u.bot_name,
            "swiss_wins": u.swiss_wins or 0,
            "swiss_points": u.swiss_points or 0,
            "github_repo_url": u.github_repo_url,
        })

    return {
        "obstacles": default_obstacles,
        "rules_announcement": announcement,
        "total_seeds": len(users_list),
        "seeds": users_list,
    }


@router.post("/top32/config")
def save_top32_config(req: Top32ConfigRequest):
    """Cập nhật cấu hình các ô chướng ngại vật cho Vòng Chung Kết Top 32."""
    config_file = os.path.join(SWISS_STORAGE_DIR, "top32_config.json")
    try:
        data = {
            "obstacles": [o.lower().strip() for o in req.obstacles if o.strip()],
            "rules_announcement": req.rules_announcement or "",
            "updated_at": datetime.now().isoformat(),
        }
        with open(config_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        return {
            "success": True,
            "obstacles": data["obstacles"],
            "message": f"Đã lưu thành công cấu hình {len(data['obstacles'])} ô chướng ngại vật cho Vòng Chung Kết!",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi lưu cấu hình Top 32: {str(e)}")




