"""
Seed Demo Data for OTTv2 Tournament
"""

import json
from datetime import datetime
from app.database import SessionLocal, create_all_tables
from app.models.user import User
from app.models.match import Match, Replay
from app.models.submission import Submission
from app.routers.auth import hash_password

# 1. Seed Users
users_data = [
    # Bảng A (Khởi Động: 0-39 điểm)
    {
        "id": "user-student-a",
        "name": "Nguyễn Văn An (K66-CACLC)",
        "email": "studentA@uet.vnu.edu.vn",
        "password": "pass123",
        "tier": "A",
        "test_score": 35.0,
    },
    {
        "id": "user-student-a2",
        "name": "Đỗ Minh Khang (K66-KTPM)",
        "email": "studentA2@uet.vnu.edu.vn",
        "password": "pass123",
        "tier": "A",
        "test_score": 28.0,
    },
    {
        "id": "user-student-a3",
        "name": "Vũ Thị Mai (K66-CLC)",
        "email": "studentA3@uet.vnu.edu.vn",
        "password": "pass123",
        "tier": "A",
        "test_score": 38.0,
    },

    # Bảng B (Tiến Phát: 40-74 điểm)
    {
        "id": "user-student-b",
        "name": "Trần Thị Bình (K66-CNTT)",
        "email": "studentB@uet.vnu.edu.vn",
        "password": "pass123",
        "tier": "B",
        "test_score": 58.0,
    },
    {
        "id": "user-student-b2",
        "name": "Phạm Quốc Bảo (K66-HTTT)",
        "email": "studentB2@uet.vnu.edu.vn",
        "password": "pass123",
        "tier": "B",
        "test_score": 65.0,
    },
    {
        "id": "user-student-b3",
        "name": "Hoàng Đức Thắng (K66-KHMT)",
        "email": "studentB3@uet.vnu.edu.vn",
        "password": "pass123",
        "tier": "B",
        "test_score": 72.0,
    },

    # Bảng C (Thử Thách: 75-100 điểm)
    {
        "id": "user-student-c",
        "name": "Lê Hoàng Cường (K65-KTPM)",
        "email": "studentC@uet.vnu.edu.vn",
        "password": "pass123",
        "tier": "C",
        "test_score": 88.0,
        "is_admin": False,
    },
    {
        "id": "user-student-c2",
        "name": "Ngô Quang Huy (K65-CNTT)",
        "email": "studentC2@uet.vnu.edu.vn",
        "password": "pass123",
        "tier": "C",
        "test_score": 92.0,
        "is_admin": False,
    },
    {
        "id": "user-student-c3",
        "name": "Bùi Thanh Tùng (K65-ATTT)",
        "email": "studentC3@uet.vnu.edu.vn",
        "password": "pass123",
        "tier": "C",
        "test_score": 85.0,
        "is_admin": False,
    },

    # Tài khoản Admin BTC
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

submissions_data = [
    {
        "id": "07593876-492b-4cc1-bd4e-59bf81204563",
        "user_id": "user-student-a",
        "status": "valid",
        "is_active": True,
        "zip_path": "storage/submissions/07593876-492b-4cc1-bd4e-59bf81204563/package.zip",
        "validation": {
            "is_valid": True,
            "details": {
                "bot_py": True,
                "choose_move_fn": True,
                "prompts_md": True,
                "chat_history": True,
                "report_md": True,
                "git_log": False,
            },
            "errors": [],
            "warnings": [],
            "detected_api_keys": [],
        },
        "test_run_result": {
            "status": "win",
            "winner": "W",
            "end_code": "W2",
            "total_moves": 28,
            "duration_ms": 45,
            "reason": "Bot thử nghiệm thành công (Thắng bằng mã W2)",
        },
    },
    {
        "id": "e62f4366-862e-40ca-836f-c474102e5cf8",
        "user_id": "user-student-b",
        "status": "valid",
        "is_active": True,
        "zip_path": "storage/submissions/e62f4366-862e-40ca-836f-c474102e5cf8/package.zip",
        "validation": {
            "is_valid": True,
            "details": {
                "bot_py": True,
                "choose_move_fn": True,
                "prompts_md": True,
                "chat_history": True,
                "report_md": True,
                "git_log": False,
            },
            "errors": [],
            "warnings": [],
            "detected_api_keys": [],
        },
        "test_run_result": {
            "status": "win",
            "winner": "W",
            "end_code": "W1",
            "total_moves": 34,
            "duration_ms": 112,
            "reason": "Bot thử nghiệm thành công (Thắng bằng mã W1)",
        },
    },
    {
        "id": "eb3b5f25-8dce-4d6b-9459-afd5f1953106",
        "user_id": "user-student-c",
        "status": "valid",
        "is_active": True,
        "zip_path": "storage/submissions/eb3b5f25-8dce-4d6b-9459-afd5f1953106/package.zip",
        "validation": {
            "is_valid": True,
            "details": {
                "bot_py": True,
                "choose_move_fn": True,
                "prompts_md": True,
                "chat_history": True,
                "report_md": True,
                "git_log": True,
            },
            "errors": [],
            "warnings": [],
            "detected_api_keys": [],
        },
        "test_run_result": {
            "status": "win",
            "winner": "W",
            "end_code": "W2",
            "total_moves": 22,
            "duration_ms": 185,
            "reason": "Bot thử nghiệm thành công (Thắng bằng mã W2)",
        },
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
                existing.name = ud["name"]
                existing.tier = ud["tier"]
                existing.test_score = ud["test_score"]
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

        # 3. Seed Meaningful Submissions (Tier A, B, C)
        for sd in submissions_data:
            existing_sub = db.query(Submission).filter(Submission.id == sd["id"]).first()
            if not existing_sub:
                sub = Submission(
                    id=sd["id"],
                    user_id=sd["user_id"],
                    status=sd["status"],
                    zip_path=sd["zip_path"],
                    validation_json=json.dumps(sd["validation"]),
                    test_run_json=json.dumps(sd["test_run_result"]),
                    is_active=sd["is_active"],
                    submitted_at=datetime.utcnow(),
                )
                db.add(sub)
            else:
                existing_sub.user_id = sd["user_id"]
                existing_sub.status = sd["status"]
                existing_sub.zip_path = sd["zip_path"]
                existing_sub.validation_json = json.dumps(sd["validation"])
                existing_sub.test_run_json = json.dumps(sd["test_run_result"])
                existing_sub.is_active = sd["is_active"]
        db.commit()
        print("Seeding completed successfully!")
    finally:
        db.close()



if __name__ == "__main__":
    seed_data()

