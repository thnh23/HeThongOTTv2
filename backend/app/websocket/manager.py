"""
WebSocket Connection Manager
Quản lý các kết nối WebSocket cho Live Match & Live Leaderboard.
"""

import json
from typing import Dict, Set
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # match_id -> set of active WebSockets
        self.match_rooms: Dict[str, Set[WebSocket]] = {}
        # Global leaderboard subscribers
        self.leaderboard_subscribers: Set[WebSocket] = set()

    # ── Match Room ──────────────────────────────
    async def connect_match(self, match_id: str, websocket: WebSocket):
        await websocket.accept()
        if match_id not in self.match_rooms:
            self.match_rooms[match_id] = set()
        self.match_rooms[match_id].add(websocket)

    def disconnect_match(self, match_id: str, websocket: WebSocket):
        if match_id in self.match_rooms:
            self.match_rooms[match_id].discard(websocket)
            if not self.match_rooms[match_id]:
                del self.match_rooms[match_id]

    async def broadcast_to_match(self, match_id: str, data: dict):
        if match_id in self.match_rooms:
            message_text = json.dumps(data, ensure_ascii=False)
            dead_connections = set()
            for connection in self.match_rooms[match_id]:
                try:
                    await connection.send_text(message_text)
                except Exception:
                    dead_connections.add(connection)
            for dead in dead_connections:
                self.match_rooms[match_id].discard(dead)

    # ── Leaderboard ─────────────────────────────
    async def connect_leaderboard(self, websocket: WebSocket):
        await websocket.accept()
        self.leaderboard_subscribers.add(websocket)

    def disconnect_leaderboard(self, websocket: WebSocket):
        self.leaderboard_subscribers.discard(websocket)

    async def broadcast_leaderboard(self, data: dict):
        message_text = json.dumps(data, ensure_ascii=False)
        dead_connections = set()
        for connection in self.leaderboard_subscribers:
            try:
                await connection.send_text(message_text)
            except Exception:
                dead_connections.add(connection)
        for dead in dead_connections:
            self.leaderboard_subscribers.discard(dead)


# Global singleton instance
ws_manager = ConnectionManager()
