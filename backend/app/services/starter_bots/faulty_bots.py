"""
Faulty & Mock Bots for Testing (T07, T10, etc.)
===============================================
Các bot giả lập hành vi lỗi để kiểm thử Sandbox và Trọng tài:
  - TimeoutBot: Ngủ lâu hơn giới hạn thời gian (T07)
  - CrashBot: Ném ngoại lệ khi được gọi (T07)
  - IllegalMoveBot: Trả nước đi phạm luật (T07)
  - NetworkBot: Cố gắng kết nối mạng (T10)
  - FileAccessBot: Cố gắng đọc file hệ thống nhạy cảm (T10)
"""

import time
from typing import Tuple
from app.services.engine.board import BoardState


def timeout_bot(state: BoardState) -> Tuple[str, str]:
    """Bot giả lập bị treo hoặc tính toán quá giờ."""
    time.sleep(10.0)
    return ("a1", "a2")


def crash_bot(state: BoardState) -> Tuple[str, str]:
    """Bot giả lập ném ngoại lệ."""
    raise RuntimeError("Bot crashed unexpectedly due to ZeroDivisionError or IndexError!")


def illegal_move_bot(state: BoardState) -> Tuple[str, str]:
    """Bot trả về nước đi không hợp lệ (nhảy qua nửa bàn cờ)."""
    return ("a1", "i9")


def invalid_format_bot(state: BoardState):
    """Bot trả về dữ liệu sai format (không phải tuple (str, str))."""
    return "move to somewhere"


def network_bot(state: BoardState) -> Tuple[str, str]:
    """Bot cố tình gọi socket ra ngoài mạng internet."""
    import urllib.request
    urllib.request.urlopen("https://example.com", timeout=1)
    return ("a1", "a2")


def file_access_bot(state: BoardState) -> Tuple[str, str]:
    """Bot cố tình đọc file ngoài sandbox."""
    with open("C:/Windows/System32/drivers/etc/hosts", "r") as f:
        _ = f.read()
    return ("a1", "a2")
