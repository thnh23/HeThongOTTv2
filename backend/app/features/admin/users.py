"""
Admin Sub-router — Quản lý Thí sinh, Điểm Học Phần & Thẩm định Mã Nguồn
"""

import io
import zipfile
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import PlainTextResponse, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.match import Match
from app.models.submission import Submission
from app.features.admin.common import (
    UpdateUserAdminRequest,
    ChangeTierRequest,
    get_submission_files_content,
    ensure_submission_package,
    extract_files_from_package,
)

router = APIRouter(tags=["admin-users"])


@router.get("/stats")
def get_admin_stats(db: Session = Depends(get_db)):
    """Thống kê tổng quan cho Admin Dashboard (loại trừ tài khoản Admin)."""
    total_users = db.query(User).filter(User.is_admin == False).count()
    top32_count = db.query(User).filter(User.is_top32 == True, User.is_admin == False).count()

    total_submissions = db.query(Submission).join(User, Submission.user_id == User.id).filter(User.is_admin == False).count()
    valid_submissions = db.query(Submission).join(User, Submission.user_id == User.id).filter(Submission.status == "valid", User.is_admin == False).count()

    # Thống kê ván đấu
    total_matches = db.query(Match).count()
    done_matches = db.query(Match).filter(Match.status == "done").count()
    running_matches = db.query(Match).filter(Match.status == "running").count()

    return {
        "users": {
            "total": total_users,
            "top32": top32_count,
            "tier_a": db.query(User).filter(User.tier == "A", User.is_admin == False).count(),
            "tier_b": db.query(User).filter(User.tier == "B", User.is_admin == False).count(),
            "tier_c": db.query(User).filter(User.tier == "C", User.is_admin == False).count(),
            "swiss": db.query(User).filter(User.tier == "SWISS", User.is_admin == False).count(),
        },
        "submissions": {
            "total": total_submissions,
            "valid": valid_submissions,
            "invalid": total_submissions - valid_submissions,
        },
        "matches": {
            "total": total_matches,
            "done": done_matches,
            "running": running_matches,
            "pending": total_matches - done_matches - running_matches,
        },
    }


@router.get("/users")
def get_admin_users(include_admin: bool = False, db: Session = Depends(get_db)):
    """Lấy danh sách toàn bộ thí sinh cùng thành tích giải đấu (mặc định ẩn tài khoản admin)."""
    query = db.query(User)
    if not include_admin:
        query = query.filter(User.is_admin == False)
    users = query.order_by(User.registered_at.desc()).all()

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
    Họ tên, MSV, Email, Lớp, GitHub repo, Tên bot, Trạng thái Top 32, Nhận xét.
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


@router.get("/users/{user_id}/bot.py")
def get_user_bot_code(user_id: str, db: Session = Depends(get_db)):
    """Trả về trực tiếp nội dung mã nguồn bot.py của thí sinh."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy thí sinh")
    sub = db.query(Submission).filter(Submission.user_id == user.id, Submission.is_active == True).first()
    files = get_submission_files_content(sub, user)
    code = files.get("bot_py") or "# Chưa có nội dung mã nguồn bot.py"
    return PlainTextResponse(code, media_type="text/x-python; charset=utf-8")


@router.get("/users/{user_id}/report.md")
@router.get("/users/{user_id}/report.pdf")
def get_user_report(user_id: str, db: Session = Depends(get_db)):
    """Trả về trực tiếp nội dung báo cáo của thí sinh (REPORT.md / PDF)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy thí sinh")
    sub = db.query(Submission).filter(Submission.user_id == user.id, Submission.is_active == True).first()
    files = get_submission_files_content(sub, user)
    report = files.get("report_md") or "# Chưa có báo cáo"
    return PlainTextResponse(report, media_type="text/markdown; charset=utf-8")


@router.get("/users/{user_id}/download-zip")
def download_user_submission_zip(user_id: str, db: Session = Depends(get_db)):
    """Đóng gói và tải về toàn bộ tệp nộp bài (.zip) của thí sinh."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy thí sinh")
    sub = db.query(Submission).filter(Submission.user_id == user.id, Submission.is_active == True).first()
    files = get_submission_files_content(sub, user)

    # Đóng gói zip in-memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        if files.get("bot_py"):
            zf.writestr("bot.py", files["bot_py"])
        if files.get("report_md"):
            zf.writestr("REPORT.md", files["report_md"])
        if files.get("git_log"):
            zf.writestr("git_log.txt", files["git_log"])
        if files.get("prompts_md"):
            zf.writestr("PROMPTS.md", files["prompts_md"])

    zip_buffer.seek(0)
    filename = f"{user.student_id or user.id}_submission.zip"
    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )

