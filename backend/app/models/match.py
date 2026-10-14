"""
Match & Replay Models — SQLAlchemy ORM
"""

import uuid
import json
from datetime import datetime
from sqlalchemy import String, Integer, Float, DateTime, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # Bảng thi đấu
    tier: Mapped[str] = mapped_column(
        SAEnum("A", "B", "C", name="match_tier_enum"), nullable=False
    )

    # Người chơi
    bot_a_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    bot_b_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)

    # Kết quả
    status: Mapped[str] = mapped_column(
        SAEnum("pending", "running", "done", "error", name="match_status_enum"),
        default="pending",
    )
    winner: Mapped[str] = mapped_column(String(1), nullable=True)   # 'W', 'B', None (hòa)
    end_code: Mapped[str] = mapped_column(
        SAEnum("W1", "W2", "D1", "D2", "T1", name="end_code_enum"), nullable=True
    )
    total_moves: Mapped[int] = mapped_column(Integer, default=0)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)

    # Lưu trữ
    replay_path: Mapped[str] = mapped_column(String(512), nullable=True)

    # Thời gian
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    played_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    def __repr__(self):
        return f"<Match {self.id[:8]} {self.bot_a_id[:8]} vs {self.bot_b_id[:8]}>"


class Replay(Base):
    __tablename__ = "replays"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    match_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("matches.id"), nullable=False, unique=True
    )

    # JSON: list[{turn, player, from, to, captured}]
    moves_json: Mapped[str] = mapped_column(Text, default="[]")

    # JSON: list[board_state_dict]
    states_json: Mapped[str] = mapped_column(Text, default="[]")

    @property
    def moves(self) -> list:
        return json.loads(self.moves_json)

    @moves.setter
    def moves(self, value: list):
        self.moves_json = json.dumps(value, ensure_ascii=False)

    @property
    def states(self) -> list:
        return json.loads(self.states_json)

    @states.setter
    def states(self, value: list):
        self.states_json = json.dumps(value, ensure_ascii=False)
