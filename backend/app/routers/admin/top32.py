"""
Admin Sub-router — Vòng Chung Kết Top 32 & Cấu Hình Ô Chướng Ngại Vật
"""

import os
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.routers.admin.common import (
    Top32ConfigRequest,
    SWISS_STORAGE_DIR,
)

router = APIRouter(tags=["admin-top32"])


@router.get("/top32/config")
def get_top32_config(db: Session = Depends(get_db)):
    """Lấy danh sách hạt giống Top 32 và cấu hình các ô chướng ngại vật."""
    config_file = os.path.join(SWISS_STORAGE_DIR, "top32_config.json")
    default_obstacles = ["d4", "d6", "f4", "f6", "e5"]
    announcement = "Vòng Chung kết Top 32 áp dụng luật bàn cờ có ô chướng ngại vật cấm đi vào tại 5 vị trí: d4, d6, f4, f6, e5."

    if os.path.exists(config_file):
        try:
            with open(config_file, "r", encoding="utf-8") as f:
                saved = json.load(f)
                default_obstacles = saved.get("obstacles", default_obstacles)
                announcement = saved.get("rules_announcement", announcement)
        except Exception:
            pass

    # Lấy danh sách Top 32 thí sinh từ DB
    top32_users = (
        db.query(User)
        .filter(User.is_top32 == True)
        .order_by(User.swiss_wins.desc(), User.buchholz.desc())
        .limit(32)
        .all()
    )

    if not top32_users:
        # Fallback lấy 32 người điểm cao nhất
        top32_users = (
            db.query(User)
            .order_by(User.swiss_wins.desc(), User.swiss_points.desc())
            .limit(32)
            .all()
        )

    users_list = []
    for idx, u in enumerate(top32_users, 1):
        users_list.append({
            "seed": idx,
            "id": u.id,
            "name": u.name,
            "student_id": u.student_id,
            "class_name": u.class_name,
            "bot_name": u.bot_name,
            "swiss_wins": u.swiss_wins or 0,
            "swiss_points": u.swiss_points or 0,
            "github_repo_url": u.github_repo_url,
        })

    return {
        "obstacles": default_obstacles,
        "rules_announcement": announcement,
        "total_seeds": len(users_list),
        "seeds": users_list,
    }


@router.post("/top32/config")
def save_top32_config(req: Top32ConfigRequest):
    """Cập nhật cấu hình các ô chướng ngại vật cho Vòng Chung Kết Top 32."""
    config_file = os.path.join(SWISS_STORAGE_DIR, "top32_config.json")
    try:
        data = {
            "obstacles": [o.lower().strip() for o in req.obstacles if o.strip()],
            "rules_announcement": req.rules_announcement or "",
            "updated_at": datetime.now().isoformat(),
        }
        with open(config_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        return {
            "success": True,
            "obstacles": data["obstacles"],
            "message": f"Đã lưu thành công cấu hình {len(data['obstacles'])} ô chướng ngại vật cho Vòng Chung Kết!",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi lưu cấu hình Top 32: {str(e)}")
