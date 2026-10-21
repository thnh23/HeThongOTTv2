"""
Submit Router — Cổng nộp bài và kiểm thử tự động
================================================
Endpoints:
  POST /api/submit                ← Upload file zip, giải nén & validate
  GET  /api/submit/history        ← Danh sách các lần nộp của thí sinh
  GET  /api/submit/{id}/status    ← Trạng thái chi tiết của 1 lần nộp
  POST /api/submit/test-run/{id}  ← Chạy thử bot vừa nộp với GreedyBot
"""

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
from app.routers.auth import get_current_user
from app.services.validator import validate_submission_zip
from app.services.sandbox import load_bot_from_file
from app.services.starter_bots.greedy_bot import choose_move as greedy_choose_move
from app.services.engine.referee import play_match

router = APIRouter(prefix="/api/submit", tags=["submit"])


# ── Pydantic Schemas ────────────────────────────

class ValidationDetailSchema(BaseModel):
    bot_py: bool = False
    choose_move_fn: bool = False
    prompts_md: bool = False
    chat_history: bool = False
    report_md: bool = False
    git_log: bool = False


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

@router.post("", response_model=SubmissionResponse, status_code=status.HTTP_201_CREATED)
async def submit_package(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Nộp gói bài làm (.zip).
    Tự động giải nén, kiểm tra cấu trúc (T08) và quét an ninh API key (T09).
    """
    if not file.filename.lower().endswith(".zip"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chỉ chấp nhận file có định dạng nén .ZIP",
        )

    sub_id = str(uuid.uuid4())
    sub_dir = os.path.abspath(os.path.join(settings.STORAGE_PATH, "submissions", sub_id))
    os.makedirs(sub_dir, exist_ok=True)

    zip_file_path = os.path.join(sub_dir, "package.zip")
    extract_dir = os.path.join(sub_dir, "extracted")

    try:
        with open(zip_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi lưu file nộp: {str(e)}",
        )

    # Thực hiện validation
    user_tier = current_user.tier or "A"
    val_res = validate_submission_zip(zip_file_path, extract_dir, tier=user_tier)

    # Nếu hợp lệ, chuyển các bài nộp cũ thành is_active=False
    if val_res.is_valid:
        db.query(Submission).filter(
            Submission.user_id == current_user.id,
            Submission.is_active == True,
        ).update({"is_active": False})

    submission = Submission(
        id=sub_id,
        user_id=current_user.id,
        status="valid" if val_res.is_valid else "invalid",
        zip_path=zip_file_path,
        is_active=val_res.is_valid,
        validation=val_res.to_dict(),
        commit_count=val_res.commit_count,
    )
    if val_res.commit_count > 0:
        current_user.commit_count = max(current_user.commit_count or 0, val_res.commit_count)

    db.add(submission)
    db.commit()
    db.refresh(submission)

    return SubmissionResponse(
        id=submission.id,
        user_id=submission.user_id,
        status=submission.status,
        is_valid=val_res.is_valid,
        is_active=submission.is_active,
        validation=val_res.details,
        errors=val_res.errors,
        warnings=val_res.warnings,
        commit_count=val_res.commit_count,
        test_run_result=submission.test_run_result,
        submitted_at=submission.submitted_at,
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
