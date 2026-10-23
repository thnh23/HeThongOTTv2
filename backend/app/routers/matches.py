"""
Matches Router — Quản lý lịch thi đấu và xem Replay ván cờ
==========================================================
Endpoints:
  GET /api/matches               ← Danh sách trận đấu (filter theo tier, status, phân trang)
  GET /api/matches/{id}          ← Chi tiết 1 trận đấu
  GET /api/matches/{id}/replay   ← Dữ liệu replay (chuỗi nước đi + snapshot bàn cờ)
"""

from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.match import Match, Replay
from app.models.user import User

router = APIRouter(prefix="/api/matches", tags=["matches"])


# ── Pydantic Schemas ────────────────────────────

class MatchListItemResponse(BaseModel):
    id: str
    tier: str
    bot_a_id: str
    bot_a_name: Optional[str] = None
    bot_b_id: str
    bot_b_name: Optional[str] = None
    status: str
    winner: Optional[str] = None
    end_code: Optional[str] = None
    total_moves: int = 0
    duration_ms: int = 0
    created_at: datetime
    played_at: Optional[datetime] = None

    class Config:
        orm_mode = True


class MatchListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[MatchListItemResponse]


class ReplayResponse(BaseModel):
    match_id: str
    tier: str
    bot_a_id: str
    bot_a_name: Optional[str] = None
    bot_b_id: str
    bot_b_name: Optional[str] = None
    winner: Optional[str] = None
    end_code: Optional[str] = None
    total_moves: int
    duration_ms: int
    played_at: Optional[datetime] = None
    moves: List[dict]
    states: List[dict]


# ── Routes ──────────────────────────────────────

@router.get("", response_model=MatchListResponse)
def get_matches(
    round_num: Optional[int] = Query(None, description="Lọc theo vòng đấu Swiss (1-13)"),
    status_filter: Optional[str] = Query(None, alias="status", description="Lọc theo trạng thái (pending, running, done, error)"),
    page: int = Query(1, ge=1, description="Số trang"),
    page_size: int = Query(20, ge=1, le=100, description="Số trận trên mỗi trang"),
    db: Session = Depends(get_db),
):
    """Lấy danh sách các trận đấu có phân trang và bộ lọc."""
    query = db.query(Match)

    if round_num is not None:
        if hasattr(Match, "round_num"):
            query = query.filter(Match.round_num == round_num)
    if status_filter:
        query = query.filter(Match.status == status_filter.lower())

    total = query.count()
    offset = (page - 1) * page_size
    matches = query.order_by(Match.created_at.desc()).offset(offset).limit(page_size).all()

    # Thu thập tên người chơi
    user_ids = set()
    for m in matches:
        user_ids.add(m.bot_a_id)
        user_ids.add(m.bot_b_id)

    users = db.query(User).filter(User.id.in_(user_ids)).all() if user_ids else []
    user_map = {u.id: u.name for u in users}

    items = []
    for m in matches:
        items.append(
            MatchListItemResponse(
                id=m.id,
                tier=m.tier,
                bot_a_id=m.bot_a_id,
                bot_a_name=user_map.get(m.bot_a_id, "Unknown"),
                bot_b_id=m.bot_b_id,
                bot_b_name=user_map.get(m.bot_b_id, "Unknown"),
                status=m.status,
                winner=m.winner,
                end_code=m.end_code,
                total_moves=m.total_moves,
                duration_ms=m.duration_ms,
                created_at=m.created_at,
                played_at=m.played_at,
            )
        )

    return MatchListResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=items,
    )


@router.get("/{match_id}", response_model=MatchListItemResponse)
def get_match_detail(match_id: str, db: Session = Depends(get_db)):
    """Xem chi tiết 1 trận đấu."""
    m = db.query(Match).filter(Match.id == match_id).first()
    if not m:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy trận đấu",
        )

    user_a = db.query(User).filter(User.id == m.bot_a_id).first()
    user_b = db.query(User).filter(User.id == m.bot_b_id).first()

    return MatchListItemResponse(
        id=m.id,
        tier=m.tier,
        bot_a_id=m.bot_a_id,
        bot_a_name=user_a.name if user_a else "Unknown",
        bot_b_id=m.bot_b_id,
        bot_b_name=user_b.name if user_b else "Unknown",
        status=m.status,
        winner=m.winner,
        end_code=m.end_code,
        total_moves=m.total_moves,
        duration_ms=m.duration_ms,
        created_at=m.created_at,
        played_at=m.played_at,
    )


@router.get("/{match_id}/replay", response_model=ReplayResponse)
def get_match_replay(match_id: str, db: Session = Depends(get_db)):
    """
    Lấy toàn bộ dữ liệu Replay của trận đấu:
    Bao gồm chuỗi các nước đi và snapshot trạng thái bàn cờ qua từng lượt.
    """
    m = db.query(Match).filter(Match.id == match_id).first()
    if not m:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy trận đấu",
        )

    replay = db.query(Replay).filter(Replay.match_id == match_id).first()
    if not replay:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trận đấu này chưa có dữ liệu Replay",
        )

    user_a = db.query(User).filter(User.id == m.bot_a_id).first()
    user_b = db.query(User).filter(User.id == m.bot_b_id).first()

    return ReplayResponse(
        match_id=m.id,
        tier=m.tier,
        bot_a_id=m.bot_a_id,
        bot_a_name=user_a.name if user_a else "Unknown",
        bot_b_id=m.bot_b_id,
        bot_b_name=user_b.name if user_b else "Unknown",
        winner=m.winner,
        end_code=m.end_code,
        total_moves=m.total_moves,
        duration_ms=m.duration_ms,
        played_at=m.played_at,
        moves=replay.moves,
        states=replay.states,
    )


