"""
OTTv2 Tournament — Features Package (Vertical Slice / Feature-Driven Architecture)
==================================================================================
Các tính năng độc lập (Domain Features):
  - auth: Xác thực JWT, đăng ký, đăng nhập, bảo vệ endpoint
  - submission: Tiếp nhận và tra cứu bài nộp sinh viên qua Google Form & GitHub Template
  - sandbox: Sân đấu thử nghiệm bot trực quan, benchmark chướng ngại vật & kiểm tra độ trễ (<= 300ms)
  - matches: Lịch sử trận đấu, phân trang, truy xuất replay ván cờ
  - leaderboard: Bảng xếp hạng Thụy Sĩ (Swiss System), Buchholz Cut-1, Sonneborn-Berger
  - admin: Quản trị giải đấu (Pipeline thẩm định, Roster thí sinh, Swiss 13 Vòng & Top 32 Knockout)
"""

from app.features.auth.router import router as auth_router
from app.features.submission.router import router as submission_router
from app.features.sandbox.router import router as sandbox_router
from app.features.matches.router import router as matches_router
from app.features.leaderboard.router import router as leaderboard_router
from app.features.admin import router as admin_router

__all__ = [
    "auth_router",
    "submission_router",
    "sandbox_router",
    "matches_router",
    "leaderboard_router",
    "admin_router",
]
