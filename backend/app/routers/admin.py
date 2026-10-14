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
from typing import List, Optional, Dict, Any, Callable, Tuple
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.models.user import User
from app.models.match import Match, Replay
from app.models.submission import Submission
from app.routers.auth import get_current_user, require_admin
from app.services.sandbox import load_bot_from_file
from app.services.live_runner import run_live_match_async
from app.services.starter_bots.greedy_bot import choose_move as greedy_choose_move
from app.services.starter_bots.random_bot import choose_move as random_choose_move
from app.websocket.manager import ws_manager

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ── Pydantic Schemas ────────────────────────────

class ReviewGradeRequest(BaseModel):
    score_ai_profile: float = Field(..., ge=0, le=100, description="Điểm hồ sơ AI (Prompt log) (0-100)")
    score_interview: float = Field(..., ge=0, le=100, description="Điểm vấn đáp hiểu code (0-100)")
    score_report: float = Field(..., ge=0, le=100, description="Điểm báo cáo tự đánh giá (0-100)")
    score_bot: Optional[float] = Field(None, ge=0, le=100, description="Điểm hiệu quả bot (nếu nhập thủ công)")
    notes: Optional[str] = Field(None, description="Nhận xét của giảng viên")


class ChangeTierRequest(BaseModel):
    tier: str = Field(..., description="Bảng thi đấu mới: 'A', 'B', 'C'")


class TournamentStartRequest(BaseModel):
    tier: str = Field(..., description="Bảng thi đấu cần khởi chạy: 'A', 'B', 'C'")
    move_delay_sec: float = Field(0.5, ge=0.05, le=3.0, description="Độ trễ mỗi nước đi cho WebSocket live")


# ── Trọng số điểm theo Bảng 5 (Version 1 Spec) ──
TIER_WEIGHTS = {
    'A': {'bot': 0.30, 'ai': 0.25, 'interview': 0.30, 'report': 0.15},
    'B': {'bot': 0.40, 'ai': 0.20, 'interview': 0.25, 'report': 0.15},
    'C': {'bot': 0.50, 'ai': 0.15, 'interview': 0.20, 'report': 0.15},
}


def calculate_final_score(user: User) -> float:
    """Tính điểm tổng kết theo trọng số từng bảng."""
    tier = user.tier or 'A'
    weights = TIER_WEIGHTS.get(tier, TIER_WEIGHTS['A'])
    
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
    tier_counts = {
        "A": db.query(User).filter(User.tier == "A").count(),
        "B": db.query(User).filter(User.tier == "B").count(),
        "C": db.query(User).filter(User.tier == "C").count(),
    }

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
            "tier_counts": tier_counts,
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
    tier: Optional[str] = Query(None, description="Lọc theo bảng"),
    db: Session = Depends(get_db),
):
    """Lấy danh sách toàn bộ thí sinh cùng bảng điểm chi tiết."""
    query = db.query(User)
    if tier:
        query = query.filter(User.tier == tier.upper())
    
    users = query.order_by(User.registered_at.desc()).all()

    result = []
    for u in users:
        # Lấy submission active nếu có
        active_sub = (
            db.query(Submission)
            .filter(Submission.user_id == u.id, Submission.is_active == True)
            .first()
        )

        result.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "tier": u.tier,
            "test_score": u.test_score,
            "score_bot": u.score_bot,
            "score_ai_profile": u.score_ai_profile,
            "score_interview": u.score_interview,
            "score_report": u.score_report,
            "final_score": calculate_final_score(u),
            "is_admin": u.is_admin,
            "has_submission": active_sub is not None,
            "submission_id": active_sub.id if active_sub else None,
            "submission_status": active_sub.status if active_sub else "none",
            "registered_at": u.registered_at,
        })

    return result


