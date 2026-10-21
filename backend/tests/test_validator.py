"""
Unit Tests for Submission Validator & Security Scanner (T08, T09)
"""

import os
import tempfile
import zipfile
import pytest

from app.services.validator import (
    validate_submission_zip,
    scan_file_for_api_keys,
    check_choose_move_in_code,
)


@pytest.fixture
def temp_dir():
    with tempfile.TemporaryDirectory() as td:
        yield td


def create_mock_zip(zip_path: str, files_dict: dict):
    """Tạo file zip với các file giả lập."""
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for file_name, content in files_dict.items():
            zf.writestr(file_name, content)


VALID_BOT_CODE = '''
def choose_move(state):
    return ("e2", "e3")
'''

INVALID_BOT_CODE = '''
def some_other_function():
    pass
'''


class TestValidatorSubmissionCriteria:
    """Kiểm tra các tiêu chí chấm: Code sinh viên (bot.py), Ý tưởng (REPORT.md), Lịch sử commit (git_log)."""

    def test_valid_package_passes(self, temp_dir):
        zip_path = os.path.join(temp_dir, "submission.zip")
        extract_to = os.path.join(temp_dir, "extracted")
        create_mock_zip(zip_path, {
            "bot.py": VALID_BOT_CODE,
            "REPORT.md": "# Báo cáo ý tưởng & chiến thuật bot OTTv2...",
            "git_log.txt": "commit 1111111\ncommit 2222222\ncommit 3333333\ncommit 4444444\ncommit 5555555\n",
        })

        result = validate_submission_zip(zip_path, extract_to, tier="A")
        assert result.is_valid is True
        assert result.details["bot_py"] is True
        assert result.details["choose_move_fn"] is True
        assert result.details["report_md"] is True
        assert result.details["git_log"] is True
        assert result.commit_count == 5
        assert len(result.errors) == 0

    def test_prompts_and_chat_not_required(self, temp_dir):
        """Khuyến khích học code: không yêu cầu PROMPTS.md hay chat_history/."""
        zip_path = os.path.join(temp_dir, "no_ai_prompts.zip")
        extract_to = os.path.join(temp_dir, "extracted")
        create_mock_zip(zip_path, {
            "bot.py": VALID_BOT_CODE,
            "REPORT.md": "# Báo cáo ý tưởng chiến thuật & hàm heuristic...",
            "git_log.txt": "commit 1111111\ncommit 2222222\ncommit 3333333\ncommit 4444444\n",
        })

        result = validate_submission_zip(zip_path, extract_to, tier="A")
        assert result.is_valid is True
        assert "prompts_md" not in result.details
        assert "chat_history" not in result.details
        assert len(result.errors) == 0

    def test_missing_report_md_rejected(self, temp_dir):
        """Thiếu REPORT.md phải bị từ chối nhận."""
        zip_path = os.path.join(temp_dir, "missing_report.zip")
        extract_to = os.path.join(temp_dir, "extracted")
        create_mock_zip(zip_path, {
            "bot.py": VALID_BOT_CODE,
            "git_log.txt": "commit 1111111\ncommit 2222222\ncommit 3333333\ncommit 4444444\n",
        })

        result = validate_submission_zip(zip_path, extract_to, tier="A")
        assert result.is_valid is False
        assert result.details["report_md"] is False
        assert any("REPORT.md" in err for err in result.errors)

    def test_empty_report_md_rejected(self, temp_dir):
        """File REPORT.md rỗng phải bị từ chối."""
        zip_path = os.path.join(temp_dir, "empty_report.zip")
        extract_to = os.path.join(temp_dir, "extracted")
        create_mock_zip(zip_path, {
            "bot.py": VALID_BOT_CODE,
            "REPORT.md": "",
            "git_log.txt": "commit 1111111\ncommit 2222222\ncommit 3333333\ncommit 4444444\n",
        })

        result = validate_submission_zip(zip_path, extract_to, tier="A")
        assert result.is_valid is False
        assert any("REPORT.md" in err for err in result.errors)

    def test_missing_bot_py_rejected(self, temp_dir):
        zip_path = os.path.join(temp_dir, "no_bot.zip")
        extract_to = os.path.join(temp_dir, "extracted")
        create_mock_zip(zip_path, {
            "REPORT.md": "Report...",
            "git_log.txt": "commit 1111111\ncommit 2222222\ncommit 3333333\ncommit 4444444\n",
        })

        result = validate_submission_zip(zip_path, extract_to, tier="A")
        assert result.is_valid is False
        assert result.details["bot_py"] is False
        assert any("bot.py" in err for err in result.errors)

    def test_missing_choose_move_fn_rejected(self, temp_dir):
        zip_path = os.path.join(temp_dir, "no_choose_move.zip")
        extract_to = os.path.join(temp_dir, "extracted")
        create_mock_zip(zip_path, {
            "bot.py": INVALID_BOT_CODE,
            "REPORT.md": "Report...",
            "git_log.txt": "commit 1111111\ncommit 2222222\ncommit 3333333\ncommit 4444444\n",
        })

        result = validate_submission_zip(zip_path, extract_to, tier="A")
        assert result.is_valid is False
        assert result.details["choose_move_fn"] is False
        assert any("choose_move" in err for err in result.errors)

    def test_missing_git_log_rejected(self, temp_dir):
        """Thiếu git_log.txt hoặc .git phải bị từ chối để xác thực sinh viên tự code."""
        zip_path = os.path.join(temp_dir, "no_git.zip")
        extract_to = os.path.join(temp_dir, "extracted")
        create_mock_zip(zip_path, {
            "bot.py": VALID_BOT_CODE,
            "REPORT.md": "Báo cáo chi tiết thuật toán Minimax...",
        })

        result = validate_submission_zip(zip_path, extract_to, tier="A")
        assert result.is_valid is False
        assert result.details["git_log"] is False
        assert any("git_log" in err for err in result.errors)


