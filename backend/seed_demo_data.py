"""
Seed Demo Data for OTTv2 Tournament
"""

import json
from datetime import datetime
from app.database import SessionLocal, create_all_tables
from app.models.user import User
from app.models.match import Match, Replay
from app.routers.auth import hash_password

# 1. Seed Users
users_data = [

    {
        "id": "user-student-a",
        "name": "Nguyễn Văn An (K66-CACLC)",
        "email": "studentA@uet.vnu.edu.vn",
        "password": "pass123",
        "tier": "A",
        "test_score": 35.0,
    },
    {
        "id": "user-student-b",
        "name": "Trần Thị Bình (K66-CNTT)",
        "email": "studentB@uet.vnu.edu.vn",
        "password": "pass123",
        "tier": "A",
        "test_score": 38.0,
    },
    {
        "id": "user-student-c",
        "name": "Lê Hoàng Cường (K65-KTPM)",
        "email": "studentC@uet.vnu.edu.vn",
        "password": "pass123",
        "tier": "A",
        "test_score": 30.0,
        "is_admin": False,
    },
    {
        "id": "user-admin",
        "name": "Ban Tổ Chức Giải Đấu (Admin)",
        "email": "admin@uet.vnu.edu.vn",
        "password": "admin123",
        "tier": "A",
        "test_score": 100.0,
        "is_admin": True,
    },
]
# 2. Seed Sample Matches & Replays

SAMPLE_BOARD_INITIAL = [
    "RS.PRS.PRS.P",
    ".P..R...S.P.",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    ".p..r...s.p.",
    "rs.prs.prs.p",
]

SAMPLE_BOARD_MID = [
    "R..PRS.PRS.P",
    ".P..R...S.P.",
    ".S..........",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    ".s..........",
    ".p..r....p..",
    "rs.prs.prs.p",
]

matches_data = [
    {
        "id": "match-demo-01",
        "tier": "A",
        "bot_a_id": "user-student-a",
        "bot_b_id": "user-student-b",
        "status": "done",
        "winner": "W",
        "end_code": "W1",
        "total_moves": 42,
        "duration_ms": 15420,
        "states": [
            {"board": SAMPLE_BOARD_INITIAL, "move_number": 0},
            {"board": SAMPLE_BOARD_MID, "move_number": 1},
        ],
        "moves": [
            {"player": "W", "from": "b1", "to": "b3", "captured": None},
            {"player": "B", "from": "b11", "to": "b10", "captured": "S"},
        ],
    },
    {
        "id": "match-demo-02",
        "tier": "A",
        "bot_a_id": "user-student-a",
        "bot_b_id": "user-student-c",
        "status": "done",
        "winner": "W",
        "end_code": "W2",
        "total_moves": 58,
        "duration_ms": 21300,
        "states": [
            {"board": SAMPLE_BOARD_INITIAL, "move_number": 0},
            {"board": SAMPLE_BOARD_MID, "move_number": 1},
        ],
        "moves": [
            {"player": "W", "from": "a1", "to": "a2", "captured": None},
            {"player": "B", "from": "a12", "to": "a11", "captured": None},
        ],
    },
    {
        "id": "match-demo-03",
        "tier": "A",
        "bot_a_id": "user-student-b",
        "bot_b_id": "user-student-c",
        "status": "done",
        "winner": "W",
        "end_code": "W1",
        "total_moves": 36,
        "duration_ms": 12800,
        "states": [
            {"board": SAMPLE_BOARD_INITIAL, "move_number": 0},
            {"board": SAMPLE_BOARD_MID, "move_number": 1},
        ],
        "moves": [
            {"player": "W", "from": "c1", "to": "c2", "captured": None},
            {"player": "B", "from": "c12", "to": "c11", "captured": None},
        ],
    },
]

def seed_data():
    create_all_tables()
    db = SessionLocal()
    try:
        # 1. Seed Users
        for ud in users_data:
            existing = db.query(User).filter(User.email == ud["email"]).first()
            if not existing:
                u = User(
                    id=ud["id"],
                    name=ud["name"],
                    email=ud["email"],
                    hashed_password=hash_password(ud["password"]),
                    tier=ud["tier"],
                    test_score=ud["test_score"],
                    is_admin=ud.get("is_admin", False),
                )
                db.add(u)
            else:
                existing.hashed_password = hash_password(ud["password"])
                existing.is_admin = ud.get("is_admin", False)

        db.commit()

        # 2. Seed Sample Matches & Replays
        for md in matches_data:
            existing_match = db.query(Match).filter(Match.id == md["id"]).first()
            if not existing_match:
                m = Match(
                    id=md["id"],
                    tier=md["tier"],
                    bot_a_id=md["bot_a_id"],
                    bot_b_id=md["bot_b_id"],
                    status=md["status"],
                    winner=md["winner"],
                    end_code=md["end_code"],
                    total_moves=md["total_moves"],
                    duration_ms=md["duration_ms"],
                )
                db.add(m)
                db.commit()

                # Add Replay
                r = Replay(
                    match_id=md["id"],
                    moves_json=json.dumps(md["moves"]),
                    states_json=json.dumps(md["states"]),
                )
                db.add(r)
                db.commit()
        print("Seeding completed successfully!")
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()

