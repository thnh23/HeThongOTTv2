"""
Feature Auth — Router & Endpoints for Registration, Login and Profile
"""

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.features.auth.schemas import (
    TokenResponse,
    UserResponse,
    UpdateProfileRequest,
    ChangePasswordRequest,
)
from app.features.auth.service import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])



@router.post("/login", response_model=TokenResponse)
def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db),
):
    login_id = form_data.username.strip() if form_data.username else ""
    user = db.query(User).filter(
        (User.email.ilike(login_id)) | (User.student_id == login_id)
    ).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mật khẩu không chính xác",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản đã bị vô hiệu hóa",
        )

    access_token = create_access_token(data={"sub": user.id})
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Lấy thông tin tài khoản hiện tại từ JWT token."""
    return current_user


@router.put("/profile", response_model=UserResponse)
def update_my_profile(
    req: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cho phép sinh viên cập nhật thông tin cá nhân: Họ tên, MSSV, Lớp, GitHub repo, Tên Bot."""
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy người dùng",
        )

    if req.name is not None:
        user.name = req.name.strip()
    if req.student_id is not None:
        user.student_id = req.student_id.strip()
    if req.class_name is not None:
        user.class_name = req.class_name.strip()
    if req.github_repo_url is not None:
        user.github_repo_url = req.github_repo_url.strip()
    if req.bot_name is not None:
        user.bot_name = req.bot_name.strip()

    db.commit()
    db.refresh(user)
    return user


@router.post("/change-password")
def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Đổi mật khẩu tài khoản hiện tại."""
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user or not verify_password(req.old_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu hiện tại không chính xác",
        )

    if len(req.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu mới phải có tối thiểu 6 ký tự",
        )

    user.hashed_password = hash_password(req.new_password)
    db.commit()
    return {"message": "Đổi mật khẩu thành công"}

