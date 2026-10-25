"""
Pydantic V2 Schemas cho Vòng Chung Kết Top 32 Knockout.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class RunRoundRequest(BaseModel):
    round_type: str = Field(..., description="Loại vòng đấu: 'r32', 'r16', 'qf', 'sf', 'final'")
    force_rerun: bool = Field(False, description="Bắt buộc chạy lại toàn bộ trận đấu kể cả khi đã có kết quả")


class Top32ConfigRequest(BaseModel):
    obstacles: List[str] = Field(default_factory=list, description="Danh sách tọa độ ô chướng ngại vật (vd: ['d4', 'd6', 'e5', 'f4', 'f6'])")
    rules_announcement: Optional[str] = Field("", description="Thông báo cập nhật luật thi đấu gửi thí sinh")
