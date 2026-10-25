"""
Feature Matches — Pydantic V2 Schemas for Match History and Replays
"""

from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class MatchListItemResponse(BaseModel):
    id: str
    tier: str
    bot_a_id: str
    bot_a_name: str | None = None
    bot_b_id: str
    bot_b_name: str | None = None
    status: str
    winner: str | None = None
    end_code: str | None = None
    total_moves: int = 0
    duration_ms: int = 0
    created_at: datetime
    played_at: datetime | None = None
    round_num: int | str | None = None
    round_label: str | None = None

    class Config:
        orm_mode = True
        from_attributes = True


class MatchListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int = 1
    items: list[MatchListItemResponse] = Field(default_factory=list)


class ReplayResponse(BaseModel):
    match_id: str
    tier: str
    bot_a_id: str
    bot_a_name: str | None = None
    bot_b_id: str
    bot_b_name: str | None = None
    winner: str | None = None
    end_code: str | None = None
    total_moves: int
    duration_ms: int
    played_at: datetime | None = None
    moves: list[dict[str, Any]] = Field(default_factory=list)
    states: list[dict[str, Any]] = Field(default_factory=list)
    obstacles: list[str] = Field(default_factory=list)
