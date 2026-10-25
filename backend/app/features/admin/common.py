"""
Admin Sub-router — Common Schemas & Helper Functions
"""

import os
import zipfile
import random
import subprocess
from typing import Optional, Dict, Any, Callable, Tuple, List
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.submission import Submission
from app.services.sandbox import load_bot_from_file
from app.services.starter_bots.greedy_bot import choose_move as greedy_choose_move
from app.services.starter_bots.random_bot import choose_move as random_choose_move

from app.config import settings

# Thư mục lưu trữ dữ liệu các vòng đấu Swiss
SWISS_STORAGE_DIR = os.path.join(settings.STORAGE_PATH, "tournament")


# ── Pydantic Schemas Dùng Chung ─────────────────

class UpdateUserAdminRequest(BaseModel):
    name: Optional[str] = Field(None, description="Họ và tên thí sinh")
    student_id: Optional[str] = Field(None, description="Mã sinh viên UET")
    email: Optional[str] = Field(None, description="Email VNU / cá nhân")
    class_name: Optional[str] = Field(None, description="Lớp khóa học")
    github_repo_url: Optional[str] = Field(None, description="URL Repository GitHub")
    bot_name: Optional[str] = Field(None, description="Tên định danh Bot")
    is_top32: Optional[bool] = Field(None, description="Xác nhận Top 32 hạt giống vòng Chung Kết")
    is_active: Optional[bool] = Field(None, description="Trạng thái kích hoạt tài khoản")
    is_admin: Optional[bool] = Field(None, description="Quyền quản trị viên")
    test_score: Optional[float] = Field(None, description="Điểm test đầu vào")
    commit_count: Optional[int] = Field(None, description="Số lượng Git commits")
    moss_similarity: Optional[float] = Field(None, description="Tỉ lệ trùng lặp MOSS AST (%)")
    notes: Optional[str] = Field(None, description="Ghi chú đánh giá của Quản trị viên")


class ChangeTierRequest(BaseModel):
    tier: str = Field(..., description="Bảng thi đấu mới: 'A', 'B', 'C' hoặc 'SWISS'")


class TournamentStartRequest(BaseModel):
    tier: str = Field(..., description="Bảng thi đấu cần khởi chạy: 'A', 'B', 'C' hoặc 'SWISS'")
    move_delay_sec: float = Field(0.5, ge=0.05, le=3.0, description="Độ trễ mỗi nước đi cho WebSocket live")


class SwissPairRequest(BaseModel):
    round_num: int = Field(1, ge=1, le=13, description="Số thứ tự vòng đấu Swiss (1-13)")
    num_chunks: int = Field(4, ge=1, le=20, description="Số lượng chunk phân bổ cho máy chấm")
    player_count: int = Field(2000, ge=2, le=5000, description="Số lượng thí sinh")


class SwissPublishRequest(BaseModel):
    round_num: int = Field(1, ge=1, le=13, description="Vòng đấu vừa hoàn thành cần xuất bản")


class Top32ConfigRequest(BaseModel):
    obstacles: List[str] = Field(default_factory=lambda: ["d4", "d6", "f4", "f6", "e5"])
    rules_announcement: Optional[str] = Field(None, description="Thông báo đổi luật cho thí sinh")


# ── Helper Functions ────────────────────────────


def ensure_submission_package(sub: Submission, user: Optional[User]) -> str:
    """
    Hàm tương thích ngược: Trả về đường dẫn zip_path nếu tồn tại thực tế trên đĩa.
    Hoàn toàn không ghi file zip mẫu ra đĩa để tránh để lại dữ liệu rác trong backend.
    """
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    if sub and sub.zip_path:
        abs_zip = sub.zip_path if os.path.isabs(sub.zip_path) else os.path.join(base_dir, sub.zip_path)
        if os.path.exists(abs_zip):
            return abs_zip
    return ""


