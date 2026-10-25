"""
Admin Sub-router — Pipeline Thẩm Định Toàn Diện & Google Form Ingestion
"""

import os
import io
import csv
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.submission import Submission
from app.services.pipeline_service import global_pipeline_progress, run_batch_import_pipeline

router = APIRouter(tags=["admin-pipeline"])


@router.post("/pipeline/start")
async def start_import_and_verification_pipeline(
    file: Optional[UploadFile] = File(None),
    csv_text: Optional[str] = Form(None),
    deadline: Optional[str] = Form(None),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
):
    """
    Khởi động Pipeline thẩm định toàn diện cho 2.000 sinh viên:
    1. Parse CSV & Khử trùng lặp.
    2. Git Clone song song đa luồng.
    3. Checkout commit đúng thời điểm trước Deadline.
    4. Validate cấu trúc T08 & Quét an ninh T09.
    5. Kiểm thử Sandbox thực chiến với GreedyBot.
    6. Chấm điểm MOSS tương đồng mã nguồn AST.
    """
    if global_pipeline_progress.is_running:
        raise HTTPException(
            status_code=400,
            detail="Pipeline đang chạy! Vui lòng chờ đợt xử lý hiện tại hoàn tất hoặc kiểm tra thanh tiến độ.",
        )

    raw_content = ""
    if file:
        file_bytes = await file.read()
        raw_content = file_bytes.decode("utf-8-sig", errors="ignore")
    elif csv_text:
        raw_content = csv_text.strip()
    else:
        raise HTTPException(status_code=400, detail="Vui lòng cung cấp file CSV hoặc nội dung CSV từ Google Form!")

    if not raw_content:
        raise HTTPException(status_code=400, detail="Nội dung CSV rỗng!")

    background_tasks.add_task(
        run_batch_import_pipeline,
        raw_csv=raw_content,
        deadline_str=deadline,
    )

    return {
        "success": True,
        "message": "Đã khởi động Pipeline Thẩm định Tự động ngầm! Theo dõi tiến độ tại tab Tiến Trình.",
    }


@router.get("/pipeline/status")
def get_pipeline_status():
    """Lấy trạng thái và tiến độ phần trăm thời gian thực của Pipeline."""
    return global_pipeline_progress.to_dict()


@router.get("/pipeline/export-report")
def export_verification_report(db: Session = Depends(get_db)):
    """Xuất file CSV báo cáo toàn bộ kết quả thẩm định để báo cáo Ban Tổ Chức."""
    users = db.query(User).all()

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "MSSV", "Họ và tên", "Email", "Lớp", "Link GitHub", "Tên Bot",
        "Trạng thái nộp", "Số Commit", "Commit Hash chốt", "Thời gian Commit",
        "bot.py", "choose_move()", "REPORT.md", "git_log.txt",
        "Kết quả Sandbox Test", "Tỉ lệ MOSS (%)", "Lỗi thẩm định",
    ])

    for u in users:
        sub = db.query(Submission).filter(Submission.user_id == u.id, Submission.is_active == True).first()
        val = sub.validation if sub and sub.validation else {}
        val_det = val.get("details", {})
        test_run = sub.test_run_result if sub and sub.test_run_result else {}

        writer.writerow([
            u.student_id or "",
            u.name,
            u.email,
            u.class_name or "",
            u.github_repo_url or "",
            u.bot_name or "",
            sub.status if sub else "Chưa nộp",
            u.commit_count or (sub.commit_count if sub else 0),
            test_run.get("checked_out_commit", ""),
            test_run.get("commit_date", ""),
            "ĐẠT" if val_det.get("bot_py") else "THIẾU",
            "ĐẠT" if val_det.get("choose_move_fn") else "THIẾU",
            "ĐẠT" if val_det.get("report_md") else "THIẾU",
            "ĐẠT" if val_det.get("git_log") else "THIẾU",
            test_run.get("status", "N/A"),
            f"{u.moss_similarity}%" if u.moss_similarity is not None else "0%",
            "; ".join(val.get("errors", [])),
        ])

    csv_data = output.getvalue().encode("utf-8-sig")
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=bao_cao_doi_soat_thi_sinh_ottv2.csv"},
    )

