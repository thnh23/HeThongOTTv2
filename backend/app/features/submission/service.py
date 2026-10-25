"""
Feature Submission — Domain Logic for Student Submissions & Lookup
"""

import os
from typing import Any
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User
from app.models.submission import Submission
from app.services.sandbox import load_bot_from_file
from app.services.starter_bots.greedy_bot import choose_move as greedy_choose_move
from app.services.engine.referee import play_match
from app.features.submission.schemas import TestRunResponse, SubmissionLookupResponse


def get_submission_config() -> dict[str, Any]:
    """Cung cấp thông tin chuẩn hóa về quy trình nộp bài chính thức qua Google Form & GitHub Template."""
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


def lookup_student_submission(student_id: str, db: Session) -> dict[str, Any]:
    """
    Tra cứu công khai thông tin thẩm định bài nộp của thí sinh theo MSSV hoặc Email.
    Bảo vệ quyền riêng tư bằng cách che một phần địa chỉ email.
    """
    s_clean = student_id.strip() if student_id else ""
    if not s_clean:
        raise HTTPException(status_code=400, detail="Vui lòng cung cấp Mã Sinh Viên để tra cứu")

    user = (
        db.query(User)
        .filter(
            (User.student_id == s_clean) | (User.email == s_clean),
            User.is_admin == False,
        )
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


def execute_test_run(submission_id: str, current_user: User, db: Session) -> TestRunResponse:
    """Chạy thử nghiệm bot vừa nộp với GreedyBot mẫu trên bàn cờ tiêu chuẩn."""
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

    match_res = play_match(
        bot_white_fn=user_bot_fn,
        bot_black_fn=greedy_choose_move,
        bot_white_name=f"Bot của {current_user.name}",
        bot_black_name="GreedyBot (Mẫu)",
        timeout_sec=2.0,
        max_moves=100,
    )

    if match_res.winner == "W":
        run_status = "win"
    elif match_res.winner == "B":
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
