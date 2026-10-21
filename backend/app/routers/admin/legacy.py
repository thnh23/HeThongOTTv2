"""
Admin Sub-router — Legacy Round-Robin Tournament, Replay Retry & Maintenance
"""

import uuid
import asyncio
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.models.user import User
from app.models.match import Match
from app.models.submission import Submission
from app.routers.auth import require_admin
from app.services.live_runner import run_live_match_async
from app.websocket.manager import ws_manager
from app.routers.admin.common import (
    TournamentStartRequest,
    get_bot_for_user,
)

router = APIRouter(tags=["admin-legacy"])


async def run_tournament_queue_async(tier: str, match_ids: List[str], move_delay_sec: float = 0.2):
    """
    Hàng đợi thực thi tuần tự tất cả các trận đấu vòng tròn trong giải đấu.
    Cập nhật Replay, trạng thái và phát sóng WebSocket liên tục.
    """
    for match_id in match_ids:
        db = SessionLocal()
        try:
            m = db.query(Match).filter(Match.id == match_id).first()
            if not m or m.status == "done":
                continue

            user_w = db.query(User).filter(User.id == m.bot_a_id).first()
            user_b = db.query(User).filter(User.id == m.bot_b_id).first()

            bot_white_fn, bot_w_name = get_bot_for_user(user_w, db)
            bot_black_fn, bot_b_name = get_bot_for_user(user_b, db)
        finally:
            db.close()

        # Thực thi trận đấu có streaming qua WebSocket
        try:
            await run_live_match_async(
                match_id=match_id,
                bot_white_fn=bot_white_fn,
                bot_black_fn=bot_black_fn,
                bot_white_name=bot_w_name,
                bot_black_name=bot_b_name,
                move_delay_sec=move_delay_sec,
                max_moves=200,
            )
        except Exception as e:
            db_err = SessionLocal()
            try:
                err_m = db_err.query(Match).filter(Match.id == match_id).first()
                if err_m:
                    err_m.status = "done"
                    err_m.end_code = "T1"
                    err_m.reason = f"Lỗi thực thi trận đấu: {str(e)}"
                    db_err.commit()
            finally:
                db_err.close()

        await asyncio.sleep(0.5)

    await ws_manager.broadcast_leaderboard({
        "type": "TOURNAMENT_COMPLETED",
        "tier": tier,
        "timestamp": datetime.utcnow().isoformat(),
    })


@router.post("/tournament/start")
async def start_tournament(req: TournamentStartRequest, db: Session = Depends(get_db)):
    """
    Khởi chạy giải đấu vòng tròn (Round-Robin) cho bảng chỉ định:
      - Chỉ chọn các thí sinh ĐÃ NỘP BÀI HỢP LỆ (Submission.is_active == True và status == 'valid')
      - Thí sinh chưa nộp bài hoặc bài không hợp lệ sẽ KHÔNG được ghép trận
      - Ghép cặp thi đấu 2 lượt đổi phe (Trắng - Đen, Đen - Trắng)
      - Khởi tạo các trận đấu và tự động chạy toàn bộ theo hàng đợi
    """
    tier = req.tier.upper()

    total_in_tier = db.query(User).filter(User.tier == tier, User.is_admin == False).count()

    valid_subs = (
        db.query(Submission.user_id)
        .filter(Submission.is_active == True, Submission.status == "valid")
        .all()
    )
    valid_user_ids = {s.user_id for s in valid_subs}

    users = (
        db.query(User)
        .filter(
            User.tier == tier,
            User.is_admin == False,
            User.id.in_(valid_user_ids),
        )
        .all()
    )

    if len(users) < 2:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Bảng {tier} hiện chỉ có {len(users)}/{total_in_tier} thí sinh đã nộp bài hợp lệ. "
                f"Cần tối thiểu 2 thí sinh đã nộp bài hợp lệ để tổ chức thi đấu vòng tròn!"
            ),
        )

    # Xóa các trận đấu 'pending' cũ của bảng này nếu có
    db.query(Match).filter(Match.tier == tier, Match.status == "pending").delete()
    db.commit()

    created_matches = []

    for i in range(len(users)):
        for j in range(i + 1, len(users)):
            u1 = users[i]
            u2 = users[j]

            # Lượt đi: u1 White, u2 Black
            m1 = Match(
                id=str(uuid.uuid4()),
                tier=tier,
                bot_a_id=u1.id,
                bot_b_id=u2.id,
                status="pending",
                created_at=datetime.utcnow(),
            )
            db.add(m1)
            created_matches.append(m1)

            # Lượt về: u2 White, u1 Black
            m2 = Match(
                id=str(uuid.uuid4()),
                tier=tier,
                bot_a_id=u2.id,
                bot_b_id=u1.id,
                status="pending",
                created_at=datetime.utcnow(),
            )
            db.add(m2)
            created_matches.append(m2)

    db.commit()

    match_ids = [m.id for m in created_matches]
    asyncio.create_task(
        run_tournament_queue_async(tier=tier, match_ids=match_ids, move_delay_sec=req.move_delay_sec)
    )

    await ws_manager.broadcast_leaderboard({
        "type": "TOURNAMENT_STARTED",
        "tier": tier,
        "total_matches": len(created_matches),
        "total_players": len(users),
        "timestamp": datetime.utcnow().isoformat(),
    })

    return {
        "success": True,
        "tier": tier,
        "total_players": len(users),
        "total_candidates": total_in_tier,
        "total_matches_created": len(created_matches),
        "active_match_id": created_matches[0].id if created_matches else None,
        "message": f"Đã khởi tạo thành công {len(created_matches)} trận đấu vòng tròn cho {len(users)} thí sinh đã nộp bài tại Bảng {tier}!",
    }


