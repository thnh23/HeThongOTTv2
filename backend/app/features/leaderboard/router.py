"""
Feature Leaderboard — Router & Endpoints for Standings & Match Histories
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.features.leaderboard.schemas import LeaderboardEntry, UserMatchHistoryItem
from app.features.leaderboard.service import compute_swiss_leaderboard, get_player_match_history

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])


@router.get("", response_model=list[LeaderboardEntry])
def get_leaderboard(
    top32: bool = Query(False, description="Chỉ lấy Top 32 hạt giống vào vòng Chung Kết"),
    db: Session = Depends(get_db),
):
    """
    Bảng xếp hạng Thụy Sĩ (Swiss System) toàn giải:
      - Thắng: 3 điểm, Hòa: 1 điểm, Thua: 0 điểm
      - Hệ số phụ: Buchholz Cut 1 và Sonneborn-Berger
      - 100% loại bỏ tài khoản Admin
    """
    return compute_swiss_leaderboard(db=db, top32_only=top32)


@router.get("/{user_id}/history", response_model=list[UserMatchHistoryItem])
def get_user_match_history(user_id: str, db: Session = Depends(get_db)):
    """Lấy danh sách các trận đấu đã chơi của một thí sinh cụ thể."""
    return get_player_match_history(user_id=user_id, db=db)
