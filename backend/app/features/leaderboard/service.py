"""
Feature Leaderboard — Domain Service for Computing Standings & Tiebreakers
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.match import Match
from app.models.user import User
from app.features.leaderboard.schemas import LeaderboardEntry, UserMatchHistoryItem
from app.features.matches.service import parse_match_round_info



def compute_swiss_leaderboard(db: Session, top32_only: bool = False) -> list[LeaderboardEntry]:
    """
    Tính toán và trả về Bảng xếp hạng Thụy Sĩ (Swiss System) toàn giải:
      - Thắng: 3 điểm, Hòa: 1 điểm, Thua: 0 điểm
      - Hệ số phụ: Buchholz Cut 1 và Sonneborn-Berger (SB)
      - Luôn loại bỏ hoàn toàn các tài khoản Admin (User.is_admin == False).
      - Nếu chưa có trận đấu nào diễn ra (0 trận hoàn thành): Trả về danh sách rỗng [] để hiển thị trạng thái chờ giải đấu khởi tranh.
    """
    import os
    import json

    # 1. Kiểm tra số lượng trận đấu đã hoàn thành
    done_matches_count = db.query(Match).filter(Match.status == "done").count()

    base_backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    published_file = os.path.join(base_backend_dir, "published", "standings.json")

    # Ưu tiên dữ liệu bảng xếp hạng đã xuất bản chính thức từ giải Swiss (chỉ áp dụng khi giải đấu thực sự đã có trận đấu)
    if done_matches_count > 0 and os.path.exists(published_file):
        try:
            with open(published_file, "r", encoding="utf-8") as pf:
                pub_data = json.load(pf)
            if isinstance(pub_data, list) and len(pub_data) > 0:
                results = []
                for rank_idx, p in enumerate(pub_data, 1):
                    if p.get("is_admin"):
                        continue
                    played = p.get("matches_played", 0)
                    wins = p.get("wins", 0)
                    win_rate = p.get("win_rate")
                    if win_rate is None:
                        win_rate = round((wins / played) * 100, 1) if played > 0 else 0.0

                    results.append(
                        LeaderboardEntry(
                            rank=rank_idx,
                            user_id=p.get("user_id") or p.get("id"),
                            name=p.get("name") or "Thí sinh",
                            student_id=p.get("student_id"),
                            bot_name=p.get("bot_name"),
                            tier=p.get("tier", "SWISS"),
                            matches_played=played,
                            wins=wins,
                            draws=p.get("draws", 0),
                            losses=p.get("losses", 0),
                            points=p.get("points", 0),
                            buchholz=float(p.get("buchholz", 0.0)),
                            sonneborn_berger=float(p.get("sonneborn_berger", 0.0)),
                            win_rate=float(win_rate),
                        )
                    )
                if top32_only:
                    return results[:32]
                return results
        except Exception:
            pass

    # Nếu chưa có trận đấu nào hoàn thành trong CSDL -> Trả về danh sách rỗng (Chưa bắt đầu giải đấu)
    if done_matches_count == 0:
        return []

    users = db.query(User).filter(User.is_admin == False).all()

    stats: dict[str, dict] = {}
    for u in users:
        stats[u.id] = {
            "user_id": u.id,
            "name": u.name,
            "student_id": getattr(u, "student_id", None) or u.email.split("@")[0],
            "bot_name": getattr(u, "bot_name", None) or f"Bot_{u.name.replace(' ', '_')}",
            "tier": "SWISS",
            "matches_played": 0,
            "wins": 0,
            "draws": 0,
            "losses": 0,
            "points": 0,
            "opponents": [],  # list of (opp_id, result_for_user)
        }

    # Chỉ tính các trận đấu hợp lệ của giải Swiss:
    # 1. Thuộc thể thức Swiss R{N}_M{XXXX} (loại bỏ R32_, R16_, QF_, SF_, FINAL_)
    # 2. Loại bỏ các ván đấu con phụ (_G1, _G2)
    # 3. Trạng thái 'done'
    matches = (
        db.query(Match)
        .filter(
            Match.status == "done",
            Match.id.like("R%_M%"),
            ~Match.id.like("R32_%"),
            ~Match.id.like("R16_%"),
            ~Match.id.like("%_G1"),
            ~Match.id.like("%_G2"),
        )
        .all()
    )

    for m in matches:
        aid, bid = m.bot_a_id, m.bot_b_id

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

        if aid in stats:
            stats[aid]["matches_played"] += 1
        if bid in stats:
            stats[bid]["matches_played"] += 1

        if m.winner == "W":
            if aid in stats:
                stats[aid]["wins"] += 1
                stats[aid]["points"] += 3
                stats[aid]["opponents"].append((bid, "win"))
            if bid in stats:
                stats[bid]["losses"] += 1
                stats[bid]["opponents"].append((aid, "loss"))
        elif m.winner == "B":
            if bid in stats:
                stats[bid]["wins"] += 1
                stats[bid]["points"] += 3
                stats[bid]["opponents"].append((aid, "win"))
            if aid in stats:
                stats[aid]["losses"] += 1
                stats[aid]["opponents"].append((bid, "loss"))
        else:
            if aid in stats:
                stats[aid]["draws"] += 1
                stats[aid]["points"] += 1
                stats[aid]["opponents"].append((bid, "draw"))
            if bid in stats:
                stats[bid]["draws"] += 1
                stats[bid]["points"] += 1
                stats[bid]["opponents"].append((aid, "draw"))

    # Tính toán Buchholz Cut-1 và Sonneborn-Berger
    for uid, entry in stats.items():
        opponents = entry["opponents"]
        opp_scores = [stats[opp_id]["points"] for opp_id, _ in opponents if opp_id in stats]

        if len(opp_scores) >= 2:
            entry["buchholz"] = float(sum(opp_scores) - min(opp_scores))
        else:
            entry["buchholz"] = float(sum(opp_scores))

        sb = 0.0
        for opp_id, res in opponents:
            if opp_id in stats:
                opp_pts = stats[opp_id]["points"]
                if res == "win":
                    sb += opp_pts
                elif res == "draw":
                    sb += opp_pts * 0.5
        entry["sonneborn_berger"] = round(sb, 1)

    # Sắp xếp FIDE: Points -> Buchholz Cut 1 -> Sonneborn-Berger -> Wins -> -Losses
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

    if top32_only:
        return results[:32]
    return results


def get_player_match_history(user_id: str, db: Session) -> list[UserMatchHistoryItem]:
    """Lấy danh sách các trận đấu đã chơi của một thí sinh cụ thể."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy người dùng",
        )

    matches = (
        db.query(Match)
        .filter((Match.bot_a_id == user_id) | (Match.bot_b_id == user_id))
        .filter(
            Match.status == "done",
            ~Match.id.like("%_G1"),
            ~Match.id.like("%_G2"),
        )
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
        elif (m.winner == "W" and is_white) or (m.winner == "B" and not is_white):
            res_str = "win"
        else:
            res_str = "loss"

        _, round_label = parse_match_round_info(m.id)

        items.append(
            UserMatchHistoryItem(
                match_id=m.id,
                played_as="White" if is_white else "Black",
                opponent_id=opponent_id,
                opponent_name=opp_name,
                result=res_str,
                end_code=m.end_code,
                total_moves=m.total_moves,
                round_label=round_label,
                played_at=m.played_at.isoformat() if m.played_at else None,
            )
        )

    return items
