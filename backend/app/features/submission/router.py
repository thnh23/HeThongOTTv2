"""
Feature Submission — Router & Endpoints for Bot Submissions and Lookup
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.submission import Submission
from app.features.auth.service import get_current_user
from app.features.submission.schemas import (
    SubmissionResponse,
    TestRunResponse,
)
from app.features.submission.service import (
    get_submission_config,
    lookup_student_submission,
    execute_test_run,
)

router = APIRouter(prefix="/api/submit", tags=["submit"])


@router.get("/config")
def get_config():
    """Lấy cấu hình phương thức nộp bài chính thức của giải đấu (Google Form + GitHub Template)."""
    return get_submission_config()


@router.post("")
async def submit_package():
    """Cổng nộp zip qua web đã đóng. Hướng dẫn nộp qua Google Form và GitHub Template."""
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Hệ thống đã chuyển sang hình thức nộp qua Google Form và GitHub Repository. Vui lòng nộp link repo qua Google Form chính thức của Ban tổ chức.",
    )


@router.get("/history", response_model=list[SubmissionResponse])
def get_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lấy danh sách các lần nộp bài của thí sinh hiện tại."""
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
def get_status(
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
def test_run(
    submission_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Chạy thử bot vừa nộp với GreedyBot để thí sinh kiểm tra trước khi thi đấu."""
    return execute_test_run(submission_id, current_user, db)


@router.get("/lookup")
@router.get("/lookup/{student_id}")
def lookup(student_id: str, db: Session = Depends(get_db)):
    """Cổng tra cứu công khai tình trạng thẩm định bài nộp theo MSSV."""
    return lookup_student_submission(student_id, db)
