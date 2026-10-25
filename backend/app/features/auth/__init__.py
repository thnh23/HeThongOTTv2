"""
Feature Auth Package
"""

from app.features.auth.router import router
from app.features.auth.service import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    get_optional_current_user,
    require_admin,
)
from app.features.auth.schemas import (
    LoginRequest,
    TokenResponse,
    UserResponse,
    UpdateProfileRequest,
    ChangePasswordRequest,
)

__all__ = [
    "router",
    "hash_password",
    "verify_password",
    "create_access_token",
    "get_current_user",
    "get_optional_current_user",
    "require_admin",
    "LoginRequest",
    "TokenResponse",
    "UserResponse",
    "UpdateProfileRequest",
    "ChangePasswordRequest",
]

