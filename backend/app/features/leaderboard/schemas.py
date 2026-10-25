"""
Feature Leaderboard — Pydantic V2 Schemas for Swiss Standings & Player History
"""

from pydantic import BaseModel, ConfigDict


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: str
    name: str
    student_id: str | None = None
    bot_name: str | None = None
    tier: str = "SWISS"
    matches_played: int
    wins: int
    draws: int
    losses: int
    points: int
    buchholz: float = 0.0
    sonneborn_berger: float = 0.0
    win_rate: float  # phần trăm 0 - 100%

    class Config:
        orm_mode = True
        from_attributes = True


class UserMatchHistoryItem(BaseModel):
    match_id: str
    played_as: str  # 'White' hoặc 'Black'
    opponent_id: str
    opponent_name: str
    result: str  # 'win', 'loss', 'draw'
    end_code: str | None = None
    total_moves: int = 0
    round_label: str | None = None
    played_at: str | None = None

    class Config:
        orm_mode = True
        from_attributes = True

