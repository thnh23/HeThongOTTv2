"""
Feature Matches — Router & Endpoints for Match Schedules and Replays
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.features.matches.schemas import MatchListItemResponse, MatchListResponse, ReplayResponse
from app.features.matches.service import query_matches, get_match_by_id, get_match_replay_data

router = APIRouter(prefix="/api/matches", tags=["matches"])


@router.get("", response_model=MatchListResponse)
def get_matches(
    round_num: str | None = Query(None, description="Lọc theo vòng đấu: '1'..'13', 'finals' hoặc 'top32'"),
    status_filter: str | None = Query(None, alias="status", description="Lọc theo trạng thái (pending, running, done, error)"),
    page: int = Query(1, ge=1, description="Số trang"),
    page_size: int = Query(50, ge=1, le=500, description="Số trận trên mỗi trang (1-500)"),
    include_subgames: bool = Query(False, description="Bao gồm các ván con G1, G2 của trận BO2"),
    db: Session = Depends(get_db),
):
    """Lấy danh sách các trận đấu có phân trang và bộ lọc trạng thái / vòng đấu Swiss / Chung Kết."""
    return query_matches(
        db=db,
        round_num=round_num,
        status_filter=status_filter,
        page=page,
        page_size=page_size,
        include_subgames=include_subgames,
    )


@router.get("/bracket")
def get_public_bracket(db: Session = Depends(get_db)):
    """API public cho khán giả và thí sinh tra cứu toàn bộ cây phân nhánh Knockout Top 32."""
    from app.features.admin.top32.service import get_top32_bracket_service
    return get_top32_bracket_service(db)


@router.get("/{match_id}", response_model=MatchListItemResponse)
def get_match_detail(match_id: str, db: Session = Depends(get_db)):
    """Xem chi tiết 1 trận đấu."""
    return get_match_by_id(match_id, db)


@router.get("/{match_id}/replay", response_model=ReplayResponse)
def get_match_replay(match_id: str, db: Session = Depends(get_db)):
    """
    Lấy toàn bộ dữ liệu Replay của trận đấu:
    Bao gồm chuỗi các nước đi và snapshot trạng thái bàn cờ qua từng lượt.
    """
    return get_match_replay_data(match_id, db)
