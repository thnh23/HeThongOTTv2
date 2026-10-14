"""
Unit Tests for Referee & Match Execution
"""

import pytest
from app.services.engine.referee import play_match
from app.services.starter_bots.random_bot import choose_move as random_bot
from app.services.starter_bots.greedy_bot import choose_move as greedy_bot
from app.services.starter_bots.faulty_bots import (
    timeout_bot,
    crash_bot,
    illegal_move_bot,
    network_bot,
)


class TestRefereeMatches:
    """Kiểm tra điều phối ván đấu giữa các bot."""

    def test_random_vs_random_match_completes(self):
        """Hai bot hợp lệ đấu với nhau phải hoàn thành trọn vẹn và sinh replay."""
        result = play_match(
            bot_white_fn=random_bot,
            bot_black_fn=random_bot,
            bot_white_name="RandomW",
            bot_black_name="RandomB",
            timeout_sec=0.5,
            max_moves=40,
        )
        assert result.match_id is not None
        assert result.total_moves > 0
        assert len(result.moves) == result.total_moves
        assert len(result.states) == result.total_moves + 1
        assert result.end_code in ("W1", "W2", "D1", "D2", "T1")

        replay_dict = result.to_replay_dict()
        assert replay_dict["total_moves"] == result.total_moves
        assert "moves" in replay_dict
        assert "states" in replay_dict

    def test_greedy_vs_random_match(self):
        result = play_match(
            bot_white_fn=greedy_bot,
            bot_black_fn=random_bot,
            bot_white_name="GreedyW",
            bot_black_name="RandomB",
            timeout_sec=0.5,
            max_moves=30,
        )
        assert result.total_moves > 0

    def test_timeout_bot_loses_with_t1(self):
        """Bot Trắng timeout -> Bot Đen thắng với mã T1."""
        result = play_match(
            bot_white_fn=timeout_bot,
            bot_black_fn=random_bot,
            bot_white_name="TimeoutW",
            bot_black_name="RandomB",
            timeout_sec=0.1,
        )
        assert result.winner == 'B'
        assert result.end_code == "T1"
        assert "T1" in result.reason

    def test_crash_bot_loses_with_t1(self):
        """Bot Trắng crash -> Bot Đen thắng với mã T1."""
        result = play_match(
            bot_white_fn=crash_bot,
            bot_black_fn=random_bot,
            bot_white_name="CrashW",
            bot_black_name="RandomB",
        )
        assert result.winner == 'B'
        assert result.end_code == "T1"
        assert "T1" in result.reason

    def test_illegal_move_bot_loses_with_t1(self):
        """Bot Trắng đi nước sai luật -> Bot Đen thắng với mã T1."""
        result = play_match(
            bot_white_fn=illegal_move_bot,
            bot_black_fn=random_bot,
            bot_white_name="IllegalW",
            bot_black_name="RandomB",
        )
        assert result.winner == 'B'
        assert result.end_code == "T1"
        assert "T1" in result.reason

    def test_network_violation_loses_with_t1(self):
        """Bot Trắng gọi mạng ngoài sandbox -> Bot Đen thắng với mã T1."""
        result = play_match(
            bot_white_fn=network_bot,
            bot_black_fn=random_bot,
            bot_white_name="NetworkW",
            bot_black_name="RandomB",
        )
        assert result.winner == 'B'
        assert result.end_code == "T1"
        assert "T1" in result.reason
