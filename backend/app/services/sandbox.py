"""
Bot Sandbox Execution Environment (Subprocess Isolated)
========================================================
Môi trường cô lập thực thi bot:
  1. Giới hạn thời gian (Timeout per move: 300ms tiêu chuẩn toàn giải)
  2. Bắt toàn bộ lỗi (Crash, Exception, Return type sai)
  3. Ngăn chặn phá hoại (Chặn kết nối mạng / socket, bảo vệ file hệ thống - T10)
  4. Trả về BotExecutionResult chuẩn hóa cho Trọng tài
  5. Chạy trên tiến trình con độc lập (Subprocess), ngắt dứt điểm bằng proc.kill(),
     không để lại zombie thread và dọn sạch biến môi trường (.env).
  6. Bấm giờ đo đạc chuẩn xác riêng thời gian hàm choose_move() chạy, loại trừ
     chi phí bật tiến trình Python của hệ điều hành / Cloud (Render).
"""

import sys
import os
import ast
import time
import json
import base64
import pickle
import subprocess
import importlib.util
from typing import Callable, Tuple, Optional
from dataclasses import dataclass

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


def _get_clean_env() -> dict[str, str]:
    """
    Tạo môi trường thực thi sạch cho tiến trình con.
    Loại bỏ toàn bộ biến môi trường nhạy cảm (.env, SECRET_KEY, DATABASE_URL).
    Chỉ giữ lại các biến tối thiểu của hệ điều hành để chạy Python.
    """
    allowed_keys = {
        "SYSTEMROOT", "WINDIR", "PATH", "PATHEXT", "TEMP", "TMP",
        "LOCALAPPDATA", "APPDATA", "USERPROFILE", "HOMEPATH", "HOMEDRIVE",
        "LANG", "LC_ALL", "TZ"
    }
    clean_env = {k: v for k, v in os.environ.items() if k.upper() in allowed_keys}
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
    clean_env["PYTHONPATH"] = backend_dir
    clean_env["PYTHONUNBUFFERED"] = "1"
    clean_env["PYTHONIOENCODING"] = "utf-8"
    return clean_env


def load_bot_from_file(file_path: str) -> Callable[[BoardState], Tuple[str, str]]:
    """
    Load động hàm choose_move từ file bot.py của thí sinh.
    Kiểm tra cú pháp và cấu trúc hàm bằng AST trước khi khởi tạo wrapper.
    """
    abs_path = os.path.abspath(file_path)
    if not os.path.isfile(abs_path):
        raise FileNotFoundError(f"Không tìm thấy file bot tại {file_path}")

    # 1. Parse AST để kiểm tra tính hợp lệ về cú pháp mà không chạy code độc
    with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
        source_code = f.read()

    try:
        tree = ast.parse(source_code, filename=abs_path)
    except SyntaxError as e:
        raise SyntaxError(f"File bot.py bị lỗi cú pháp: {e}")

    has_choose_move = any(
        isinstance(node, ast.FunctionDef) and node.name == "choose_move"
        for node in ast.walk(tree)
    )
    if not has_choose_move:
        raise AttributeError("File bot.py không có hàm 'choose_move(state)'.")

    # Tạo bot callable mang thuộc tính _bot_file_path để execute_bot_move nhận diện
    def bot_fn(state: BoardState) -> Tuple[str, str]:
        module_name = f"bot_module_{abs(hash(abs_path))}"
        spec = importlib.util.spec_from_file_location(module_name, abs_path)
        if spec is None or spec.loader is None:
            raise ImportError(f"Không thể load spec từ file {abs_path}")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return getattr(module, "choose_move")(state)

    bot_fn._bot_file_path = abs_path
    bot_fn.__name__ = "choose_move"
    return bot_fn


