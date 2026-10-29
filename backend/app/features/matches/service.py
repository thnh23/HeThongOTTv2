"""
Feature Matches — Service for Querying Matches and Loading Replays
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.services.engine.board import create_initial_board
from app.services.engine.rules import step

from app.models.match import Match, Replay
from app.models.user import User
from app.features.matches.schemas import (
    MatchListItemResponse,
    MatchListResponse,
    ReplayResponse,
)


import math
from sqlalchemy import or_


def parse_match_round_info(match_id: str) -> tuple[int | str | None, str]:
    """Phân tích ID trận đấu để sinh nhãn vòng đấu và mã vòng trực quan."""
    m_id = (match_id or "").upper()
    sub = " (Ván 1)" if "_G1" in m_id else " (Ván 2)" if "_G2" in m_id else ""
    if m_id.startswith("R32_"):
        return "finals", f"Chung Kết - Vòng 1/16{sub}"
    elif m_id.startswith("R16_"):
        return "finals", f"Chung Kết - Vòng 1/8{sub}"
    elif m_id.startswith("QF_"):
        return "finals", f"Chung Kết - Tứ Kết{sub}"
    elif m_id.startswith("SF_"):
        return "finals", f"Chung Kết - Bán Kết{sub}"
    elif "FINAL_CHAMPION" in m_id:
        return "finals", f"Chung Kết - Tranh Cúp Vàng{sub}"
    elif "FINAL_THIRD_PLACE" in m_id:
        return "finals", f"Chung Kết - Tranh Hạng Ba{sub}"
    elif m_id.startswith("R") and "_M" in m_id:
        try:
            r_str = m_id.split("_M")[0][1:]
            r_int = int(r_str)
            return r_int, f"Vòng {r_int} Swiss"
        except Exception:
            pass
    return None, "Trận Đấu"


def query_matches(
    db: Session,
    round_num: str | None = None,
    status_filter: str | None = None,
    page: int = 1,
    page_size: int = 50,
    include_subgames: bool = False,
) -> MatchListResponse:
    """Lấy danh sách các trận đấu có phân trang và bộ lọc trạng thái / vòng đấu."""
    query = db.query(Match)

    # 1. Mặc định ẩn các ván con G1, G2 để tránh trùng lặp thẻ trận BO2
    if not include_subgames:
        query = query.filter(~Match.id.like("%_G1"), ~Match.id.like("%_G2"))

    # 2. Lọc theo trạng thái
    if status_filter:
        query = query.filter(Match.status == status_filter.lower())

    # 3. Lọc theo vòng đấu (Swiss hoặc Chung Kết Top 32)
    if round_num:
        clean_round = str(round_num).lower().strip()
        if clean_round in ("finals", "top32", "playoff", "chungket"):
            query = query.filter(
                or_(
                    Match.id.like("R32_%"),
                    Match.id.like("R16_%"),
                    Match.id.like("QF_%"),
                    Match.id.like("SF_%"),
                    Match.id.like("FINAL_%"),
                )
            )
        elif clean_round.isdigit():
            r_val = int(clean_round)
            query = query.filter(Match.id.like(f"R{r_val}_M%"))

    total = query.count()
    total_pages = max(1, math.ceil(total / page_size)) if page_size > 0 else 1
    offset = (page - 1) * page_size
    matches = query.order_by(Match.created_at.desc()).offset(offset).limit(page_size).all()

    user_ids: set[str] = set()
    for m in matches:
        user_ids.add(m.bot_a_id)
        user_ids.add(m.bot_b_id)

    users = db.query(User).filter(User.id.in_(user_ids)).all() if user_ids else []
    user_map = {u.id: u.name for u in users}

    items = []
    for m in matches:
        r_num, r_label = parse_match_round_info(m.id)
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
                round_num=r_num,
                round_label=r_label,
            )
        )

    return MatchListResponse(
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        items=items,
    )


def get_match_by_id(match_id: str, db: Session) -> MatchListItemResponse:
    """Xem chi tiết 1 trận đấu theo ID."""
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


def get_match_replay_data(match_id: str, db: Session) -> ReplayResponse:
    """Lấy dữ liệu replay hoàn chỉnh của ván đấu để hiển thị trực quan."""
    m = db.query(Match).filter(Match.id == match_id).first()
    if not m:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy trận đấu",
        )

    replay = db.query(Replay).filter(Replay.match_id == match_id).first()
    user_a = db.query(User).filter(User.id == m.bot_a_id).first()
    user_b = db.query(User).filter(User.id == m.bot_b_id).first()

    if not replay:
        # Fallback tự động: nếu trận đấu chưa có bản ghi Replay trong DB (ví dụ trận chấm local chưa có replay),
        # tự động khởi tạo trạng thái bàn cờ ban đầu để UI hiển thị bàn cờ và thông tin kết quả thay vì ném lỗi 404!
        init_state = create_initial_board()
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
            moves=[],
            states=[init_state.to_dict()],
            obstacles=[],
        )

    obs = []
    if replay.states and len(replay.states) > 0 and isinstance(replay.states[0], dict):
        obs = replay.states[0].get("obstacles", [])

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
        obstacles=obs,
    )
