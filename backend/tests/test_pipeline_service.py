"""
Unit Tests for Pipeline Service (Google Form Batch Ingestion & Deduplication)
"""

import pytest
from datetime import datetime
from app.services.pipeline_service import (
    parse_flexible_datetime,
    clean_student_id,
    clean_github_url,
    parse_google_form_csv_with_dedup,
    PipelineProgressManager,
)


class TestPipelineHelpers:
    """Kiểm thử các hàm tiện ích chuẩn hóa dữ liệu."""

    def test_clean_student_id(self):
        assert clean_student_id(" 22028123 ") == "22028123"
        assert clean_student_id("2202-8123") == "22028123"
        assert clean_student_id("sv_01") == "sv01"

    def test_clean_github_url(self):
        assert clean_github_url("https://github.com/user/repo") == "https://github.com/user/repo.git"
        assert clean_github_url("https://github.com/user/repo.git") == "https://github.com/user/repo.git"
        assert clean_github_url("https://github.com/user/repo/tree/main") == "https://github.com/user/repo.git"
        assert clean_github_url("https://github.com/user/repo/blob/master/bot.py") == "https://github.com/user/repo.git"

    def test_parse_flexible_datetime(self):
        dt1 = parse_flexible_datetime("2026-10-25T23:59:00")
        assert dt1 is not None and dt1.year == 2026 and dt1.month == 10 and dt1.day == 25

        dt2 = parse_flexible_datetime("25/10/2026 23:59:00")
        assert dt2 is not None and dt2.day == 25 and dt2.hour == 23


class TestDeduplicationAndDeadlineFilter:
    """Kiểm thử thuật toán khử trùng lặp và lọc theo hạn chót."""

    def test_dedup_multiple_submissions(self):
        # Giả lập sinh viên 22028123 nộp 3 lần với 3 link repo khác nhau
        csv_data = """Dấu thời gian,Họ và tên,Mã sinh viên,Email,Link GitHub Repository,Tên Bot
2026-10-20 10:00:00,Nguyễn Văn A,22028123,22028123@vnu.edu.vn,https://github.com/nva/repo1,BotV1
2026-10-21 14:00:00,Nguyễn Văn A,22028123,22028123@vnu.edu.vn,https://github.com/nva/repo2,BotV2
2026-10-22 09:30:00,Nguyễn Văn A,22028123,22028123@vnu.edu.vn,https://github.com/nva/repo_final,BotFinal
2026-10-22 10:00:00,Trần Thị B,22028124,22028124@vnu.edu.vn,https://github.com/ttb/ott_bot,BotB
"""
        accepted, stats = parse_google_form_csv_with_dedup(csv_data, deadline_str="2026-10-25 23:59:59")
        assert stats["total_rows"] == 4
        assert stats["unique_students"] == 2
        assert stats["accepted"] == 2
        assert stats["duplicates_removed"] == 2

        # Kiểm tra bản ghi của Nguyễn Văn A phải là bản ghi cuối cùng (BotFinal)
        nva = next(s for s in accepted if s["student_id"] == "22028123")
        assert nva["bot_name"] == "BotFinal"
        assert "repo_final" in nva["github_repo_url"]

    def test_deadline_cutoff_late_submission(self):
        # Sinh viên nộp trước và sau hạn chót (Deadline: 2026-10-22 00:00:00)
        csv_data = """Dấu thời gian,Họ và tên,Mã sinh viên,Email,Link GitHub Repository,Tên Bot
2026-10-21 22:00:00,Lê Văn C,22028125,22028125@vnu.edu.vn,https://github.com/lvc/valid_repo,BotOnTime
2026-10-23 08:00:00,Lê Văn C,22028125,22028125@vnu.edu.vn,https://github.com/lvc/late_repo,BotLate
2026-10-24 10:00:00,Phạm Văn D,22028126,22028126@vnu.edu.vn,https://github.com/pvd/super_late,BotAllLate
"""
        accepted, stats = parse_google_form_csv_with_dedup(csv_data, deadline_str="2026-10-22 00:00:00")
        assert stats["unique_students"] == 2

        # Lê Văn C có lần 1 trước deadline -> chọn lần 1 (BotOnTime), bỏ qua lần 2
        lvc = next(s for s in accepted if s["student_id"] == "22028125")
        assert lvc["bot_name"] == "BotOnTime"
        assert "valid_repo" in lvc["github_repo_url"]
        assert not lvc.get("late_rejected")

        # Phạm Văn D toàn bộ nộp sau deadline -> đánh dấu late_rejected
        pvd = next(s for s in accepted if s["student_id"] == "22028126")
        assert pvd.get("late_rejected") is True


class TestProgressManager:
    """Kiểm thử trạng thái tiến trình thời gian thực."""

    def test_progress_tracking(self):
        pm = PipelineProgressManager()
        pm.start(task_id="task_123", total=10, deadline_str="2026-10-25")
        assert pm.status == "running"
        assert pm.total == 10

        pm.update_item("22028123", is_valid=True)
        pm.update_item("22028124", is_valid=False, error="Repo Private")

        status = pm.get_status()
        assert status["processed"] == 2
        assert status["valid_count"] == 1
        assert status["invalid_count"] == 1
        assert status["percentage"] == 20
        assert len(status["errors"]) == 1

        pm.complete("Xong")
        assert pm.status == "completed"