def execute_bot_move(
    bot_fn: Callable[[BoardState], Tuple[str, str]],
    state: BoardState,
    timeout_sec: float = 0.3,
    block_network: bool = True,
    allow_fast_path: bool = True,
) -> BotExecutionResult:
    """
    Thực thi 1 nước đi của bot trong subprocess độc lập an toàn.
    Hỗ trợ fast-path cho bot chuẩn hệ thống (random, greedy, obstacle) để tối ưu hiệu năng.
    Áp dụng giới hạn cứng 300ms/nước đi: Nước đi quá 300ms bị ngắt ngay và xử thua T1.
    """
    start_time = time.perf_counter()

    # Fast-path cho official starter bots (tiết kiệm 150ms spawn process mỗi nước cờ)
    is_trusted_bot = getattr(bot_fn, "_is_trusted", False) or (
        hasattr(bot_fn, "__module__")
        and bot_fn.__module__ in (
            "app.services.starter_bots.random_bot",
            "app.services.starter_bots.greedy_bot",
            "app.services.starter_bots.obstacle_bot",
        )
    )
    if allow_fast_path and is_trusted_bot:
        try:
            move = bot_fn(state)
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            if elapsed_ms > int(timeout_sec * 1000):
                return BotExecutionResult(
                    is_success=False,
                    duration_ms=elapsed_ms,
                    error_code="TIMEOUT",
                    error_message=f"Bot tính toán quá giờ ({elapsed_ms}ms > {int(timeout_sec * 1000)}ms).",
                )
            if (
                not isinstance(move, (tuple, list))
                or len(move) != 2
                or not isinstance(move[0], str)
                or not isinstance(move[1], str)
            ):
                return BotExecutionResult(
                    is_success=False,
                    duration_ms=elapsed_ms,
                    error_code="INVALID_FORMAT",
                    error_message=f"Bot trả về sai định dạng: {move}",
                )
            return BotExecutionResult(
                is_success=True,
                move=(move[0], move[1]),
                duration_ms=elapsed_ms,
            )
        except Exception as e:
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            return BotExecutionResult(
                is_success=False,
                duration_ms=elapsed_ms,
                error_code="CRASH",
                error_message=f"Lỗi thực thi bot: {str(e)}",
            )

    # 1. Định danh target thực thi
    if hasattr(bot_fn, "_bot_file_path"):
        target_info = {"type": "file", "path": bot_fn._bot_file_path}
    elif (
        hasattr(bot_fn, "__module__")
        and hasattr(bot_fn, "__name__")
        and bot_fn.__module__ != "__main__"
        and bot_fn.__module__ in sys.modules
        and getattr(sys.modules[bot_fn.__module__], bot_fn.__name__, None) is bot_fn
    ):
        target_info = {
            "type": "module",
            "module": bot_fn.__module__,
            "name": bot_fn.__name__,
        }
    elif hasattr(bot_fn, "__code__"):
        import marshal
        code_b64 = base64.b64encode(marshal.dumps(bot_fn.__code__)).decode("ascii")
        target_info = {"type": "code", "data": code_b64}
    else:
        try:
            pickled = base64.b64encode(pickle.dumps(bot_fn)).decode("ascii")
            target_info = {"type": "pickle", "data": pickled}
        except Exception as e:
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            return BotExecutionResult(
                is_success=False,
                duration_ms=elapsed_ms,
                error_code="CRASH",
                error_message=f"Không thể serialize bot function: {e}",
            )

    # 2. Serialize trạng thái bàn cờ
    state_b64 = base64.b64encode(pickle.dumps(state)).decode("ascii")
    payload = {
        "target": target_info,
        "state_b64": state_b64,
        "block_network": block_network,
    }
    payload_json = json.dumps(payload)

    runner_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "sandbox_runner.py"))
    cmd = [sys.executable, runner_path]
    clean_env = _get_clean_env()

    # 3. Khởi tạo Subprocess
    try:
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            env=clean_env,
        )
    except Exception as e:
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        return BotExecutionResult(
            is_success=False,
            duration_ms=elapsed_ms,
            error_code="CRASH",
            error_message=f"Không thể khởi chạy sandbox process: {e}",
        )

    # 4. Giao tiếp và xử lý Timeout
    # Nới trần timeout của tiến trình con để bù trừ chi phí khởi tạo Python runtime trên Cloud (Render)
    proc_timeout = max(2.5, timeout_sec + 2.0)
    try:
        stdout_data, stderr_data = proc.communicate(input=payload_json, timeout=proc_timeout)
    except subprocess.TimeoutExpired:
        # DỨT ĐIỂM TIMEOUT: Kill tiến trình con ngay lập tức
        try:
            proc.kill()
            proc.wait(timeout=1.0)
        except Exception:
            pass
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        return BotExecutionResult(
            is_success=False,
            duration_ms=elapsed_ms,
            error_code="TIMEOUT",
            error_message=f"Bot tính toán quá giờ ({timeout_sec}s timeout).",
        )
    except Exception as e:
        try:
            proc.kill()
            proc.wait(timeout=1.0)
        except Exception:
            pass
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        return BotExecutionResult(
            is_success=False,
            duration_ms=elapsed_ms,
            error_code="CRASH",
            error_message=f"Lỗi ngoại lệ trong sandbox: {e}",
        )

    elapsed_ms = int((time.perf_counter() - start_time) * 1000)

    # 5. Phân tích kết quả từ Delimiter
    if "__SANDBOX_START__" in stdout_data and "__SANDBOX_END__" in stdout_data:
        try:
            json_str = stdout_data.split("__SANDBOX_START__")[1].split("__SANDBOX_END__")[0].strip()
            res_dict = json.loads(json_str)

            # Ưu tiên lấy duration_ms đo nội bộ hàm choose_move() từ sandbox runner
            pure_ms = res_dict.get("duration_ms")
            actual_duration = pure_ms if pure_ms is not None else elapsed_ms

            # Kiểm tra thời gian suy nghĩ thực tế của bot có vượt quá ngưỡng timeout quy định (vd: 300ms) không
            if actual_duration > int(timeout_sec * 1000):
                return BotExecutionResult(
                    is_success=False,
                    duration_ms=actual_duration,
                    error_code="TIMEOUT",
                    error_message=f"Bot tính toán quá giờ ({actual_duration}ms > {int(timeout_sec * 1000)}ms).",
                )

            if res_dict.get("is_success", False):
                move_list = res_dict["move"]
                return BotExecutionResult(
                    move=(move_list[0], move_list[1]),
                    duration_ms=actual_duration,
                    is_success=True,
                )
            else:
                return BotExecutionResult(
                    is_success=False,
                    duration_ms=actual_duration,
                    error_code=res_dict.get("error_code", "CRASH"),
                    error_message=res_dict.get("error_message", "Unknown error"),
                )
        except Exception as e:
            return BotExecutionResult(
                is_success=False,
                duration_ms=elapsed_ms,
                error_code="CRASH",
                error_message=f"Không thể parse kết quả JSON từ sandbox runner: {e}",
            )
    else:
        err_msg = stderr_data.strip() or stdout_data.strip() or "Tiến trình sandbox bị đóng bất thường."
        return BotExecutionResult(
            is_success=False,
            duration_ms=elapsed_ms,
            error_code="CRASH",
            error_message=f"Sandbox crash: {err_msg}",
        )
