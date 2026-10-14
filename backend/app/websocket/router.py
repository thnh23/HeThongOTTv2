"""
WebSocket Router
Endpoints:
  WS /ws/live/{match_id}   ← Nhận live board updates từng nước đi
  WS /ws/leaderboard       ← Nhận thông báo cập nhật bảng xếp hạng
"""

import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.websocket.manager import ws_manager
from app.database import SessionLocal
from app.models.match import Match, Replay
from app.models.user import User

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/live/{match_id}")
async def websocket_live_match(websocket: WebSocket, match_id: str):
    """
    WebSocket kết nối phòng trực tiếp cho một trận đấu.
    Phát sóng từng nước đi, quân bị ăn, trạng thái bàn cờ và kết quả chung cuộc.
    """
    await ws_manager.connect_match(match_id, websocket)

    # Gửi thông tin trạng thái ban đầu khi kết nối thành công
    db = SessionLocal()
    try:
        match_obj = db.query(Match).filter(Match.id == match_id).first()
        if match_obj:
            bot_a = db.query(User).filter(User.id == match_obj.bot_a_id).first()
            bot_b = db.query(User).filter(User.id == match_obj.bot_b_id).first()
            replay = db.query(Replay).filter(Replay.match_id == match_id).first()

            init_payload = {
                "type": "INIT_MATCH_STATE",
                "match_id": match_id,
                "tier": match_obj.tier,
                "status": match_obj.status,
                "bot_white": bot_a.name if bot_a else "White",
                "bot_black": bot_b.name if bot_b else "Black",
                "winner": match_obj.winner,
                "end_code": match_obj.end_code,
                "total_moves": match_obj.total_moves,
            }

            if replay and replay.states:
                init_payload["states"] = replay.states
                init_payload["moves"] = replay.moves
                init_payload["current_board"] = replay.states[-1] if replay.states else {}

            await websocket.send_text(json.dumps(init_payload, ensure_ascii=False))
        else:
            await websocket.send_text(json.dumps({
                "type": "ERROR",
                "message": f"Không tìm thấy trận đấu có mã {match_id}"
            }, ensure_ascii=False))
    finally:
        db.close()

    # Vòng lặp duy trì kết nối
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "PING":
                    await websocket.send_text(json.dumps({"type": "PONG"}))
            except Exception:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect_match(match_id, websocket)


@router.websocket("/ws/leaderboard")
async def websocket_leaderboard(websocket: WebSocket):
    """
    WebSocket theo dõi bảng xếp hạng giải đấu theo thời gian thực.
    """
    await ws_manager.connect_leaderboard(websocket)

    # Gửi xác nhận kết nối
    await websocket.send_text(json.dumps({
        "type": "LEADERBOARD_CONNECTED",
        "message": "Đã kết nối luồng cập nhật trực tiếp Bảng Xếp Hạng"
    }, ensure_ascii=False))

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "PING":
                    await websocket.send_text(json.dumps({"type": "PONG"}))
            except Exception:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect_leaderboard(websocket)
