"""
Admin Router Package — Tái cấu trúc mô-đun hóa cho Hệ thống Giải Đấu OTTv2
========================================================================
Bao gồm các sub-routers:
  - users: Quản lý thí sinh, điểm học phần, xem bài nộp (.zip, bot.py, report, git_log)
  - swiss: Vận hành giải đấu Thụy Sĩ (Swiss 13 Vòng), bốc thăm, chia 10 chunks, nạp kết quả
  - pipeline: Tiếp nhận Google Form, clone Git đa luồng, kiểm thử sandbox, xuất báo cáo
  - top32: Cấu hình vòng chung kết Top 32 Knockout & chướng ngại vật
  - legacy: Giải đấu Round-Robin cũ & seed data bảo trì

Tất cả các route vẫn giữ nguyên URL tiền tố /api/admin/* để đảm bảo tương thích 100%
với Frontend và các kịch bản kiểm thử API.
"""

from fastapi import APIRouter

from app.routers.admin.users import router as users_router
from app.routers.admin.swiss import router as swiss_router
from app.routers.admin.pipeline import router as pipeline_router
from app.routers.admin.top32 import router as top32_router
from app.routers.admin.legacy import router as legacy_router

router = APIRouter(prefix="/api/admin", tags=["admin"])

# Gom các sub-router lại thành router duy nhất
router.include_router(users_router)
router.include_router(swiss_router)
router.include_router(pipeline_router)
router.include_router(top32_router)
router.include_router(legacy_router)
