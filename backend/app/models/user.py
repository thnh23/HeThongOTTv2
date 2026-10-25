"""
User Model — SQLAlchemy ORM (Swiss Tournament Standard)
"""

import uuid
from typing import Optional
from datetime import datetime
from sqlalchemy import String, Integer, Float, DateTime, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    email: Mapped[str] = mapped_column(String(256), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(256), nullable=False)

    # Thông tin sinh viên & đề án giải đấu
    student_id: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)
    class_name: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    github_repo_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    bot_name: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    # Trường tương thích ngược
    tier: Mapped[Optional[str]] = mapped_column(String(16), nullable=True, default="SWISS")
    test_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Thống kê giải đấu Thụy Sĩ (Swiss Tournament 13 Vòng)
    is_top32: Mapped[bool] = mapped_column(Boolean, default=False)
    swiss_wins: Mapped[int] = mapped_column(Integer, default=0)
    swiss_points: Mapped[int] = mapped_column(Integer, default=0)
    buchholz: Mapped[float] = mapped_column(Float, default=0.0)
    sonneborn_berger: Mapped[float] = mapped_column(Float, default=0.0)

    # Giám sát Liêm chính học thuật & AI (MOSS + Git commits)
    commit_count: Mapped[int] = mapped_column(Integer, default=0)
    moss_similarity: Mapped[float] = mapped_column(Float, default=0.0)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Quyền & Trạng thái
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    registered_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    @property
    def projected_grade_10(self) -> str:
        """Điểm học phần đề xuất theo lũy tiến số trận thắng 13 vòng Swiss (Thang 10)."""
        if self.is_top32:
            return "10.0 (A+)"
        wins = self.swiss_wins or 0
        if wins >= 10:
            return "9.5"
        elif wins >= 8:
            return "9.0"
        elif wins >= 6:
            return "8.5"
        elif wins >= 4:
            return "7.5"
        return "6.5 – 7.0"

    def __repr__(self):
        return f"<User {self.email} student_id={self.student_id}>"
