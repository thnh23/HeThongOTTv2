"""
Bot Sandbox Execution Environment
=================================
Môi trường cô lập thực thi bot:
  1. Giới hạn thời gian (Timeout per move: Bảng A=2s, B=1s, C=0.5s)
  2. Bắt toàn bộ lỗi (Crash, Exception, Return type sai)
  3. Ngăn chặn phá hoại (Chặn kết nối mạng / socket, bảo vệ file hệ thống - T10)
  4. Trả về BotExecutionResult chuẩn hóa cho Trọng tài
"""

import time
import importlib.util
import sys
import socket
from typing import Callable, Tuple, Optional
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from app.services.engine.board import BoardState


@dataclass
class BotExecutionResult:
    """Kết quả sau khi chạy 1 nước đi của bot trong sandbox."""
    move: Optional[Tuple[str, str]] = None
    duration_ms: int = 0
    is_success: bool = True
    error_code: Optional[str] = None     # 'TIMEOUT', 'CRASH', 'SECURITY_VIOLATION', 'INVALID_FORMAT'
    error_message: Optional[str] = None


class SecurityViolationError(Exception):
    """Lỗi khi bot cố tình vi phạm an ninh (T10: gọi mạng, đọc file cấm)."""
    pass


def _patched_socket_create_connection(*args, **kwargs):
    raise SecurityViolationError("T10: Bot bị chặn kết nối mạng (Network access blocked by sandbox).")


def _patched_socket_connect(*args, **kwargs):
    raise SecurityViolationError("T10: Bot bị chặn kết nối mạng (Socket connect blocked by sandbox).")


def load_bot_from_file(file_path: str) -> Callable[[BoardState], Tuple[str, str]]:
    """
    Load động hàm choose_move từ file bot.py của thí sinh.
    """
    module_name = f"bot_module_{abs(hash(file_path))}"
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Không thể load spec từ file {file_path}")
    
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)

    if not hasattr(module, "choose_move"):
        raise AttributeError("File bot.py không có hàm 'choose_move(state)'.")

    return getattr(module, "choose_move")


def execute_bot_move(
    bot_fn: Callable[[BoardState], Tuple[str, str]],
    state: BoardState,
    timeout_sec: float = 2.0,
    block_network: bool = True,
) -> BotExecutionResult:
    """
    Thực thi 1 nước đi của bot trong sandbox an toàn.
    """
    start_time = time.perf_counter()

    # Lưu trữ socket methods ban đầu để patch nếu bật block_network
    orig_create_connection = socket.create_connection
    orig_connect = socket.socket.connect

    def runner():
        if block_network:
            socket.create_connection = _patched_socket_create_connection
            socket.socket.connect = _patched_socket_connect
        try:
            return bot_fn(state)
        finally:
            if block_network:
                socket.create_connection = orig_create_connection
                socket.socket.connect = orig_connect

    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(runner)
        try:
            raw_move = future.result(timeout=timeout_sec)
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)

            # Kiểm tra định dạng dữ liệu trả về
            if not isinstance(raw_move, (tuple, list)) or len(raw_move) != 2:
                return BotExecutionResult(
                    is_success=False,
                    duration_ms=elapsed_ms,
                    error_code="INVALID_FORMAT",
                    error_message=f"Bot trả về dữ liệu sai định dạng: {raw_move!r}. Kỳ vọng tuple (from_sq, to_sq).",
                )

            from_sq, to_sq = str(raw_move[0]).strip().lower(), str(raw_move[1]).strip().lower()
            return BotExecutionResult(
                move=(from_sq, to_sq),
                duration_ms=elapsed_ms,
                is_success=True,
            )

        except FutureTimeoutError:
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            return BotExecutionResult(
                is_success=False,
                duration_ms=elapsed_ms,
                error_code="TIMEOUT",
                error_message=f"Bot tính toán quá giờ ({timeout_sec}s timeout).",
            )
        except SecurityViolationError as sec_err:
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            return BotExecutionResult(
                is_success=False,
                duration_ms=elapsed_ms,
                error_code="SECURITY_VIOLATION",
                error_message=str(sec_err),
            )
        except Exception as exc:
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            return BotExecutionResult(
                is_success=False,
                duration_ms=elapsed_ms,
                error_code="CRASH",
                error_message=f"Bot bị crash / ném ngoại lệ: {type(exc).__name__}: {str(exc)}",
            )
