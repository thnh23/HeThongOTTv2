"""
Submit Router — Cổng nộp bài và kiểm thử tự động
================================================
Endpoints:
  POST /api/submit                ← Upload file zip, giải nén & validate
  GET  /api/submit/history        ← Danh sách các lần nộp của thí sinh
  GET  /api/submit/{id}/status    ← Trạng thái chi tiết của 1 lần nộp
  POST /api/submit/test-run/{id}  ← Chạy thử bot vừa nộp với GreedyBot
"""

import json
import os
import shutil
import uuid
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.submission import Submission
from app.routers.auth import get_current_user, get_optional_current_user
from app.routers.admin.common import SWISS_STORAGE_DIR
from app.services.validator import validate_submission_zip, check_choose_move_in_code
from app.services.sandbox import load_bot_from_file
from app.services.starter_bots.greedy_bot import choose_move as greedy_choose_move
from app.services.starter_bots.random_bot import choose_move as random_choose_move
from app.services.starter_bots.obstacle_bot import choose_move as obstacle_choose_move
from app.services.engine.referee import play_match

router = APIRouter(prefix="/api/submit", tags=["submit"])



# ── Pydantic Schemas ────────────────────────────

class BenchmarkObstacleRequest(BaseModel):
    student_id: Optional[str] = None
    submission_id: Optional[str] = None
    bot_code: Optional[str] = None
    obstacles: Optional[List[str]] = None


class BenchmarkObstacleResponse(BaseModel):
    status: str
    winner: Optional[str]
    end_code: str
    total_moves: int
    duration_ms: int
    average_move_time_ms: float
    max_move_time_ms: int
    is_latency_compliant: bool
    is_obstacle_compliant: bool
    obstacles: List[str]
    reason: str
    bot_name: str
    opponent_name: str
    replay: dict


class BenchmarkSandboxRequest(BaseModel):
    mode: str = "standard"  # "standard" | "obstacle"
    opponent: str = "greedy"  # "greedy" | "random" | "obstacle"
    bot_code: str
    obstacles: Optional[List[str]] = None


class BenchmarkSandboxResponse(BaseModel):
    status: str
    mode: str
    winner: Optional[str]
    end_code: str
    total_moves: int
    duration_ms: int
    average_move_time_ms: float
    max_move_time_ms: int
    is_latency_compliant: bool
    is_obstacle_compliant: bool
    obstacles: List[str]
    reason: str
    bot_name: str
    opponent_name: str
    replay: dict


class ValidationDetailSchema(BaseModel):
    bot_py: bool = False
    choose_move_fn: bool = False
    report_md: bool = False
    git_log: bool = False

    class Config:
        extra = "ignore"



class SubmissionResponse(BaseModel):
    id: str
    user_id: str
    status: str
    is_valid: bool
    is_active: bool
    validation: dict
    errors: List[str]
    warnings: List[str]
    commit_count: int = 0
    test_run_result: Optional[dict] = None
    submitted_at: datetime

    class Config:
        orm_mode = True


class TestRunResponse(BaseModel):
    submission_id: str
    status: str          # 'win', 'loss', 'draw', 'error'
    winner: Optional[str]
    end_code: str
    total_moves: int
    duration_ms: int
    reason: str


# ── Routes ──────────────────────────────────────

@router.get("/config")
def get_submission_config():
    """Lấy cấu hình phương thức nộp bài chính thức của giải đấu (Google Form + GitHub Template)."""
    return {
        "submission_mode": "google_form",
        "google_form_url": settings.GOOGLE_FORM_URL,
        "github_template_url": settings.GITHUB_TEMPLATE_URL,
        "form_fields": [
            {"id": "fullname", "label": "Họ và tên", "description": "Họ tên đầy đủ theo danh sách lớp UET"},
            {"id": "student_id", "label": "Mã sinh viên (MSSV)", "description": "8 chữ số (ví dụ: 22028100)"},
            {"id": "class_name", "label": "Lớp học phần", "description": "Lớp môn học Lập trình mạng (INT3304)"},
            {"id": "github_repo_url", "label": "Link GitHub Repository", "description": "https://github.com/<username>/ottv2-<MaSV> (Public, tạo từ Template chuẩn)"},
        ],
        "announcement": (
            "Giải đấu thống nhất phương thức nộp bài: Thí sinh tạo repo cá nhân từ GitHub Template của BTC, "
            "kiểm tra xanh toàn bộ bài test CI/CD tự động, và điền link repo vào Google Form. "
            "Hệ thống KHÔNG tự điền bot hộ thí sinh; bài thi không hợp lệ hoặc không nộp sẽ bị xử thua T1."
        ),
    }