@router.get("/tournament/status")
def get_tournament_status(db: Session = Depends(get_db)):
    """Báo cáo tiến độ giải đấu chi tiết theo từng bảng A, B, C."""
    tiers = ["A", "B", "C"]
    status_report = {}

    valid_subs = (
        db.query(Submission.user_id)
        .filter(Submission.is_active == True, Submission.status == "valid")
        .all()
    )
    valid_user_ids = {s.user_id for s in valid_subs}

    for t in tiers:
        total = db.query(Match).filter(Match.tier == t).count()
        done = db.query(Match).filter(Match.tier == t, Match.status == "done").count()
        running = db.query(Match).filter(Match.tier == t, Match.status == "running").count()
        pending = total - done - running

        progress_pct = round((done / total * 100), 1) if total > 0 else 0.0

        tier_users = db.query(User).filter(User.tier == t, User.is_admin == False).all()
        total_players = len(tier_users)
        submitted_players = sum(1 for u in tier_users if u.id in valid_user_ids)

        status_report[t] = {
            "total_matches": total,
            "done_matches": done,
            "running_matches": running,
            "pending_matches": pending,
            "progress_percent": progress_pct,
            "total_players": total_players,
            "submitted_players": submitted_players,
        }

    return status_report


@router.post("/matches/{match_id}/retry")
def retry_match(match_id: str, db: Session = Depends(get_db)):
    """Chạy lại ván đấu gặp lỗi hoặc hủy với bot thật của thí sinh."""
    m = db.query(Match).filter(Match.id == match_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Không tìm thấy trận đấu")

    m.status = "pending"
    m.winner = None
    m.end_code = None
    m.total_moves = 0
    m.duration_ms = 0
    db.commit()

    user_w = db.query(User).filter(User.id == m.bot_a_id).first()
    user_b = db.query(User).filter(User.id == m.bot_b_id).first()

    bot_w_fn, bot_w_name = get_bot_for_user(user_w, db)
    bot_b_fn, bot_b_name = get_bot_for_user(user_b, db)

    asyncio.create_task(
        run_live_match_async(
            match_id=m.id,
            bot_white_fn=bot_w_fn,
            bot_black_fn=bot_b_fn,
            bot_white_name=bot_w_name,
            bot_black_name=bot_b_name,
            move_delay_sec=0.4,
        )
    )

    return {
        "success": True,
        "match_id": m.id,
        "message": "Trận đấu đang được khởi chạy lại trong Sandbox!",
    }


@router.post("/seed-data")
def trigger_seed_data(admin: User = Depends(require_admin)):
    """Đồng bộ / Cập nhật lại toàn bộ dữ liệu mẫu (Users, Submissions, Matches) vào cơ sở dữ liệu hiện tại."""
    try:
        from seed_demo_data import seed_data
        seed_data()
        return {
            "success": True,
            "message": "Đã cập nhật dữ liệu mẫu (9 thí sinh A/B/C, submissions và matches) thành công!"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi cập nhật dữ liệu: {str(e)}")
