"""
Feature Auth — Pydantic V2 Schemas for Authentication & User Profile
"""

from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict


class LoginRequest(BaseModel):

    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    student_id: str | None = None
    class_name: str | None = None
    github_repo_url: str | None = None
    bot_name: str | None = None
    tier: str | None = None
    test_score: float | None = None
    is_top32: bool = False
    swiss_wins: int = 0
    swiss_points: int = 0
    buchholz: float = 0.0
    sonneborn_berger: float = 0.0
    commit_count: int = 0
    moss_similarity: float = 0.0
    notes: str | None = None
    projected_grade_10: str | None = "6.5 – 7.0"
    is_admin: bool = False
    registered_at: datetime | None = None

    class Config:
        orm_mode = True
        from_attributes = True


class UpdateProfileRequest(BaseModel):
    name: str | None = None
    student_id: str | None = None
    class_name: str | None = None
    github_repo_url: str | None = None
    bot_name: str | None = None


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

