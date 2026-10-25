"""
Top 32 Knockout Package — Tái cấu trúc mô-đun hóa cho Vòng Chung Kết OTTv2 Tournament.
Export router đảm bảo tương thích 100% với `from app.features.admin.top32 import router`.
"""

from .router import router

__all__ = ["router"]