class TestSecurityScannerT09:
    """T09: Cảnh báo API key chưa che trong code hoặc lịch sử chat."""

    def test_detect_openai_api_key(self, temp_dir):
        file_path = os.path.join(temp_dir, "chat.txt")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write("Dưới đây là key: sk-abcdefghijklmnopqrstuvwxyz1234567890abcdef")

        findings = scan_file_for_api_keys(file_path)
        assert len(findings) == 1
        assert findings[0]["type"] == "OpenAI API Key"
        assert findings[0]["masked"].startswith("sk-a...")

    def test_detect_google_api_key(self, temp_dir):
        file_path = os.path.join(temp_dir, "chat.txt")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write("const geminiKey = 'AIzaSyD12345678901234567890123456789012';")

        findings = scan_file_for_api_keys(file_path)
        assert len(findings) == 1
        assert findings[0]["type"] == "Google / Gemini API Key"

    def test_warning_in_validation_result_t09(self, temp_dir):
        zip_path = os.path.join(temp_dir, "with_key.zip")
        extract_to = os.path.join(temp_dir, "extracted")
        create_mock_zip(zip_path, {
            "bot.py": VALID_BOT_CODE,
            "REPORT.md": "Báo cáo...",
            "git_log.txt": "commit 1111111\ncommit 2222222\ncommit 3333333\ncommit 4444444\n",
            "leak_config.txt": "My OpenAI Key is: sk-proj1234567890abcdefghijklmnopqrstuvwxyz",
        })

        result = validate_submission_zip(zip_path, extract_to, tier="A")
        # Gói vẫn valid về cấu trúc, nhưng có warning an ninh T09
        assert result.is_valid is True
        assert len(result.detected_api_keys) >= 1
        assert any("T09" in w for w in result.warnings)

    def test_git_log_parsing_and_commit_count(self, temp_dir):
        """Kiểm tra trích xuất commit_count từ git_log.txt."""
        zip_path = os.path.join(temp_dir, "with_git_log.zip")
        extract_to = os.path.join(temp_dir, "extracted")
        git_log_content = """commit 7f3b201a4e8d (HEAD -> main)
Author: Nguyen Van A <sv@vnu.edu.vn>
Date:   Fri Oct 23 18:20:45 2026 +0700

    perf: optimize move ordering

commit 4a9e102c3b8f
Author: Nguyen Van A <sv@vnu.edu.vn>
Date:   Thu Oct 22 15:40:12 2026 +0700

    feat: adapt obstacle avoidance

commit 2c8d503f1a7b
Author: Nguyen Van A <sv@vnu.edu.vn>
Date:   Wed Oct 21 20:15:33 2026 +0700

    feat: implement minimax

commit 9e4a701b2d6c
Author: Nguyen Van A <sv@vnu.edu.vn>
Date:   Tue Oct 20 16:30:19 2026 +0700

    feat: heuristic evaluation

commit 1b0c902a3e5f
Author: Nguyen Van A <sv@vnu.edu.vn>
Date:   Mon Oct 19 09:10:00 2026 +0700

    feat: initial commit
"""
        create_mock_zip(zip_path, {
            "bot.py": VALID_BOT_CODE,
            "PROMPTS.md": "# Prompts log đầy đủ",
            "REPORT.md": "# Báo cáo chiến thuật",
            "chat_history/session1.txt": "Log chat",
            "git_log.txt": git_log_content,
        })

        result = validate_submission_zip(zip_path, extract_to, tier="C")
        assert result.is_valid is True
        assert result.details["git_log"] is True
        assert result.commit_count == 5
        assert len(result.errors) == 0

