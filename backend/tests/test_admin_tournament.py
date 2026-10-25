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
from app.features.auth.service import hash_password, create_access_token


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
        for uid, name in [
            ("user-student-b", "Student B"),
            ("user-student-b2", "Student B2"),
            ("user-student-b3", "Student B3"),
        ]:
            u = db.query(User).filter(User.id == uid).first()
            if not u:
                u = User(
                    id=uid,
                    name=name,
                    email=f"{uid}@example.com",
                    hashed_password=hash_password("password"),
                    tier="B",
                    is_admin=False,
                )
                db.add(u)
            else:
                u.tier = "B"
                u.is_admin = False
        db.commit()

        # Xóa submission của B để giả lập tình huống chỉ có 1 bạn nộp
        db.query(Submission).filter(Submission.user_id.in_(["user-student-b2", "user-student-b3"])).delete()
        db.commit()
        db.close()

        resp = client.post(
            "/api/admin/tournament/start",
            json={"tier": tier, "move_delay_sec": 0.5},
            headers=admin_headers,
        )
        assert resp.status_code == 400
        data = resp.json()
        assert "thí sinh đã nộp bài hợp lệ" in data["detail"]
        assert "Cần tối thiểu 2 thí sinh" in data["detail"]

    def test_start_tournament_pairs_only_submitted_students(self, client, admin_headers):
        """Kiểm tra: Khi khởi chạy giải đấu, CHỈ các thí sinh đã nộp bài hợp lệ mới được ghép trận."""
        db = SessionLocal()
        tier = "A"
        for uid, name in [
            ("user-student-a", "Student A"),
            ("user-student-a2", "Student A2"),
            ("user-student-a3", "Student A3"),
        ]:
            u = db.query(User).filter(User.id == uid).first()
            if not u:
                u = User(
                    id=uid,
                    name=name,
                    email=f"{uid}@example.com",
                    hashed_password=hash_password("password"),
                    tier="A",
                    is_admin=False,
                )
                db.add(u)
            else:
                u.tier = "A"
                u.is_admin = False
        db.commit()

        # Đảm bảo A có student-a (nộp), student-a2 (nộp), student-a3 (chưa nộp)
        # Khôi phục submission cho a và a2
        sub_a = db.query(Submission).filter(Submission.user_id == "user-student-a").first()
        if not sub_a:
            sub_a = Submission(
                id="07593876-492b-4cc1-bd4e-59bf81204563",
                user_id="user-student-a",
                status="valid",
                is_active=True,
                github_repo_url="https://github.com/nguyenvanan/ottv2-bot",
            )
            db.add(sub_a)
        else:
            sub_a.status = "valid"
            sub_a.is_active = True

        sub_a2 = db.query(Submission).filter(Submission.user_id == "user-student-a2").first()
        if not sub_a2:
            sub_a2 = Submission(
                id="a2a2a2a2-492b-4cc1-bd4e-59bf81204563",
                user_id="user-student-a2",
                status="valid",
                is_active=True,
                github_repo_url="https://github.com/dominhkhang/ottv2-code",
            )
            db.add(sub_a2)
        else:
            sub_a2.status = "valid"
            sub_a2.is_active = True
        db.commit()

        # Đảm bảo student-a3 KHÔNG có submission
        db.query(Submission).filter(Submission.user_id == "user-student-a3").delete()
        db.commit()
        db.close()

        # Khởi chạy giải đấu Bảng A
        resp = client.post(
            "/api/admin/tournament/start",
            json={"tier": tier, "move_delay_sec": 0.5},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["total_players"] == 2
        assert data["total_candidates"] == 3
        assert data["total_matches_created"] == 2

        # Kiểm tra chi tiết các trận đấu tạo ra trong database
        db = SessionLocal()
        matches = db.query(Match).filter(Match.tier == tier).all()
        paired_user_ids = set()
        for m in matches:
            paired_user_ids.add(m.bot_a_id)
            paired_user_ids.add(m.bot_b_id)

        assert "user-student-a" in paired_user_ids
        assert "user-student-a2" in paired_user_ids
        assert "user-student-a3" not in paired_user_ids  # Thí sinh chưa nộp KHÔNG bao giờ có trong trận đấu
        db.close()


class TestAdminAuthorization:
    def test_admin_endpoints_reject_unauthenticated(self, client):
        """Bảo mật: Yêu cầu không có Token xác thực phải bị từ chối 401."""
        resp = client.post("/api/admin/tournament/start", json={"tier": "A", "move_delay_sec": 0.5})
        assert resp.status_code == 401

        resp_users = client.get("/api/admin/users")
        assert resp_users.status_code == 401

        resp_swiss = client.get("/api/admin/swiss/status?round_num=1")
        assert resp_swiss.status_code == 401

    def test_admin_endpoints_reject_regular_student(self, client):
        """Bảo mật: Sinh viên thường có JWT nhưng không có quyền admin phải bị từ chối 403."""
        db = SessionLocal()
        student = db.query(User).filter(User.email == "student_attacker@example.com").first()
        if not student:
            student = User(
                name="Student Attacker",
                email="student_attacker@example.com",
                hashed_password=hash_password("studentpass"),
                tier="GUEST",
                is_admin=False,
            )
            db.add(student)
            db.commit()
            db.refresh(student)
        else:
            student.tier = "GUEST"
            db.commit()

        student_token = create_access_token({"sub": student.id})
        db.close()

        headers = {"Authorization": f"Bearer {student_token}"}
        resp = client.post("/api/admin/tournament/start", json={"tier": "A", "move_delay_sec": 0.5}, headers=headers)
        assert resp.status_code == 403
        assert "Ban tổ chức" in resp.json()["detail"]

        resp_users = client.get("/api/admin/users", headers=headers)
        assert resp_users.status_code == 403