def get_submission_files_content(sub: Optional[Submission], user: Optional[User]) -> dict:
    """
    Đọc và hiển thị nội dung các file mã nguồn của thí sinh:
    1. Ưu tiên đọc từ GitHub repository cloned tại storage/submissions/repos/<student_id>/
    2. Nếu có file zip tồn tại thực tế trên đĩa, đọc từ zip
    3. Trả về nội dung xem trước chuẩn GitHub template (hoàn toàn không ghi file rác lên đĩa backend).
    """
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

    # 1. Đọc từ GitHub repository đã clone về
    if user and user.student_id:
        repo_dir = os.path.join(base_dir, "storage", "submissions", "repos", user.student_id)
        if os.path.exists(repo_dir) and os.path.isdir(repo_dir):
            files_content = {
                "bot_py": "",
                "git_log": "",
                "report_md": "",
                "prompts_md": "",
                "chat_history": [],
            }
            bot_path = os.path.join(repo_dir, "bot.py")
            if os.path.exists(bot_path):
                try:
                    with open(bot_path, "r", encoding="utf-8", errors="ignore") as f:
                        files_content["bot_py"] = f.read()
                except Exception:
                    pass

            for r_name in ["REPORT.md", "report.md", "Report.md"]:
                r_path = os.path.join(repo_dir, r_name)
                if os.path.exists(r_path):
                    try:
                        with open(r_path, "r", encoding="utf-8", errors="ignore") as f:
                            files_content["report_md"] = f.read()
                        break
                    except Exception:
                        pass

            for p_name in ["PROMPTS.md", "prompts.md"]:
                p_path = os.path.join(repo_dir, p_name)
                if os.path.exists(p_path):
                    try:
                        with open(p_path, "r", encoding="utf-8", errors="ignore") as f:
                            files_content["prompts_md"] = f.read()
                        break
                    except Exception:
                        pass

            git_log_file = os.path.join(repo_dir, "git_log.txt")
            if os.path.exists(git_log_file):
                try:
                    with open(git_log_file, "r", encoding="utf-8", errors="ignore") as f:
                        files_content["git_log"] = f.read()
                except Exception:
                    pass
            elif os.path.exists(os.path.join(repo_dir, ".git")):
                try:
                    res = subprocess.run(
                        ["git", "log", "-n", "10", "--format=commit %H%nAuthor: %an <%ae>%nDate:   %ad%n%n    %s%n"],
                        cwd=repo_dir,
                        capture_output=True,
                        text=True,
                        timeout=3,
                    )
                    if res.returncode == 0:
                        files_content["git_log"] = res.stdout
                except Exception:
                    pass

            if files_content["bot_py"] or files_content["report_md"]:
                return files_content

    # 2. Đọc từ file zip nếu có trên đĩa
    if sub and sub.zip_path:
        abs_zip = sub.zip_path if os.path.isabs(sub.zip_path) else os.path.join(base_dir, sub.zip_path)
        if os.path.exists(abs_zip):
            return extract_files_from_package(abs_zip)

    # 3. Thí sinh chưa có bài nộp hoặc chưa clone repo: trả về thông báo rõ ràng (không sinh mã nguồn giả)
    return {
        "bot_py": "# Chưa có mã nguồn bot.py (thí sinh chưa nộp bài hoặc chưa tải repo)",
        "report_md": "# Chưa có báo cáo REPORT.md\nThí sinh chưa nộp bài hoặc chưa tải repository về máy chấm.",
        "git_log": "Chưa có lịch sử commit (chưa clone repository)",
        "prompts_md": "",
        "chat_history": [],
    }


def extract_files_from_package(abs_zip: str) -> dict:
    """Đọc và giải mã an toàn các file cốt lõi trong gói nộp."""
    from fastapi import HTTPException
    files_content = {
        "bot_py": "",
        "git_log": "",
        "report_md": "",
        "prompts_md": "",
        "chat_history": [],
    }

    if not abs_zip or not os.path.exists(abs_zip):
        return files_content

    try:
        with zipfile.ZipFile(abs_zip, "r") as z:
            for item in z.infolist():
                if item.is_dir():
                    continue
                name_lower = os.path.basename(item.filename).lower()

                if name_lower == "bot.py":
                    files_content["bot_py"] = z.read(item).decode("utf-8", errors="ignore")
                elif name_lower in ["git_log.txt", "git_log", "git.log"]:
                    files_content["git_log"] = z.read(item).decode("utf-8", errors="ignore")
                elif name_lower == "report.md":
                    files_content["report_md"] = z.read(item).decode("utf-8", errors="ignore")
                elif name_lower == "prompts.md":
                    files_content["prompts_md"] = z.read(item).decode("utf-8", errors="ignore")
                elif "chat_history" in item.filename.lower():
                    content = z.read(item).decode("utf-8", errors="ignore")
                    files_content["chat_history"].append({
                        "filename": os.path.basename(item.filename),
                        "content": content[:8000],
                    })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi đọc file nén: {str(e)}")

    return files_content


def get_bot_for_user(user: Optional[User], db: Session) -> Tuple[Optional[Callable], str]:
    """
    Tải hàm choose_move từ bài nộp active của thí sinh:
    1. Ưu tiên tải từ Git repository cloned trong storage/submissions/repos/<student_id>/bot.py
    2. Nếu có zip_path trên đĩa (tương thích ngược), tải từ file bot.py giải nén
    3. NGUYÊN TẮC: Hệ thống KHÔNG tự điền bot hộ thí sinh!
       Nếu thí sinh chưa có bot hoặc bot lỗi -> trả về None để xử thua T1.
    """
    if not user:
        return None, "Thí sinh không xác định"

    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

    # 1. Ưu tiên nạp từ repo GitHub đã clone tại storage/submissions/repos/<student_id>
    if user.student_id:
        repo_dir = os.path.join(base_dir, "storage", "submissions", "repos", user.student_id)
        bot_file = os.path.join(repo_dir, "bot.py")
        if os.path.exists(bot_file):
            try:
                bot_fn = load_bot_from_file(bot_file)
                return bot_fn, user.name
            except Exception:
                pass

    # 2. Kiểm tra nếu có zip_path trên đĩa (tương thích ngược)
    sub = (
        db.query(Submission)
        .filter(Submission.user_id == user.id, Submission.is_active == True)
        .first()
    )
    if sub and sub.zip_path:
        abs_zip = sub.zip_path if os.path.isabs(sub.zip_path) else os.path.join(base_dir, sub.zip_path)
        extracted_path = os.path.join(os.path.dirname(abs_zip), "extracted")
        if os.path.exists(extracted_path):
            bot_file = os.path.join(extracted_path, "bot.py")
            if not os.path.exists(bot_file):
                for root, _, files in os.walk(extracted_path):
                    if "bot.py" in files:
                        bot_file = os.path.join(root, "bot.py")
                        break
            if os.path.exists(bot_file):
                try:
                    bot_fn = load_bot_from_file(bot_file)
                    return bot_fn, user.name
                except Exception:
                    pass

    # Thí sinh không có bot hợp lệ -> KHÔNG tự điền bot hộ!
    return None, f"{user.name} (Chưa nộp bot hoặc code lỗi)"