@router.post("")
async def submit_package():
    """
    Cổng nộp file .ZIP trực tiếp qua web đã đóng để chuyển sang hình thức thống nhất:
    GitHub Template + Google Form thu link (Trụ cột 1).
    """
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Hệ thống đã chuyển sang hình thức nộp qua Google Form và GitHub Repository. Vui lòng nộp link repo qua Google Form chính thức của Ban tổ chức.",
    )


@router.get("/history", response_model=List[SubmissionResponse])

def get_submission_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lấy danh sách các lần nộp bài của người dùng hiện tại."""
    subs = (
        db.query(Submission)
        .filter(Submission.user_id == current_user.id)
        .order_by(Submission.submitted_at.desc())
        .all()
    )
    results = []
    for s in subs:
        val_data = s.validation or {}
        results.append(
            SubmissionResponse(
                id=s.id,
                user_id=s.user_id,
                status=s.status,
                is_valid=(s.status == "valid"),
                is_active=s.is_active,
                validation=val_data.get("details", {}),
                errors=val_data.get("errors", []),
                warnings=val_data.get("warnings", []),
                commit_count=s.commit_count or (val_data.get("commit_count") or 0),
                test_run_result=s.test_run_result,
                submitted_at=s.submitted_at,
            )
        )
    return results


@router.get("/{submission_id}/status", response_model=SubmissionResponse)
def get_submission_status(
    submission_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Xem chi tiết và kết quả kiểm tra của 1 lần nộp."""
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy bài nộp",
        )
    if sub.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền xem bài nộp này",
        )

    val_data = sub.validation or {}
    return SubmissionResponse(
        id=sub.id,
        user_id=sub.user_id,
        status=sub.status,
        is_valid=(sub.status == "valid"),
        is_active=sub.is_active,
        validation=val_data.get("details", {}),
        errors=val_data.get("errors", []),
        warnings=val_data.get("warnings", []),
        commit_count=sub.commit_count or (val_data.get("commit_count") or 0),
        test_run_result=sub.test_run_result,
        submitted_at=sub.submitted_at,
    )