@router.put("/users/{user_id}/tier")
def update_user_tier(
    user_id: str,
    req: ChangeTierRequest,
    db: Session = Depends(get_db),
):
    """Điều chỉnh phân bảng thí sinh (A/B/C)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy thí sinh")

    new_tier = req.tier.upper()
    if new_tier not in ["A", "B", "C"]:
        raise HTTPException(status_code=400, detail="Bảng thi đấu phải là A, B hoặc C")

    user.tier = new_tier
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
    Ghi nhận điểm thi của thí sinh:
      - Hồ sơ AI (Prompt log) (0-100)
      - Vấn đáp hiểu code (0-100)
      - Báo cáo thuật toán (0-100)
      - Điểm hiệu quả bot (nếu chấm thủ công)
    Tự động tính điểm tổng kết có trọng số theo bảng.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy thí sinh")

    user.score_ai_profile = req.score_ai_profile
    user.score_interview = req.score_interview
    user.score_report = req.score_report
    if req.score_bot is not None:
        user.score_bot = req.score_bot

    db.commit()
    db.refresh(user)

    final_score = calculate_final_score(user)

    return {
        "success": True,
        "user_id": user.id,
        "name": user.name,
        "tier": user.tier,
        "scores": {
            "score_bot": user.score_bot,
            "score_ai_profile": user.score_ai_profile,
            "score_interview": user.score_interview,
            "score_report": user.score_report,
            "final_score": final_score,
        },
        "weights": TIER_WEIGHTS.get(user.tier, TIER_WEIGHTS['A']),
    }


@router.get("/submissions/{submission_id}/files")
def view_submission_files(submission_id: str, db: Session = Depends(get_db)):
    """
    Trích xuất và đọc nội dung các file trong gói bài làm của sinh viên:
    bot.py, PROMPTS.md, REPORT.md và danh sách file trong chat_history/.
    Giúp giám khảo chấm hồ sơ AI và vấn đáp trực tiếp trên web mà không cần tải thủ công.
    """
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài nộp")

    if not sub.zip_path or not os.path.exists(sub.zip_path):
        raise HTTPException(status_code=404, detail="File nén của bài nộp không tồn tại trên máy chủ")

    files_content = {
        "bot_py": "",
        "prompts_md": "",
        "report_md": "",
        "chat_history": [],
    }

    try:
        with zipfile.ZipFile(sub.zip_path, "r") as z:
            for item in z.infolist():
                if item.is_dir():
                    continue
                name_lower = os.path.basename(item.filename).lower()
                
                # Đọc bot.py
                if name_lower == "bot.py":
                    files_content["bot_py"] = z.read(item).decode("utf-8", errors="ignore")
                # Đọc PROMPTS.md
                elif name_lower == "prompts.md":
                    files_content["prompts_md"] = z.read(item).decode("utf-8", errors="ignore")
                # Đọc REPORT.md
                elif name_lower == "report.md":
                    files_content["report_md"] = z.read(item).decode("utf-8", errors="ignore")
                # Đọc file trong chat_history/
                elif "chat_history" in item.filename.lower():
                    content = z.read(item).decode("utf-8", errors="ignore")
                    files_content["chat_history"].append({
                        "filename": os.path.basename(item.filename),
                        "content": content[:8000],  # giới hạn xem trước
                    })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi đọc file nén: {str(e)}")

    user = db.query(User).filter(User.id == sub.user_id).first()

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
    if sub and sub.validation:
        val_data = sub.validation
        extracted_path = val_data.get("extracted_path")
        if extracted_path and os.path.exists(extracted_path):
            bot_file = os.path.join(extracted_path, "bot.py")
            if not os.path.exists(bot_file):
                for root, _, files in os.walk(extracted_path):
                    if "bot.py" in files:
                        bot_file = os.path.join(root, "bot.py")
                        break
            if os.path.exists(bot_file):
                try:
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
      - Thu thập tất cả thí sinh trong bảng (loại trừ tài khoản Admin BTC)
      - Ghép cặp thi đấu 2 lượt đổi phe (Trắng - Đen, Đen - Trắng)
      - Khởi tạo các trận đấu và tự động chạy toàn bộ theo hàng đợi
    """
    tier = req.tier.upper()
    users = db.query(User).filter(User.tier == tier, User.is_admin == False).all()

    if len(users) < 2:
        raise HTTPException(
            status_code=400,
            detail=f"Bảng {tier} cần ít nhất 2 thí sinh để tổ chức thi đấu vòng tròn (hiện có: {len(users)} thí sinh)",
        )

    # Xóa các trận đấu 'pending' cũ của bảng này nếu có
    db.query(Match).filter(Match.tier == tier, Match.status == "pending").delete()
    db.commit()

    created_matches = []

    # Tạo cặp vòng tròn: Mỗi cặp A và B đấu 2 ván đổi phe
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
        "timestamp": datetime.utcnow().isoformat(),
    })

    return {
        "success": True,
        "tier": tier,
        "total_players": len(users),
        "total_matches_created": len(created_matches),
        "active_match_id": created_matches[0].id if created_matches else None,
        "message": f"Đã khởi tạo thành công {len(created_matches)} trận đấu vòng tròn cho Bảng {tier}!",
    }


@router.get("/tournament/status")
def get_tournament_status(db: Session = Depends(get_db)):
    """Báo cáo tiến độ giải đấu chi tiết theo từng bảng A, B, C."""
    tiers = ["A", "B", "C"]
    status_report = {}

    for t in tiers:
        total = db.query(Match).filter(Match.tier == t).count()
        done = db.query(Match).filter(Match.tier == t, Match.status == "done").count()
        running = db.query(Match).filter(Match.tier == t, Match.status == "running").count()
        pending = total - done - running

        progress_pct = round((done / total * 100), 1) if total > 0 else 0.0

        status_report[t] = {
            "total_matches": total,
            "done_matches": done,
            "running_matches": running,
            "pending_matches": pending,
            "progress_percent": progress_pct,
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


