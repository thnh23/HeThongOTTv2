"""
Admin Sub-router — Quản lý Thí sinh, Điểm Học Phần & Thẩm định Mã Nguồn
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.match import Match
from app.models.submission import Submission
from app.routers.admin.common import (
    ReviewGradeRequest,
    UpdateUserAdminRequest,
    ChangeTierRequest,
    calculate_final_score,
    get_submission_files_content,
    ensure_submission_package,
    extract_files_from_package,
    TOURNAMENT_WEIGHTS,
)

router = APIRouter(tags=["admin-users"])


@router.get("/stats")
def get_admin_stats(db: Session = Depends(get_db)):
    """Thống kê tổng quan cho Admin Dashboard."""
    total_users = db.query(User).count()
    top32_count = db.query(User).filter(User.is_top32 == True).count()

    total_submissions = db.query(Submission).count()
    valid_submissions = db.query(Submission).filter(Submission.status == "valid").count()

    # Thống kê ván đấu
    total_matches = db.query(Match).count()
    done_matches = db.query(Match).filter(Match.status == "done").count()
    running_matches = db.query(Match).filter(Match.status == "running").count()

    # Thống kê điểm danh & rà soát bài nộp
    reviewed_count = db.query(User).filter(
        (User.score_ai_profile > 0) | (User.score_interview > 0) | (User.score_report > 0)
    ).count()

    return {
        "users": {
            "total": total_users,
            "top32": top32_count,
            "tier_a": db.query(User).filter(User.tier == "A").count(),
            "tier_b": db.query(User).filter(User.tier == "B").count(),
            "tier_c": db.query(User).filter(User.tier == "C").count(),
            "swiss": db.query(User).filter(User.tier == "SWISS").count(),
        },
        "submissions": {
            "total": total_submissions,
            "valid": valid_submissions,
            "invalid": total_submissions - valid_submissions,
        },
        "reviews": {
            "reviewed": reviewed_count,
            "pending": max(0, total_users - reviewed_count),
        },
        "matches": {
            "total": total_matches,
            "done": done_matches,
            "running": running_matches,
            "pending": total_matches - done_matches - running_matches,
        },
    }


@router.get("/users")
def get_admin_users(db: Session = Depends(get_db)):
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
    Cho phép Admin chỉnh sửa toàn diện thông tin thí sinh:
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
    """Endpoint cập nhật Tier (tương thích ngược)."""
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
    Chấm điểm Hội đồng:
      - Hồ sơ AI (Prompt log) (0-100)
      - Vấn đáp hiểu code Top 32 (0-100)
      - Báo cáo thuật toán (0-100)
      - Điểm hiệu quả bot
      - Ghi chú nhận xét của Hội đồng
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


@router.get("/submissions/{submission_id}/files")
def view_submission_files(submission_id: str, db: Session = Depends(get_db)):
    """
    Trích xuất và đọc nội dung các file trong gói bài làm của sinh viên:
    bot.py (mã nguồn), REPORT.md (ý tưởng chiến thuật) và git_log.txt (lịch sử commit).
    Chấp nhận cả submission_id lẫn user_id.
    """
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        sub = db.query(Submission).filter(Submission.user_id == submission_id, Submission.is_active == True).first()

    user = None
    if sub:
        user = db.query(User).filter(User.id == sub.user_id).first()
    else:
        user = db.query(User).filter(User.id == submission_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Không tìm thấy bài nộp hoặc thí sinh")

    files_content = get_submission_files_content(sub, user)

    return {
        "submission_id": sub.id if sub else (user.id if user else ""),
        "user_id": user.id if user else (sub.user_id if sub else ""),
        "user_name": user.name if user else "Unknown",
        "user_email": user.email if user else "",
        "submitted_at": sub.submitted_at if sub else None,
        "files": files_content,
    }


@router.get("/users/{user_id}/submission-files")
def view_user_submission_files(user_id: str, db: Session = Depends(get_db)):
    """Alias cho /submissions/{id}/files để đảm bảo tương thích ngược 100%."""
    return view_submission_files(user_id, db)
