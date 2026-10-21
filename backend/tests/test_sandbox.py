"""
Unit Tests for Sandbox Execution & Isolation (T07, T10)
"""

import pytest
from app.services.engine.board import create_initial_board
from app.services.sandbox import execute_bot_move
from app.services.starter_bots.random_bot import choose_move as random_bot
from app.services.starter_bots.faulty_bots import (
    timeout_bot,
    crash_bot,
    invalid_format_bot,
    network_bot,
)


class TestSandboxExecution:
    """Kiểm tra thực thi bot trong sandbox."""

    def test_normal_bot_execution(self):
        state = create_initial_board()
        result = execute_bot_move(random_bot, state, timeout_sec=1.0)
        assert result.is_success is True
        assert result.move is not None
        assert len(result.move) == 2
        assert result.error_code is None
        assert result.duration_ms >= 0

    def test_timeout_bot_triggers_error_t07(self):
        """T07: Bot tính toán quá giờ quy định -> Sandbox trả về TIMEOUT."""
        state = create_initial_board()
        # Đặt timeout ngắn 0.1s
        result = execute_bot_move(timeout_bot, state, timeout_sec=0.1)
        assert result.is_success is False
        assert result.error_code == "TIMEOUT"
        assert "quá giờ" in result.error_message

    def test_crash_bot_captured(self):
        """Bot ném exception -> Sandbox bắt được và không làm sập server."""
        state = create_initial_board()
        result = execute_bot_move(crash_bot, state, timeout_sec=1.0)
        assert result.is_success is False
        assert result.error_code == "CRASH"
        assert "RuntimeError" in result.error_message

    def test_invalid_format_bot_captured(self):
        """Bot trả về kiểu dữ liệu sai -> Sandbox báo lỗi định dạng."""
        state = create_initial_board()
        result = execute_bot_move(invalid_format_bot, state, timeout_sec=1.0)
        assert result.is_success is False
        assert result.error_code == "INVALID_FORMAT"

    def test_network_access_blocked_t10(self):
        """T10: Bot cố tình kết nối internet -> Sandbox chặn và báo vi phạm an ninh."""
        state = create_initial_board()
        result = execute_bot_move(network_bot, state, timeout_sec=1.0, block_network=True)
        assert result.is_success is False
        assert result.error_code == "SECURITY_VIOLATION"
        assert "T10" in result.error_message

    def test_infinite_loop_bot_killed_cleanly(self):
        """Kiểm tra bot bị vòng lặp vô tận (while True) bị kill dứt điểm đúng thời gian timeout."""
        def infinite_loop_bot(state):
            while True:
                pass

        state = create_initial_board()
        result = execute_bot_move(infinite_loop_bot, state, timeout_sec=0.2)
        assert result.is_success is False
        assert result.error_code == "TIMEOUT"
        assert "quá giờ" in result.error_message

    def test_clean_env_strips_secrets(self):
        """Kiểm tra biến môi trường nhạy cảm bị tước bỏ hoàn toàn khỏi bot."""
        import os
        os.environ["SECRET_KEY"] = "super-secret-key-12345"
        os.environ["DATABASE_URL"] = "postgresql://user:pass@localhost/db"

        def secret_stealer_bot(state):
            import os
            secret = os.environ.get("SECRET_KEY")
            db_url = os.environ.get("DATABASE_URL")
            if secret is not None or db_url is not None:
                raise RuntimeError("LEAKED_SECRET")
            return ("a1", "a2")

        state = create_initial_board()
        result = execute_bot_move(secret_stealer_bot, state, timeout_sec=1.0)
        assert result.is_success is True
        assert result.move == ("a1", "a2")