@router.post("/test-run/{submission_id}", response_model=TestRunResponse)
def test_run_submission(
    submission_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Chạy thử bot vừa nộp với GreedyBot để thí sinh kiểm tra trước khi đấu giải.
    """
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy bài nộp",
        )
    if sub.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền thao tác trên bài nộp này",
        )
    if sub.status != "valid":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Gói nộp không hợp lệ, không thể chạy thử bot",
        )

    val_data = sub.validation or {}
    extracted_path = val_data.get("extracted_path")
    if not extracted_path or not os.path.exists(extracted_path):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Không tìm thấy thư mục bot đã giải nén",
        )

    bot_file = os.path.join(extracted_path, "bot.py")
    if not os.path.exists(bot_file):
        # Tìm bot.py trong subfolders nếu có
        for root, _, files in os.walk(extracted_path):
            if "bot.py" in files:
                bot_file = os.path.join(root, "bot.py")
                break

    try:
        user_bot_fn = load_bot_from_file(bot_file)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Lỗi khi load bot.py: {str(e)}",
        )

    # Đấu thử 1 ván: UserBot (White) vs GreedyBot (Black)
    match_res = play_match(
        bot_white_fn=user_bot_fn,
        bot_black_fn=greedy_choose_move,
        bot_white_name=f"Bot của {current_user.name}",
        bot_black_name="GreedyBot (Mẫu)",
        timeout_sec=2.0,
        max_moves=100,
    )

    if match_res.winner == 'W':
        run_status = "win"
    elif match_res.winner == 'B':
        run_status = "loss"
    elif match_res.winner is None:
        run_status = "draw"
    else:
        run_status = "error"

    test_result_dict = {
        "status": run_status,
        "winner": match_res.winner,
        "end_code": match_res.end_code,
        "total_moves": match_res.total_moves,
        "duration_ms": match_res.duration_ms,
        "reason": match_res.reason,
    }

    sub.test_run_result = test_result_dict
    db.commit()

    return TestRunResponse(
        submission_id=submission_id,
        status=run_status,
        winner=match_res.winner,
        end_code=match_res.end_code,
        total_moves=match_res.total_moves,
        duration_ms=match_res.duration_ms,
        reason=match_res.reason,
    )


# ── Public Student Submission Lookup ─────────────

@router.get("/lookup")
@router.get("/lookup/{student_id}")
def lookup_student_submission(student_id: str, db: Session = Depends(get_db)):
    """
    Cổng tra cứu công khai bài thi dành cho thí sinh:
    Nhập Mã Sinh Viên (MSSV) để xem tình trạng thẩm định bài nộp,
    mã commit hash chốt, thời gian commit, và hướng dẫn sửa lỗi nếu có.
    """
    s_clean = student_id.strip() if student_id else ""
    if not s_clean:
        raise HTTPException(status_code=400, detail="Vui lòng cung cấp Mã Sinh Viên để tra cứu")

    # Tìm user theo student_id hoặc email
    user = (
        db.query(User)
        .filter((User.student_id == s_clean) | (User.email == s_clean))
        .first()
    )
    if not user:
        return {
            "found": False,
            "has_submission": False,
            "student_id": s_clean,
            "name": None,
            "class_name": None,
            "github_repo_url": None,
            "status": "not_found",
            "message": f"Chưa tìm thấy thông tin thí sinh với MSSV '{s_clean}'. Hãy kiểm tra lại MSSV hoặc biểu mẫu Google Form bạn đã nộp.",
        }

    # Tìm submission active của user
    sub = (
        db.query(Submission)
        .filter(Submission.user_id == user.id)
        .order_by(Submission.submitted_at.desc())
        .first()
    )

    if not sub:
        return {
            "found": True,
            "has_submission": False,
            "student_id": user.student_id,
            "name": user.name,
            "class_name": user.class_name,
            "github_repo_url": user.github_repo_url,
            "status": "not_submitted",
            "message": "Thí sinh có tên trong danh sách nhưng chưa ghi nhận bài nộp hoặc link repo.",
        }

    val = sub.validation or {}
    test_run = sub.test_run_result or {}

    # Che bớt email để bảo vệ thông tin riêng tư
    masked_email = user.email
    if "@" in user.email:
        u_part, domain = user.email.split("@", 1)
        if len(u_part) > 3:
            masked_email = u_part[:2] + "***" + u_part[-1:] + "@" + domain

    return {
        "found": True,
        "has_submission": True,
        "student_id": user.student_id,
        "name": user.name,
        "masked_email": masked_email,
        "class_name": user.class_name,
        "bot_name": user.bot_name or "OTT_Bot",
        "github_repo_url": sub.github_repo_url or user.github_repo_url,
        "status": sub.status,
        "is_valid": sub.status == "valid",
        "commit_hash": test_run.get("checked_out_commit"),
        "commit_date": test_run.get("commit_date"),
        "commit_count": sub.commit_count,
        "validation_details": val.get("details", {
            "bot_py": False,
            "choose_move_fn": False,
            "report_md": False,
            "git_log": False,
        }),
        "errors": val.get("errors", []),
        "warnings": val.get("warnings", []),
        "submitted_at": sub.submitted_at,
    }


# ── Top 32 Obstacle Sandbox Benchmark ─────────────

def get_default_top32_obstacles() -> List[str]:
    """Lấy danh sách ô chướng ngại vật mặc định từ top32_config.json."""
    config_file = os.path.join(SWISS_STORAGE_DIR, "top32_config.json")
    default_obstacles = ["d4", "d6", "f4", "f6", "e5"]
    if os.path.exists(config_file):
        try:
            with open(config_file, "r", encoding="utf-8") as f:
                saved = json.load(f)
                return saved.get("obstacles", default_obstacles)
        except Exception:
            pass
    return default_obstacles


@router.post("/benchmark-obstacle", response_model=BenchmarkObstacleResponse)
def run_benchmark_obstacle(
    req: BenchmarkObstacleRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """
    Sandbox Benchmark API dành cho Top 32 Vòng Chung Kết:
    - Kiểm thử Bot v2 đối đầu ObstacleBot trên bàn cờ có ô chướng ngại vật cấm.
    - Đo lường độ trễ tính toán trung bình (yêu cầu <= 200ms/nước).
    - Thẩm định tính tuân thủ ô cản (bot có phạm luật lao vào ô cấm không).
    - Trả về toàn bộ dữ liệu replay trực quan (obstacles, moves, board states).
    """
    target_user = current_user
    if not target_user and req.student_id:
        s_clean = req.student_id.strip()
        target_user = (
            db.query(User)
            .filter((User.student_id == s_clean) | (User.email == s_clean))
            .first()
        )

    # 1. Xác định bot thí sinh
    temp_bot_file = None
    candidate_fn = None
    bot_name = "Thí sinh"

    try:
        if req.bot_code and req.bot_code.strip():
            # Chạy từ mã nguồn trực tiếp (IDE / Web snippet)
            temp_dir = os.path.join(settings.STORAGE_PATH, "submissions", "temp")
            os.makedirs(temp_dir, exist_ok=True)
            temp_bot_file = os.path.join(temp_dir, f"bot_bench_{uuid.uuid4().hex[:8]}.py")
            with open(temp_bot_file, "w", encoding="utf-8") as f:
                f.write(req.bot_code)

            if not check_choose_move_in_code(temp_bot_file):
                raise HTTPException(
                    status_code=400,
                    detail="Mã nguồn thiếu định nghĩa hàm 'def choose_move(state)'.",
                )
            candidate_fn = load_bot_from_file(temp_bot_file)
            bot_name = (target_user.name if target_user else "Bot v2 Snippet")
        elif req.submission_id:
            sub = db.query(Submission).filter(Submission.id == req.submission_id).first()
            if not sub or not sub.extracted_path:
                raise HTTPException(status_code=404, detail="Không tìm thấy bản nộp.")
            bot_path = os.path.join(sub.extracted_path, "bot.py")
            if not os.path.exists(bot_path):
                raise HTTPException(status_code=400, detail="Không tìm thấy bot.py trong bản nộp.")
            candidate_fn = load_bot_from_file(bot_path)
            bot_name = f"Bản nộp #{sub.id[:8]}"
        elif target_user:
            # Ưu tiên repo đã clone
            repo_bot = os.path.join(
                settings.STORAGE_PATH, "submissions", "repos", str(target_user.student_id or ""), "bot.py"
            )
            if os.path.exists(repo_bot):
                candidate_fn = load_bot_from_file(repo_bot)
                bot_name = target_user.bot_name or f"Bot của {target_user.name}"
            else:
                # Kiểm tra submission gần nhất
                sub = (
                    db.query(Submission)
                    .filter(Submission.user_id == target_user.id)
                    .order_by(Submission.submitted_at.desc())
                    .first()
                )
                if sub and sub.extracted_path:
                    bot_path = os.path.join(sub.extracted_path, "bot.py")
                    if os.path.exists(bot_path):
                        candidate_fn = load_bot_from_file(bot_path)
                        bot_name = target_user.bot_name or f"Bot của {target_user.name}"

        # Fallback an toàn nếu chưa có bot thực tế
        if candidate_fn is None:
            candidate_fn = greedy_choose_move
            bot_name = "GreedyBot (Chế độ Demo Mẫu)"

        # 2. Xác định danh sách ô chướng ngại vật
        if req.obstacles and len(req.obstacles) > 0:
            obstacles_list = [str(o).strip().lower() for o in req.obstacles if str(o).strip()]
        else:
            obstacles_list = get_default_top32_obstacles()

        # 3. Chạy trận đấu Benchmark với ObstacleBot
        match_res = play_match(
            bot_white_fn=candidate_fn,
            bot_black_fn=obstacle_choose_move,
            bot_white_name=bot_name,
            bot_black_name="ObstacleBot (Mẫu Top 32)",
            timeout_sec=2.0,
            max_moves=200,
            obstacles=obstacles_list,
        )

        # 4. Thống kê chỉ số hiệu năng
        white_moves = [m for m in match_res.moves if m.get("player") == "W"]
        if white_moves:
            durations = [int(m.get("duration_ms", 0)) for m in white_moves]
            avg_ms = round(sum(durations) / len(durations), 2)
            max_ms = max(durations)
        else:
            avg_ms = 0.0
            max_ms = 0

        # Kiểm tra tính tuân thủ ô cản
        is_obstacle_compliant = True
        for m in match_res.moves:
            if m.get("player") == "W" and "chướng ngại vật" in str(m.get("error", "")).lower():
                is_obstacle_compliant = False
                break
        if "chướng ngại vật" in match_res.reason.lower() and match_res.winner == "B":
            is_obstacle_compliant = False

        is_latency_compliant = (avg_ms <= 200.0)

        return BenchmarkObstacleResponse(
            status="finished",
            winner=match_res.winner,
            end_code=match_res.end_code,
            total_moves=match_res.total_moves,
            duration_ms=match_res.duration_ms,
            average_move_time_ms=avg_ms,
            max_move_time_ms=max_ms,
            is_latency_compliant=is_latency_compliant,
            is_obstacle_compliant=is_obstacle_compliant,
            obstacles=obstacles_list,
            reason=match_res.reason,
            bot_name=bot_name,
            opponent_name="ObstacleBot (Mẫu Top 32)",
            replay=match_res.to_replay_dict(),
        )

    finally:
        if temp_bot_file and os.path.exists(temp_bot_file):
            try:
                os.remove(temp_bot_file)
            except Exception:
                pass


@router.post("/benchmark-sandbox", response_model=BenchmarkSandboxResponse)
def run_benchmark_sandbox(
    req: BenchmarkSandboxRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Sân Đấu Thử Nghiệm Sandbox Lab Dành Cho Thí Sinh:
    - 100% Thử nghiệm trực tiếp bằng cách dán mã nguồn bot.py (hàm choose_move).
    - Hỗ trợ 2 chế độ:
        1. 'standard': Bàn cờ chuẩn 9x9 (Vòng Swiss) không ô cản, đối đầu GreedyBot hoặc RandomBot.
        2. 'obstacle': Bàn cờ ô cản 9x9 (Top 32) với các chướng ngại vật cấm, đối đầu ObstacleBot.
    - Thẩm định độ trễ tính toán (<= 200ms) và luật di chuyển.
    - Trả về toàn bộ replay bàn cờ để tua lại trực quan.
    """
    if not req.bot_code or not req.bot_code.strip():
        raise HTTPException(
            status_code=400,
            detail="Vui lòng dán mã nguồn bot.py có định nghĩa hàm 'def choose_move(state)'.",
        )

    temp_bot_file = None
    try:
        temp_dir = os.path.join(settings.STORAGE_PATH, "submissions", "temp")
        os.makedirs(temp_dir, exist_ok=True)
        temp_bot_file = os.path.join(temp_dir, f"bot_sandbox_{uuid.uuid4().hex[:8]}.py")
        with open(temp_bot_file, "w", encoding="utf-8") as f:
            f.write(req.bot_code)

        if not check_choose_move_in_code(temp_bot_file):
            raise HTTPException(
                status_code=400,
                detail="Mã nguồn thiếu định nghĩa hàm 'def choose_move(state)'. Vui lòng kiểm tra lại cấu trúc bot.",
            )

        candidate_fn = load_bot_from_file(temp_bot_file)
        bot_name = current_user.name if current_user else "Thí sinh (Dán Code)"

        mode = req.mode.lower() if req.mode else "standard"
        if mode == "obstacle":
            if req.obstacles and len(req.obstacles) > 0:
                obstacles_list = [str(o).strip().lower() for o in req.obstacles if str(o).strip()]
            else:
                obstacles_list = get_default_top32_obstacles()
            opponent_fn = obstacle_choose_move
            opponent_name = "ObstacleBot (Mẫu Top 32)"
        else:
            mode = "standard"
            obstacles_list = []
            opp = (req.opponent or "greedy").lower()
            if opp == "random":
                opponent_fn = random_choose_move
                opponent_name = "RandomBot (Ngẫu Nhiên)"
            else:
                opponent_fn = greedy_choose_move
                opponent_name = "GreedyBot (Ăn Quân Chuẩn)"

        match_res = play_match(
            bot_white_fn=candidate_fn,
            bot_black_fn=opponent_fn,
            bot_white_name=bot_name,
            bot_black_name=opponent_name,
            timeout_sec=2.0,
            max_moves=200,
            obstacles=obstacles_list,
        )

        white_moves = [m for m in match_res.moves if m.get("player") == "W"]
        if white_moves:
            durations = [int(m.get("duration_ms", 0)) for m in white_moves]
            avg_ms = round(sum(durations) / len(durations), 2)
            max_ms = max(durations)
        else:
            avg_ms = 0.0
            max_ms = 0

        is_obstacle_compliant = True
        if mode == "obstacle":
            for m in match_res.moves:
                if m.get("player") == "W" and "chướng ngại vật" in str(m.get("error", "")).lower():
                    is_obstacle_compliant = False
                    break
            if "chướng ngại vật" in match_res.reason.lower() and match_res.winner == "B":
                is_obstacle_compliant = False

        is_latency_compliant = (avg_ms <= 200.0)

        return BenchmarkSandboxResponse(
            status="finished",
            mode=mode,
            winner=match_res.winner,
            end_code=match_res.end_code,
            total_moves=match_res.total_moves,
            duration_ms=match_res.duration_ms,
            average_move_time_ms=avg_ms,
            max_move_time_ms=max_ms,
            is_latency_compliant=is_latency_compliant,
            is_obstacle_compliant=is_obstacle_compliant,
            obstacles=obstacles_list,
            reason=match_res.reason,
            bot_name=bot_name,
            opponent_name=opponent_name,
            replay=match_res.to_replay_dict(),
        )

    finally:
        if temp_bot_file and os.path.exists(temp_bot_file):
            try:
                os.remove(temp_bot_file)
            except Exception:
                pass


