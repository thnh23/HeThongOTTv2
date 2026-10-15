"""
User Model — SQLAlchemy ORM
"""

import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Float, DateTime, Boolean, Enum as SAEnum
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

    # Phân bảng
    tier: Mapped[str] = mapped_column(
        SAEnum("A", "B", "C", name="tier_enum"), nullable=True
    )
    test_score: Mapped[float] = mapped_column(Float, nullable=True)

    # Điểm thành phần
    score_bot: Mapped[float] = mapped_column(Float, default=0.0)
    score_ai_profile: Mapped[float] = mapped_column(Float, default=0.0)
    score_interview: Mapped[float] = mapped_column(Float, default=0.0)
    score_report: Mapped[float] = mapped_column(Float, default=0.0)

    # Quyền
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    registered_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    @property
    def final_score(self) -> float:
        """Tính điểm tổng kết theo trọng số từng bảng."""
        tier = self.tier or "A"
        weights = {
            "A": {"bot": 0.30, "ai": 0.25, "interview": 0.30, "report": 0.15},
            "B": {"bot": 0.40, "ai": 0.20, "interview": 0.25, "report": 0.15},
            "C": {"bot": 0.50, "ai": 0.15, "interview": 0.20, "report": 0.15},
        }.get(tier, {"bot": 0.30, "ai": 0.25, "interview": 0.30, "report": 0.15})
        total = (
            (self.score_bot or 0.0) * weights["bot"] +
            (self.score_ai_profile or 0.0) * weights["ai"] +
            (self.score_interview or 0.0) * weights["interview"] +
            (self.score_report or 0.0) * weights["report"]
        )
        return round(total, 2)

    def __repr__(self):
        return f"<User {self.email} tier={self.tier}>"
