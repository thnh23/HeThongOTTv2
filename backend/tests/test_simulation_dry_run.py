"""
Unit & Integration Tests for Swiss 13-Round Dry-Run Simulation (Trụ cột 2 & 4)
"""

import os
import shutil
import tempfile
import pytest

from scripts.tournament.simulate_full_tournament import (
    generate_mock_players,
    pair_swiss_round,
    simulate_match,
    compute_tiebreakers,
    export_published_json,
    run_simulation,
)
from scripts.tournament.publish_to_cdn import publish_data


class TestSwissSimulationDryRun:
    """Kiểm thử cỗ máy mô phỏng giải đấu Thụy Sĩ 13 vòng."""

    def test_generate_mock_players(self):
        players = generate_mock_players(100)
        assert len(players) == 100
        assert players[0]["student_id"].startswith("2202")
        assert players[0]["points"] == 0
        assert players[0]["matches_played"] == 0
        assert "history" in players[0]
        assert "opponents_history" in players[0]

    def test_no_rematch_swiss_pairing(self):
        """Kiểm tra luật Strict No-Rematch: không bao giờ ghép 2 đấu thủ đã từng gặp nhau."""
        players = generate_mock_players(20)
        
        for r in range(1, 4):
            pairings = pair_swiss_round(players, r)
            assert len(pairings) == 10
            
            # Ghi nhận lịch sử đấu
            for p1, p2 in pairings:
                assert p2["id"] not in p1["history"], f"Phát hiện tái đấu giữa {p1['id']} và {p2['id']} ở vòng {r}!"
                p1["history"].append(p2["id"])
                p2["history"].append(p1["id"])
                p1["points"] += 3

    def test_forfeit_rule_in_simulation(self):
        """Kiểm tra bot invalid bị xử thua T1 ngay lập tức."""
        valid_player = {"tier_class": "pro", "skill_rating": 80.0}
        invalid_player = {"tier_class": "invalid", "skill_rating": 0.0}

        # Trắng hợp lệ, Đen không hợp lệ -> Trắng thắng W
        assert simulate_match(valid_player, invalid_player) == "W"
        # Trắng không hợp lệ, Đen hợp lệ -> Đen thắng B
        assert simulate_match(invalid_player, valid_player) == "B"
        # Cả 2 không hợp lệ -> Hòa D
        assert simulate_match(invalid_player, invalid_player) == "D"

    def test_tiebreaker_computation(self):
        """Kiểm tra tính toán Buchholz Cut-1 và Sonneborn-Berger."""
        p_map = {
            "p1": {"id": "p1", "points": 6, "opponents_history": [("p2", "win"), ("p3", "win")]},
            "p2": {"id": "p2", "points": 3, "opponents_history": [("p1", "loss")]},
            "p3": {"id": "p3", "points": 1, "opponents_history": [("p1", "loss")]},
        }
        compute_tiebreakers(p_map)
        
        # p1 gặp p2 (3đ) và p3 (1đ):
        # Buchholz Cut-1: tổng (3 + 1) - min(1) = 3.0
        assert p_map["p1"]["buchholz"] == 3.0
        # Sonneborn-Berger: thắng p2 (3đ) + thắng p3 (1đ) = 4.0
        assert p_map["p1"]["sonneborn_berger"] == 4.0

    def test_fast_simulation_run_and_export(self):
        """Kiểm tra chạy simulation trọn vẹn và xuất bản JSON."""
        temp_dir = tempfile.mkdtemp(prefix="test_sim_")
        temp_frontend = os.path.join(temp_dir, "frontend_data")

        try:
            # Chạy mô phỏng 40 người chơi qua 3 vòng
            result = run_simulation(
                player_count=40,
                num_rounds=3,
                num_chunks=4,
                export_cdn=False,
            )
            assert result["player_count"] == 40
            assert result["num_rounds"] == 3
            assert len(result["top32"]) == 32
            assert result["total_time_sec"] < 5.0  # Phải hoàn thành cực nhanh

            # Thử nghiệm đồng bộ publish_data
            export_published_json(
                players_map={p["id"]: p for p in generate_mock_players(40)},
                round_num=3,
                total_rounds=3,
                round_matches=[],
                output_dir=temp_dir,
            )
            success = publish_data(published_dir=temp_dir, target_frontend_dir=temp_frontend)
            assert success is True
            assert os.path.exists(os.path.join(temp_frontend, "standings.json"))
            assert os.path.exists(os.path.join(temp_frontend, "top32.json"))
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)
