"""
Test Sandbox Benchmark API for Top 32 Obstacles
================================================
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class TestBenchmarkObstacleAPI:
    """Kiểm tra API POST /api/submit/benchmark-obstacle."""

    def test_benchmark_default(self):
        """Chạy benchmark mặc định với GreedyBot fallback và chướng ngại vật Top 32."""
        res = client.post(
            "/api/submit/benchmark-obstacle",
            json={},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "finished"
        assert data["end_code"] in ("W1", "W2", "D1", "D2", "T1")
        assert "average_move_time_ms" in data
        assert "is_latency_compliant" in data
        assert "is_obstacle_compliant" in data
        assert len(data["obstacles"]) > 0
        assert "replay" in data
        assert "moves" in data["replay"]
        assert "states" in data["replay"]

    def test_benchmark_with_custom_obstacles(self):
        """Chạy benchmark với cấu hình ô chướng ngại vật tuỳ chỉnh."""
        custom_obs = ["c3", "c7", "g3", "g7", "e5"]
        res = client.post(
            "/api/submit/benchmark-obstacle",
            json={"obstacles": custom_obs},
        )
        assert res.status_code == 200
        data = res.json()
        assert set(data["obstacles"]) == set(custom_obs)
        assert data["replay"]["obstacles"] == sorted(custom_obs)

    def test_benchmark_with_inline_bot_code(self):
        """Chạy benchmark truyền trực tiếp bot_code qua payload JSON."""
        bot_code = (
            "from app.services.engine.rules import get_legal_moves\n"
            "from app.services.engine.board import square_to_str\n"
            "def choose_move(state):\n"
            "    moves = get_legal_moves(state)\n"
            "    if not moves: return ('', '')\n"
            "    (fc, fr), (tc, tr) = moves[0]\n"
            "    return (square_to_str(fc, fr), square_to_str(tc, tr))\n"
        )
        res = client.post(
            "/api/submit/benchmark-obstacle",
            json={"bot_code": bot_code, "obstacles": ["d4", "d6", "e5"]},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "finished"
        assert data["is_obstacle_compliant"] is True
        assert data["total_moves"] > 0
        assert len(data["replay"]["moves"]) == data["total_moves"]

    def test_benchmark_invalid_bot_code(self):
        """Bot code thiếu hàm choose_move bị từ chối với mã lỗi 400."""
        bot_code = "print('No choose_move defined here')"
        res = client.post(
            "/api/submit/benchmark-obstacle",
            json={"bot_code": bot_code},
        )
        assert res.status_code == 400
        assert "choose_move" in res.json()["detail"]

    def test_sandbox_rejects_empty_code(self):
        """Sandbox API từ chối nếu không dán mã nguồn."""
        res = client.post(
            "/api/submit/benchmark-sandbox",
            json={"mode": "standard", "bot_code": ""},
        )
        assert res.status_code == 400
        assert "Vui lòng dán mã nguồn" in res.json()["detail"]

    def test_sandbox_standard_mode_greedy(self):
        """Chạy Sandbox chế độ tiêu chuẩn đấu với GreedyBot."""
        bot_code = (
            "from app.services.engine.rules import get_legal_moves\n"
            "from app.services.engine.board import square_to_str\n"
            "def choose_move(state):\n"
            "    moves = get_legal_moves(state)\n"
            "    if not moves: return ('', '')\n"
            "    (fc, fr), (tc, tr) = moves[0]\n"
            "    return (square_to_str(fc, fr), square_to_str(tc, tr))\n"
        )
        res = client.post(
            "/api/submit/benchmark-sandbox",
            json={
                "mode": "standard",
                "opponent": "greedy",
                "bot_code": bot_code,
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "finished"
        assert data["mode"] == "standard"
        assert data["obstacles"] == []
        assert "GreedyBot" in data["opponent_name"]
        assert "replay" in data
        assert len(data["replay"]["moves"]) > 0

    def test_sandbox_standard_mode_random(self):
        """Chạy Sandbox chế độ tiêu chuẩn đấu với RandomBot."""
        bot_code = (
            "from app.services.engine.rules import get_legal_moves\n"
            "from app.services.engine.board import square_to_str\n"
            "def choose_move(state):\n"
            "    moves = get_legal_moves(state)\n"
            "    if not moves: return ('', '')\n"
            "    (fc, fr), (tc, tr) = moves[0]\n"
            "    return (square_to_str(fc, fr), square_to_str(tc, tr))\n"
        )
        res = client.post(
            "/api/submit/benchmark-sandbox",
            json={
                "mode": "standard",
                "opponent": "random",
                "bot_code": bot_code,
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "finished"
        assert data["mode"] == "standard"
        assert "RandomBot" in data["opponent_name"]

    def test_sandbox_obstacle_mode(self):
        """Chạy Sandbox chế độ Top 32 đấu với ObstacleBot có ô cản."""
        bot_code = (
            "from app.services.engine.rules import get_legal_moves\n"
            "from app.services.engine.board import square_to_str\n"
            "def choose_move(state):\n"
            "    moves = get_legal_moves(state)\n"
            "    if not moves: return ('', '')\n"
            "    (fc, fr), (tc, tr) = moves[0]\n"
            "    return (square_to_str(fc, fr), square_to_str(tc, tr))\n"
        )
        custom_obs = ["d4", "f4", "e5"]
        res = client.post(
            "/api/submit/benchmark-sandbox",
            json={
                "mode": "obstacle",
                "bot_code": bot_code,
                "obstacles": custom_obs,
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "finished"
        assert data["mode"] == "obstacle"
        assert set(data["obstacles"]) == set(custom_obs)
        assert "ObstacleBot" in data["opponent_name"]
        assert data["is_obstacle_compliant"] is True

