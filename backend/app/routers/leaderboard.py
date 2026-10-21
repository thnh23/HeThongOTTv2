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
    student_id: Optional[str] = None
    bot_name: Optional[str] = None
    tier: str
    matches_played: int
    wins: int
    draws: int
    losses: int
    points: int
    buchholz: float = 0.0
    sonneborn_berger: float = 0.0
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
    top32: bool = Query(False, description="Chỉ lấy Top 32 hạt giống vào vòng Chung Kết"),
    db: Session = Depends(get_db),
):
    """
    Tính toán và trả về Bảng xếp hạng Thụy Sĩ (Swiss System) toàn giải:
      - Thắng: 3 điểm
      - Hòa:   1 điểm
      - Thua:  0 điểm
      - Hệ số phụ: Buchholz Cut 1 và Sonneborn-Berger (SB)
    """
    # Lấy danh sách toàn bộ thí sinh
    users = db.query(User).all()

    # Khởi tạo bảng thống kê
    stats = {}
    for u in users:
        stats[u.id] = {
            "user_id": u.id,
            "name": u.name,
            "student_id": getattr(u, "student_id", None) or u.email.split("@")[0],
            "bot_name": f"Bot_{u.name.replace(' ', '_')}",
            "tier": "SWISS",
            "matches_played": 0,
            "wins": 0,
            "draws": 0,
            "losses": 0,
            "points": 0,
            "opponents": [],  # list of (opp_id, result_for_user)
        }

    # Lấy toàn bộ các trận đã hoàn thành trong giải đấu
    matches = db.query(Match).filter(Match.status == "done").all()

    for m in matches:
        aid, bid = m.bot_a_id, m.bot_b_id

        # Đảm bảo bot có trong stats
        for uid in (aid, bid):
            if uid not in stats:
                u = db.query(User).filter(User.id == uid).first()
                stats[uid] = {
                    "user_id": uid,
                    "name": u.name if u else "Unknown",
                    "student_id": getattr(u, "student_id", None) if u else uid[:8],
                    "bot_name": f"Bot_{u.name.replace(' ', '_')}" if u else f"Bot_{uid[:6]}",
                    "tier": (u.tier if u else None) or "SWISS",
                    "matches_played": 0,
                    "wins": 0,
                    "draws": 0,
                    "losses": 0,
                    "points": 0,
                    "opponents": [],
                }

        stats[aid]["matches_played"] += 1
        stats[bid]["matches_played"] += 1

        if m.winner == 'W':
            stats[aid]["wins"] += 1
            stats[aid]["points"] += 3
            stats[bid]["losses"] += 1
            stats[aid]["opponents"].append((bid, "win"))
            stats[bid]["opponents"].append((aid, "loss"))
        elif m.winner == 'B':
            stats[bid]["wins"] += 1
            stats[bid]["points"] += 3
            stats[aid]["losses"] += 1
            stats[aid]["opponents"].append((bid, "loss"))
            stats[bid]["opponents"].append((aid, "win"))
        else:
            # Hòa
            stats[aid]["draws"] += 1
            stats[aid]["points"] += 1
            stats[bid]["draws"] += 1
            stats[bid]["points"] += 1
            stats[aid]["opponents"].append((bid, "draw"))
            stats[bid]["opponents"].append((aid, "draw"))

    # Tính toán Buchholz và Sonneborn-Berger cho từng thí sinh
    for uid, entry in stats.items():
        opponents = entry["opponents"]
        opp_scores = [stats[opp_id]["points"] for opp_id, _ in opponents if opp_id in stats]

        # Buchholz = Tổng điểm của đối thủ
        # Nếu có >= 2 đối thủ, áp dụng Buchholz Cut-1 (bỏ điểm thấp nhất)
        if len(opp_scores) >= 2:
            entry["buchholz"] = float(sum(opp_scores) - min(opp_scores))
        else:
            entry["buchholz"] = float(sum(opp_scores))

        # Sonneborn-Berger = 100% điểm đối thủ mình thắng + 50% điểm đối thủ mình hòa
        sb = 0.0
        for opp_id, res in opponents:
            if opp_id in stats:
                opp_pts = stats[opp_id]["points"]
                if res == "win":
                    sb += opp_pts
                elif res == "draw":
                    sb += opp_pts * 0.5
        entry["sonneborn_berger"] = round(sb, 1)

    # Sắp xếp theo FIDE / Swiss standard:
    # 1. Điểm Match Points (giảm dần)
    # 2. Buchholz Cut-1 (giảm dần)
    # 3. Sonneborn-Berger (giảm dần)
    # 4. Số trận thắng (giảm dần)
    sorted_entries = sorted(
        stats.values(),
        key=lambda x: (x["points"], x["buchholz"], x["sonneborn_berger"], x["wins"], -x["losses"]),
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
                student_id=entry.get("student_id"),
                bot_name=entry.get("bot_name"),
                tier=entry["tier"],
                matches_played=played,
                wins=entry["wins"],
                draws=entry["draws"],
                losses=entry["losses"],
                points=entry["points"],
                buchholz=entry.get("buchholz", 0.0),
                sonneborn_berger=entry.get("sonneborn_berger", 0.0),
                win_rate=win_rate,
            )
        )
    if top32:
        return results[:32]
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
