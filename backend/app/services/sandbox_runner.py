"""
Ephemeral Subprocess Runner for Bot Execution (Sandbox T10)
===========================================================
Tiến trình con độc lập để thực thi bot của thí sinh:
  - Cô lập không gian nhớ hoàn toàn với FastAPI server chính
  - Chặn kết nối mạng (socket) nếu block_network=True
  - Bắt toàn bộ lỗi (Crash, Exception, Return type)
  - Trả về JSON kết quả qua stdout được bọc bởi delimiter
"""

import sys
import os
import json
import socket
import pickle
import base64
import importlib
import importlib.util
from typing import Any, Dict


class SecurityViolationError(Exception):
    """Lỗi khi bot cố tình vi phạm an ninh (T10: gọi mạng, đọc file cấm)."""
    pass


def _patched_socket_create_connection(*args, **kwargs):
    raise SecurityViolationError("T10: Bot bị chặn kết nối mạng (Network access blocked by sandbox).")


def _patched_socket_connect(*args, **kwargs):
    raise SecurityViolationError("T10: Bot bị chặn kết nối mạng (Socket connect blocked by sandbox).")


def _output_result(res: Dict[str, Any]) -> None:
    output_str = f"__SANDBOX_START__\n{json.dumps(res)}\n__SANDBOX_END__\n"
    sys.__stdout__.write(output_str)
    sys.__stdout__.flush()


def main():
    try:
        raw_input = sys.stdin.read()
        if not raw_input:
            _output_result({
                "is_success": False,
                "error_code": "CRASH",
                "error_message": "Không nhận được payload dữ liệu trong sandbox runner."
            })
            return

        payload = json.loads(raw_input)
        block_network = payload.get("block_network", True)

        if block_network:
            socket.create_connection = _patched_socket_create_connection
            socket.socket.connect = _patched_socket_connect

        # 1. Khôi phục trạng thái bàn cờ (BoardState)
        state_bytes = base64.b64decode(payload["state_b64"])
        state = pickle.loads(state_bytes)

        # 2. Khôi phục hàm bot
        target = payload["target"]
        target_type = target["type"]

        if target_type == "file":
            file_path = os.path.abspath(target["path"])
            bot_dir = os.path.dirname(file_path)
            if bot_dir not in sys.path:
                sys.path.insert(0, bot_dir)
            module_name = f"bot_module_{abs(hash(file_path))}"
            spec = importlib.util.spec_from_file_location(module_name, file_path)
            if spec is None or spec.loader is None:
                raise ImportError(f"Không thể load spec từ file {file_path}")
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            if not hasattr(module, "choose_move"):
                raise AttributeError("File bot.py không có hàm 'choose_move(state)'.")
            bot_fn = getattr(module, "choose_move")
        elif target_type == "module":
            mod = importlib.import_module(target["module"])
            bot_fn = getattr(mod, target["name"])
        elif target_type == "code":
            import marshal
            import types
            import app.services.engine.board as board_mod
            code_bytes = base64.b64decode(target["data"])
            code_obj = marshal.loads(code_bytes)
            ns = {
                "__builtins__": __builtins__,
                "BoardState": board_mod.BoardState,
                "create_initial_board": board_mod.create_initial_board,
            }
            bot_fn = types.FunctionType(code_obj, ns)
        elif target_type == "pickle":
            bot_fn = pickle.loads(base64.b64decode(target["data"]))
        else:
            raise ValueError(f"Target type không hợp lệ: {target_type}")

        # 3. Thực thi bot và bắt trọn output stdout để tránh làm hỏng JSON protocol
        orig_stdout = sys.stdout
        sys.stdout = sys.stderr
        try:
            raw_move = bot_fn(state)
        finally:
            sys.stdout = orig_stdout

        # 4. Kiểm tra định dạng dữ liệu trả về
        if not isinstance(raw_move, (tuple, list)) or len(raw_move) != 2:
            result = {
                "is_success": False,
                "error_code": "INVALID_FORMAT",
                "error_message": f"Bot trả về dữ liệu sai định dạng: {raw_move!r}. Kỳ vọng tuple (from_sq, to_sq).",
            }
        else:
            from_sq = str(raw_move[0]).strip().lower()
            to_sq = str(raw_move[1]).strip().lower()
            result = {
                "is_success": True,
                "move": [from_sq, to_sq],
            }

    except SecurityViolationError as sec_err:
        result = {
            "is_success": False,
            "error_code": "SECURITY_VIOLATION",
            "error_message": str(sec_err),
        }
    except Exception as exc:
        result = {
            "is_success": False,
            "error_code": "CRASH",
            "error_message": f"{type(exc).__name__}: {str(exc)}",
        }

    _output_result(result)


if __name__ == "__main__":
    main()
