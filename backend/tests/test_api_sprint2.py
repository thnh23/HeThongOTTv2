"""
Integration Tests for Sprint 2 API Routers
(/api/submit, /api/matches, /api/leaderboard)
"""

import io
import zipfile
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import Base, engine, get_db
from app.models.user import User
from app.models.match import Match, Replay
from app.features.auth.service import hash_password, create_access_token


@pytest.fixture
def client():
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c


@pytest.fixture
def auth_headers(client):
    """Tạo user test và header Authorization JWT."""
    from app.database import SessionLocal
    db = SessionLocal()
    user = db.query(User).filter(User.email == "test_pilot@example.com").first()
    if not user:
        user = User(
            name="Sinh Vien Test",
            email="test_pilot@example.com",
            hashed_password=hash_password("password123"),
            tier="A",
            is_admin=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    token = create_access_token({"sub": user.id})
    user_id = user.id
    db.close()
    return {"Authorization": f"Bearer {token}"}, user_id


def create_in_memory_zip() -> io.BytesIO:
    """Tạo zip file hợp lệ trong bộ nhớ."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("bot.py", "def choose_move(state):\n    return ('e2', 'e3')\n")
        zf.writestr("REPORT.md", "# Report\nMy bot strategy and heuristic\n")
        zf.writestr("git_log.txt", "commit 1111111\ncommit 2222222\ncommit 3333333\ncommit 4444444\n")
    buffer.seek(0)
    return buffer


class TestSubmitAPI:
    """Kiểm thử API nộp bài (Chuyển sang Google Form & GitHub Repository)."""

    def test_submit_config(self, client):
        resp = client.get("/api/submit/config")
        assert resp.status_code == 200
        data = resp.json()
        assert data["submission_mode"] == "google_form"
        assert "google_form_url" in data
        assert "github_template_url" in data
        assert len(data["form_fields"]) == 4

    def test_submit_zip_deprecated_returns_400(self, client, auth_headers):
        headers, _ = auth_headers
        zip_buf = create_in_memory_zip()
        files = {"file": ("package.zip", zip_buf, "application/zip")}
        resp = client.post("/api/submit", headers=headers, files=files)
        assert resp.status_code == 400
        assert "Google Form" in resp.json()["detail"]

    def test_submit_history(self, client, auth_headers):
        headers, _ = auth_headers
        hist_resp = client.get("/api/submit/history", headers=headers)
        assert hist_resp.status_code == 200
        assert isinstance(hist_resp.json(), list)

    def test_submit_lookup(self, client):
        resp = client.get("/api/submit/lookup/99999999")
        assert resp.status_code == 200
        data = resp.json()
        assert data["student_id"] == "99999999"
        assert data["status"] in ("not_found", "pending_clone", "valid", "invalid")


class TestMatchesAndLeaderboardAPI:
    """Kiểm thử API Matches & Leaderboard."""

    def test_matches_list_and_detail(self, client, auth_headers):
        headers, user_id = auth_headers
        from app.database import SessionLocal
        db = SessionLocal()

        # Tạo 1 match giả lập
        match = Match(
            tier="A",
            bot_a_id=user_id,
            bot_b_id=user_id,
            status="done",
            winner="W",
            end_code="W1",
            total_moves=24,
            duration_ms=150,
        )
        db.add(match)
        db.commit()
        db.refresh(match)

        # Tạo replay giả lập
        replay = Replay(
            match_id=match.id,
            moves_json='[{"turn": 1, "from": "e2", "to": "e3"}]',
            states_json='[{"board": {}, "move_count": 1}]',
        )
        db.add(replay)
        db.commit()
        match_id = match.id
        db.close()

        # GET /api/matches
        resp = client.get("/api/matches?tier=A")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        assert any(m["id"] == match_id for m in data["items"])

        # GET /api/matches/{id}
        det_resp = client.get(f"/api/matches/{match_id}")
        assert det_resp.status_code == 200
        assert det_resp.json()["winner"] == "W"

        # GET /api/matches/{id}/replay
        rep_resp = client.get(f"/api/matches/{match_id}/replay")
        assert rep_resp.status_code == 200
        rep_data = rep_resp.json()
        assert len(rep_data["moves"]) == 1
        assert len(rep_data["states"]) == 1

        # GET /api/leaderboard
        lb_resp = client.get("/api/leaderboard?tier=A")
        assert lb_resp.status_code == 200
        lb_data = lb_resp.json()
        assert len(lb_data) >= 1
        # Match vừa tạo có bot_a thắng -> có điểm
        assert lb_data[0]["points"] >= 3
