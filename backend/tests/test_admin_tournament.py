"""
Unit and integration tests for Tournament matchmaking logic in admin router.
Ensures only students with active valid submissions are paired, and
unsubmitted students are excluded.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import Base, engine, SessionLocal
from app.models.user import User
from app.models.submission import Submission
from app.models.match import Match
from app.routers.auth import hash_password, create_access_token


@pytest.fixture
def client():
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c


@pytest.fixture
def admin_headers():
    db = SessionLocal()
    admin = db.query(User).filter(User.email == "test_admin_tourney@example.com").first()
    if not admin:
        admin = User(
            name="Test Admin Tourney",
            email="test_admin_tourney@example.com",
            hashed_password=hash_password("adminpass"),
            tier="A",
            is_admin=True,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)

    token = create_access_token({"sub": admin.id})
    db.close()
    return {"Authorization": f"Bearer {token}"}


class TestTournamentMatchmaking:
    def test_start_tournament_rejects_when_insufficient_submissions(self, client, admin_headers):
        """Kiểm tra: Nếu bảng có < 2 thí sinh nộp bài hợp lệ thì trả về lỗi 400."""
        db = SessionLocal()
        tier = "B"
        # Xóa submission của B để giả lập tình huống chỉ có 1 bạn nộp
        db.query(Submission).filter(Submission.user_id.in_(["user-student-b2", "user-student-b3"])).delete()
        db.commit()
        db.close()

        resp = client.post("/api/admin/tournament/start", json={"tier": tier, "move_delay_sec": 0.5})
        assert resp.status_code == 400
        data = resp.json()
        assert "thí sinh đã nộp bài hợp lệ" in data["detail"]
        assert "Cần tối thiểu 2 thí sinh" in data["detail"]

    def test_start_tournament_pairs_only_submitted_students(self, client, admin_headers):
        """Kiểm tra: Khi khởi chạy giải đấu, CHỈ các thí sinh đã nộp bài hợp lệ mới được ghép trận."""
        db = SessionLocal()
        tier = "A"
        # Đảm bảo A có student-a (nộp), student-a2 (nộp), student-a3 (chưa nộp)
        # Khôi phục submission cho a và a2
        sub_a2 = db.query(Submission).filter(Submission.user_id == "user-student-a2").first()
        if not sub_a2:
            sub_a2 = Submission(id="a2a2a2a2-492b-4cc1-bd4e-59bf81204563", user_id="user-student-a2", status="valid", is_active=True)
            db.add(sub_a2)
            db.commit()

        # Đảm bảo student-a3 KHÔNG có submission
        db.query(Submission).filter(Submission.user_id == "user-student-a3").delete()
        db.commit()
        db.close()

        # Khởi chạy giải đấu Bảng A
        resp = client.post("/api/admin/tournament/start", json={"tier": tier, "move_delay_sec": 0.5})
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["total_players"] == 2
        assert data["total_candidates"] == 3
        assert data["total_matches_created"] == 2

        # Kiểm tra chi tiết các trận đấu tạo ra trong database
        db = SessionLocal()
        pending_matches = db.query(Match).filter(Match.tier == tier, Match.status == "pending").all()
        paired_user_ids = set()
        for m in pending_matches:
            paired_user_ids.add(m.bot_a_id)
            paired_user_ids.add(m.bot_b_id)

        assert "user-student-a" in paired_user_ids
        assert "user-student-a2" in paired_user_ids
        assert "user-student-a3" not in paired_user_ids  # Thí sinh chưa nộp KHÔNG bao giờ có trong trận đấu
        db.close()
