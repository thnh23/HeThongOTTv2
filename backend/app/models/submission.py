"""
Submission Model — SQLAlchemy ORM
"""

import uuid
import json
from datetime import datetime
from typing import Optional
from sqlalchemy import String, DateTime, Text, ForeignKey, Boolean, Integer, Float, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )

    # Trạng thái
    status: Mapped[str] = mapped_column(
        SAEnum("pending", "validating", "valid", "invalid", name="sub_status_enum"),
        default="pending",
    )

    # Đường dẫn file zip hoặc link GitHub repo
    zip_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    github_repo_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)

    # Phiên bản Bot ('v1': Swiss 13 Vòng | 'v2': Chung kết Top 32 ô cản)
    bot_version: Mapped[str] = mapped_column(String(16), default="v1")
    obstacle_support: Mapped[bool] = mapped_column(Boolean, default=False)

    # Liêm chính học thuật (Git commits + MOSS similarity)
    commit_count: Mapped[int] = mapped_column(Integer, default=0)
    moss_score: Mapped[float] = mapped_column(Float, default=0.0)

    # Kết quả kiểm tra cấu trúc gói nộp (JSON)
    # {bot_py, choose_move_fn, prompts_md, chat_history, report_md, git_log}
    validation_json: Mapped[str] = mapped_column(Text, default="{}")

    # Kết quả chạy thử bot (JSON)
    test_run_json: Mapped[str] = mapped_column(Text, nullable=True)

    # File nào là bản nộp "active" (bản mới nhất được chấp nhận)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)

    submitted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    @property
    def validation(self) -> dict:
        return json.loads(self.validation_json)

    @validation.setter
    def validation(self, value: dict):
        self.validation_json = json.dumps(value)

    @property
    def test_run_result(self) -> Optional[dict]:
        if self.test_run_json is None:
            return None
        return json.loads(self.test_run_json)

    @test_run_result.setter
    def test_run_result(self, value: dict):
        self.test_run_json = json.dumps(value)

    def __repr__(self):
        return f"<Submission {self.id[:8]} user={self.user_id[:8]} status={self.status}>"
