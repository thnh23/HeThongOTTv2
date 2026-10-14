"""
Leaderboard Router — Bảng xếp hạng theo giải đấu
=================================================
Endpoints:
  GET /api/leaderboard?tier=A|B|C    ← Bảng xếp hạng điểm (Thắng 3, Hòa 1, Thua 0)
  GET /api/leaderboard/{user_id}/history  ← Lịch sử kết quả thi đấu của 1 thí sinh
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.match import Match
from app.models.user import User

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])


# ── Pydantic Schemas ────────────────────────────

class LeaderboardEntry(BaseModel):
    rank: int
    user_id: str
    name: str
    tier: str
    matches_played: int
    wins: int
    draws: int
    losses: int
    points: int
    win_rate: float     # phần trăm 0 - 100%


class UserMatchHistoryItem(BaseModel):
    match_id: str
    played_as: str       # 'White' hoặc 'Black'
    opponent_id: str
    opponent_name: str
    result: str          # 'win', 'loss', 'draw'
    end_code: Optional[str]
    total_moves: int
    played_at: Optional[str]


# ── Routes ──────────────────────────────────────

@router.get("", response_model=List[LeaderboardEntry])
def get_leaderboard(
    tier: str = Query("A", pattern="^[ABCabc]$", description="Bảng thi đấu (A, B hoặc C)"),
    db: Session = Depends(get_db),
):
    """
    Tính toán và trả về Bảng xếp hạng cho Bảng A, B hoặc C:
      - Thắng: 3 điểm
      - Hòa:   1 điểm
      - Thua:  0 điểm
    """
    target_tier = tier.upper()

    # Lấy tất cả user thuộc bảng này
    users = db.query(User).filter(User.tier == target_tier).all()
    user_map = {u.id: u.name for u in users}

    # Khởi tạo bảng thống kê
    stats = {}
    for u in users:
        stats[u.id] = {
            "user_id": u.id,
            "name": u.name,
            "tier": target_tier,
            "matches_played": 0,
            "wins": 0,
            "draws": 0,
            "losses": 0,
            "points": 0,
        }

    # Lấy các trận đã hoàn thành trong bảng
    matches = (
        db.query(Match)
        .filter(Match.tier == target_tier, Match.status == "done")
        .all()
    )

    for m in matches:
        aid, bid = m.bot_a_id, m.bot_b_id

        # Đảm bảo bot có trong stats kể cả khi user chưa set tier chuẩn
        for uid in (aid, bid):
            if uid not in stats:
                u = db.query(User).filter(User.id == uid).first()
                stats[uid] = {
                    "user_id": uid,
                    "name": u.name if u else "Unknown",
                    "tier": target_tier,
                    "matches_played": 0,
                    "wins": 0,
                    "draws": 0,
                    "losses": 0,
                    "points": 0,
                }

        stats[aid]["matches_played"] += 1
        stats[bid]["matches_played"] += 1

        if m.winner == 'W':
            stats[aid]["wins"] += 1
            stats[aid]["points"] += 3
            stats[bid]["losses"] += 1
        elif m.winner == 'B':
            stats[bid]["wins"] += 1
            stats[bid]["points"] += 3
            stats[aid]["losses"] += 1
        else:
            # Hòa
            stats[aid]["draws"] += 1
            stats[aid]["points"] += 1
            stats[bid]["draws"] += 1
            stats[bid]["points"] += 1

    # Sắp xếp theo Điểm giảm dần -> Số trận thắng giảm dần -> Tỉ lệ thắng
    sorted_entries = sorted(
        stats.values(),
        key=lambda x: (x["points"], x["wins"], -x["losses"]),
        reverse=True,
    )

    results = []
    for rank_idx, entry in enumerate(sorted_entries, 1):
        played = entry["matches_played"]
        win_rate = round((entry["wins"] / played) * 100, 1) if played > 0 else 0.0
        results.append(
            LeaderboardEntry(
                rank=rank_idx,
                user_id=entry["user_id"],
                name=entry["name"],
                tier=entry["tier"],
                matches_played=played,
                wins=entry["wins"],
                draws=entry["draws"],
                losses=entry["losses"],
                points=entry["points"],
                win_rate=win_rate,
            )
        )

    return results


@router.get("/{user_id}/history", response_model=List[UserMatchHistoryItem])
def get_user_match_history(user_id: str, db: Session = Depends(get_db)):
    """Lấy danh sách các trận đấu đã chơi của một người dùng."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy người dùng",
        )

    matches = (
        db.query(Match)
        .filter((Match.bot_a_id == user_id) | (Match.bot_b_id == user_id))
        .filter(Match.status == "done")
        .order_by(Match.played_at.desc())
        .all()
    )

    items = []
    for m in matches:
        is_white = (m.bot_a_id == user_id)
        opponent_id = m.bot_b_id if is_white else m.bot_a_id
        opp_user = db.query(User).filter(User.id == opponent_id).first()
        opp_name = opp_user.name if opp_user else "Unknown"

        if m.winner is None:
            res_str = "draw"
        elif (m.winner == 'W' and is_white) or (m.winner == 'B' and not is_white):
            res_str = "win"
        else:
            res_str = "loss"

        items.append(
            UserMatchHistoryItem(
                match_id=m.id,
                played_as="White" if is_white else "Black",
                opponent_id=opponent_id,
                opponent_name=opp_name,
                result=res_str,
                end_code=m.end_code,
                total_moves=m.total_moves,
                played_at=m.played_at.isoformat() if m.played_at else None,
            )
        )

    return items
