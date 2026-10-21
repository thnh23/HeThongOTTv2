"""
Pipeline Service — Hệ Thống Tiếp Nhận & Thẩm Định Hàng Loạt Từ Google Form (OTTv2)
================================================================================
Khoa Công nghệ Thông tin — Trường Đại học Công nghệ (VNU-UET)

Quy trình tự động:
  1. Đọc và chuẩn hóa file CSV xuất từ Google Form.
  2. Khử trùng lặp (Deduplication) theo MSSV, chỉ giữ bản ghi nộp mới nhất có Timestamp <= Deadline.
  3. Tải song song (ThreadPool) 2.000 repo GitHub với cờ tối ưu (--filter=blob:none).
  4. Khóa mã nguồn (Freeze Commit): tự động checkout commit mới nhất TRƯỚC mốc giờ deadline.
  5. Thẩm định tự động 3 tiêu chí cốt lõi (bot.py + choose_move, REPORT.md, git_log >= 4).
  6. Quét bảo mật API Key (T09) và kiểm thử Sandbox (1.0s/move, chặn mạng ngoài).
  7. Đồng bộ thông tin vào CSDL (User & Submission) và cung cấp tiến trình thời gian thực.
"""

import os
import re
import csv
import io
import sys
import uuid
import time
import shutil
import threading
import subprocess
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any, Optional, Tuple, TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

from app.services.validator import scan_file_for_api_keys, check_choose_move_in_code, ValidationResult
from app.services.sandbox import execute_bot_move
from app.services.engine.board import create_initial_board

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", ".."))
DEFAULT_REPOS_STORAGE = os.path.join(BACKEND_DIR, "storage", "submissions", "repos")


# ─────────────────────────────────────────────────────────────────────────────
# 1. Trình Quản Lý Tiến Trình Pipeline Toàn Cục (Thread-Safe Progress Tracker)
# ─────────────────────────────────────────────────────────────────────────────

class PipelineProgressManager:
    """Quản lý trạng thái tiến trình chạy bất đồng bộ cho Admin Dashboard."""

    def __init__(self):
        self._lock = threading.Lock()
        self.reset()

    def reset(self):
        with self._lock:
            self.task_id: Optional[str] = None
            self.status: str = "idle"  # idle | running | completed | failed | cancelled
            self.total: int = 0
            self.processed: int = 0
            self.valid_count: int = 0
            self.invalid_count: int = 0
            self.current_student: str = ""
            self.errors: List[Dict[str, str]] = []
            self.started_at: Optional[str] = None
            self.finished_at: Optional[str] = None
            self.deadline_str: Optional[str] = None
            self.message: str = "Hệ thống sẵn sàng tiếp nhận dữ liệu."

    def start(self, task_id: str, total: int, deadline_str: Optional[str] = None):
        with self._lock:
            self.task_id = task_id
            self.status = "running"
            self.total = total
            self.processed = 0
            self.valid_count = 0
            self.invalid_count = 0
            self.errors = []
            self.started_at = datetime.utcnow().isoformat()
            self.finished_at = None
            self.deadline_str = deadline_str
            self.message = f"Đang bắt đầu xử lý {total} bài nộp..."

    def update_item(self, s_id: str, is_valid: bool, error: Optional[str] = None):
        with self._lock:
            self.processed += 1
            self.current_student = s_id
            if is_valid:
                self.valid_count += 1
            else:
                self.invalid_count += 1
                if error:
                    self.errors.append({"student_id": s_id, "error": error})
            self.message = f"Đang thẩm định: {self.processed}/{self.total} ({int(self.processed / max(1, self.total) * 100)}%)"

    def complete(self, message: Optional[str] = None):
        with self._lock:
            self.status = "completed"
            self.finished_at = datetime.utcnow().isoformat()
            self.message = message or f"Hoàn thành: {self.valid_count} hợp lệ, {self.invalid_count} lỗi trên tổng số {self.total} bài nộp."

    def fail(self, error_message: str):
        with self._lock:
            self.status = "failed"
            self.finished_at = datetime.utcnow().isoformat()
            self.message = f"Lỗi xử lý: {error_message}"

    def get_status(self) -> Dict[str, Any]:
        with self._lock:
            pct = int(self.processed / max(1, self.total) * 100) if self.total > 0 else 0
            return {
                "task_id": self.task_id,
                "status": self.status,
                "total": self.total,
                "processed": self.processed,
                "valid_count": self.valid_count,
                "invalid_count": self.invalid_count,
                "percentage": pct,
                "current_student": self.current_student,
                "errors": self.errors[-50:],  # 50 lỗi gần nhất
                "started_at": self.started_at,
                "finished_at": self.finished_at,
                "deadline": self.deadline_str,
                "message": self.message,
            }


global_pipeline_progress = PipelineProgressManager()


# ─────────────────────────────────────────────────────────────────────────────
# 2. Xử Lý Ngày Tháng & Chuẩn Hóa Timestamp
# ─────────────────────────────────────────────────────────────────────────────

def parse_flexible_datetime(dt_str: str) -> Optional[datetime]:
    """Phân tích chuỗi ngày giờ từ Google Form hoặc input người dùng."""
    if not dt_str or not str(dt_str).strip():
        return None

    cleaned = str(dt_str).strip()
    formats = [
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M",
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%Y %H:%M",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d %H:%M",
        "%Y-%m-%d",
        "%d/%m/%Y",
    ]

    for fmt in formats:
        try:
            return datetime.strptime(cleaned, fmt)
        except ValueError:
            continue

    # Thử ISO fromisoformat nếu có
    try:
        return datetime.fromisoformat(cleaned.replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        pass

    return None


def clean_student_id(val: str) -> str:
    """Chuẩn hóa mã sinh viên (loại bỏ dấu cách, ký tự đặc biệt thừa)."""
    if not val:
        return ""
    # Giữ lại chữ và số, bỏ khoảng trắng
    cleaned = re.sub(r"[^a-zA-Z0-9]", "", str(val).strip())
    return cleaned.upper() if cleaned.isalpha() else cleaned


def clean_github_url(url: str) -> str:
    """Chuẩn hóa link GitHub repo (bỏ /tree/main, .git thừa hoặc thêm .git chuẩn)."""
    if not url:
        return ""
    u = str(url).strip()
    # Loại bỏ query params hoặc hash
    u = u.split("?")[0].split("#")[0]
    # Bỏ phần nhánh thừa nếu sinh viên copy từ URL thanh địa chỉ (vd: /tree/main)
    u = re.sub(r"/tree/.*$", "", u)
    u = re.sub(r"/blob/.*$", "", u)
    u = u.rstrip("/")
    if u.endswith(".git"):
        return u
    return u + ".git" if "github.com" in u else u


# ─────────────────────────────────────────────────────────────────────────────
# 3. Phân Tích & Khử Trùng Lặp CSV Google Form (Deduplication)
# ─────────────────────────────────────────────────────────────────────────────

def parse_google_form_csv_with_dedup(
    raw_csv: str,
    deadline_str: Optional[str] = None
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Phân tích file CSV Google Form và khử trùng lặp theo quy tắc:
      1. Nhận diện các cột: Dấu thời gian, Họ tên, MSSV, Email, Link GitHub Repo, Tên Bot.
      2. Nếu sinh viên nộp nhiều lần: chỉ giữ bản ghi nộp cuối cùng có Timestamp <= Deadline.
      3. Bỏ qua các bản ghi nộp muộn hoàn toàn sau Deadline nếu có deadline.
    """
    deadline_dt = parse_flexible_datetime(deadline_str) if deadline_str else None

    reader = list(csv.reader(io.StringIO(raw_csv.strip())))
    if not reader or len(reader) < 2:
        return [], {"total_rows": 0, "accepted": 0, "duplicates_removed": 0, "late_excluded": 0}

    headers = reader[0]

    def match_idx(keywords: List[str]) -> int:
        for idx, h in enumerate(headers):
            cl = h.lower().strip()
            if any(k in cl for k in keywords):
                return idx
        return -1

    time_idx = match_idx(["dấu thời gian", "timestamp", "thời gian", "date", "thời điểm"])
    id_idx = match_idx(["mã sinh viên", "mssv", "student id", "student_id", "msv"])
    name_idx = match_idx(["họ và tên", "họ tên", "tên", "full name", "name"])
    email_idx = match_idx(["email", "địa chỉ", "mail"])
    repo_idx = match_idx(["github", "repo", "link", "repository", "url"])
    class_idx = match_idx(["lớp", "class"])
    bot_idx = match_idx(["tên bot", "bot name", "bot"])

    # Lưu trữ các bản ghi theo student_id: s_id -> list of rows
    student_records: Dict[str, List[Dict[str, Any]]] = {}
    late_excluded_count = 0

    for row_idx, row in enumerate(reader[1:], start=2):
        if not row or all(not str(cell).strip() for cell in row):
            continue

        def get_c(i: int) -> str:
            return row[i].strip() if 0 <= i < len(row) else ""

        raw_time = get_c(time_idx)
        raw_id = get_c(id_idx)
        raw_name = get_c(name_idx)
        raw_email = get_c(email_idx)
        raw_repo = get_c(repo_idx)
        raw_class = get_c(class_idx) or "QH-2022-I/CQ"
        raw_bot = get_c(bot_idx)

        s_id = clean_student_id(raw_id)
        if not s_id and not raw_email and not raw_repo:
            continue

        if not s_id:
            # Fallback lấy từ email
            s_id = raw_email.split("@")[0] if raw_email else f"USER_{row_idx}"

        submit_dt = parse_flexible_datetime(raw_time)

        # Kiểm tra deadline: Nếu dòng này nộp sau deadline -> ghi nhận
        is_late = False
        if deadline_dt and submit_dt and submit_dt > deadline_dt:
            is_late = True

        record = {
            "row_index": row_idx,
            "timestamp_str": raw_time,
            "submitted_at": submit_dt,
            "is_late": is_late,
            "student_id": s_id,
            "name": raw_name or f"Sinh Viên {s_id}",
            "email": raw_email or f"{s_id}@vnu.edu.vn",
            "github_repo_url": clean_github_url(raw_repo),
            "class_name": raw_class,
            "bot_name": raw_bot or f"Bot_{s_id}",
        }

        if s_id not in student_records:
            student_records[s_id] = []
        student_records[s_id].append(record)

    accepted_list: List[Dict[str, Any]] = []
    duplicates_removed_count = 0

    for s_id, records in student_records.items():
        if len(records) > 1:
            duplicates_removed_count += (len(records) - 1)

        # Lọc các bản nộp trước hạn chót
        valid_timing_records = [r for r in records if not r["is_late"]]
        if valid_timing_records:
            # Lấy bản nộp cuối cùng trước hạn chót
            chosen = valid_timing_records[-1]
            accepted_list.append(chosen)
        else:
            # Tất cả các lần nộp đều muộn hơn deadline
            late_excluded_count += len(records)
            # Vẫn giữ lại bản nộp cuối cùng nhưng đánh dấu cờ error_late
            latest = records[-1]
            latest["late_rejected"] = True
            accepted_list.append(latest)

    stats = {
        "total_rows": len(reader) - 1,
        "unique_students": len(student_records),
        "accepted": len(accepted_list),
        "duplicates_removed": duplicates_removed_count,
        "late_excluded": late_excluded_count,
        "deadline": deadline_str,
    }

    return accepted_list, stats


# ─────────────────────────────────────────────────────────────────────────────
# 4. Git Cloner Song Song & Khóa Thời Gian (Time Freeze)
# ─────────────────────────────────────────────────────────────────────────────

def clone_and_freeze_single_repo(
    student: Dict[str, Any],
    dest_dir: str,
    deadline_dt: Optional[datetime] = None,
    timeout_sec: int = 25
) -> Dict[str, Any]:
    """
    Thực hiện:
      1. git clone với môi trường an toàn (GIT_TERMINAL_PROMPT=0).
      2. Kiểm tra commit tree.
      3. Tự động git checkout commit mới nhất TRƯỚC deadline (nếu có deadline).
      4. Đếm số lượng commit và lấy thông tin commit chốt.
    """
    s_id = student["student_id"]
    repo_url = student["github_repo_url"]
    target_path = os.path.join(dest_dir, s_id)

    res_data = {
        "student_id": s_id,
        "repo_url": repo_url,
        "target_path": target_path,
        "clone_success": False,
        "freeze_success": False,
        "commit_hash": None,
        "commit_date": None,
        "commit_count": 0,
        "error_code": None,
        "error_message": None,
    }

    if not repo_url or "github.com" not in repo_url:
        res_data["error_code"] = "INVALID_URL"
        res_data["error_message"] = "URL GitHub không hợp lệ hoặc để trống"
        return res_data

    # Thiết lập biến môi trường ngăn git chờ nhập mật khẩu
    safe_env = os.environ.copy()
    safe_env["GIT_TERMINAL_PROMPT"] = "0"

    # Nếu thư mục đã tồn tại -> xóa sạch để clone mới chính xác
    if os.path.exists(target_path):
        try:
            shutil.rmtree(target_path, ignore_errors=True)
        except Exception:
            pass

    # Thực hiện git clone
    # Dùng --filter=blob:none để tăng tốc (blobless clone)
    cmd_clone = ["git", "clone", "--filter=blob:none", repo_url, target_path]
    try:
        proc = subprocess.run(
            cmd_clone,
            capture_output=True,
            text=True,
            timeout=timeout_sec,
            env=safe_env
        )
        if proc.returncode != 0:
            # Fallback nếu git server không hỗ trợ partial clone: thử clone thường
            proc = subprocess.run(
                ["git", "clone", repo_url, target_path],
                capture_output=True,
                text=True,
                timeout=timeout_sec,
                env=safe_env
            )
    except subprocess.TimeoutExpired:
        res_data["error_code"] = "CLONE_TIMEOUT"
        res_data["error_message"] = f"Quá thời gian kết nối (Timeout {timeout_sec}s)"
        return res_data
    except Exception as e:
        res_data["error_code"] = "CLONE_EXCEPTION"
        res_data["error_message"] = str(e)
        return res_data

    if proc.returncode != 0:
        err_out = proc.stderr.strip()
        if "Authentication failed" in err_out or "Repository not found" in err_out or "could not read Username" in err_out:
            res_data["error_code"] = "REPO_PRIVATE_OR_404"
            res_data["error_message"] = "Repository đang ở chế độ Private hoặc không tồn tại (404). Vui lòng chuyển repo sang Public."
        else:
            res_data["error_code"] = "CLONE_FAILED"
            res_data["error_message"] = err_out[:180]
        return res_data

    res_data["clone_success"] = True

    # Khóa thời gian (Time Freeze): Lùi commit trước deadline nếu có
    if deadline_dt:
        deadline_iso = deadline_dt.strftime("%Y-%m-%d %H:%M:%S")
        cmd_rev = ["git", "rev-list", "-n", "1", f"--before={deadline_iso}", "HEAD"]
        try:
            rev_proc = subprocess.run(cmd_rev, cwd=target_path, capture_output=True, text=True, timeout=10)
            target_commit = rev_proc.stdout.strip()

            if not target_commit:
                # Không có commit nào trước deadline (toàn bộ code push sau hạn chót)
                res_data["error_code"] = "ALL_COMMITS_AFTER_DEADLINE"
                res_data["error_message"] = f"Không tìm thấy commit nào được tạo trước hạn chót ({deadline_iso}). Bài nộp trễ hạn."
                return res_data

            # Checkout về commit hợp lệ trước deadline
            checkout_proc = subprocess.run(
                ["git", "checkout", target_commit, "--force"],
                cwd=target_path,
                capture_output=True,
                text=True,
                timeout=10
            )
            res_data["freeze_success"] = (checkout_proc.returncode == 0)
            res_data["commit_hash"] = target_commit
        except Exception as e:
            res_data["error_code"] = "FREEZE_FAILED"
            res_data["error_message"] = f"Lỗi khi checkout commit trước hạn chót: {str(e)}"
            return res_data
    else:
        # Không có deadline -> lấy commit HEAD hiện tại
        try:
            head_proc = subprocess.run(["git", "rev-parse", "HEAD"], cwd=target_path, capture_output=True, text=True, timeout=5)
            res_data["commit_hash"] = head_proc.stdout.strip()
            res_data["freeze_success"] = True
        except Exception:
            pass

    # Đếm số lượng commit và lấy thời gian commit
    try:
        # Lấy commit date
        date_proc = subprocess.run(
            ["git", "log", "-1", "--format=%cd", "--date=iso"],
            cwd=target_path,
            capture_output=True,
            text=True,
            timeout=5
        )
        res_data["commit_date"] = date_proc.stdout.strip()

        # Đếm tổng commit từ HEAD trở về trước
        count_proc = subprocess.run(
            ["git", "rev-list", "--count", "HEAD"],
            cwd=target_path,
            capture_output=True,
            text=True,
            timeout=5
        )
        if count_proc.returncode == 0 and count_proc.stdout.strip().isdigit():
            res_data["commit_count"] = int(count_proc.stdout.strip())
    except Exception:
        pass

    return res_data


# ─────────────────────────────────────────────────────────────────────────────
# 5. Thẩm Định Kho Lưu Trữ Cục Bộ (Validate Cloned Repository)
# ─────────────────────────────────────────────────────────────────────────────

def validate_cloned_repo(
    repo_path: str,
    student_id: str,
    commit_count: int = 0
) -> ValidationResult:
    """
    Thẩm định toàn diện thư mục repository đã clone theo 4 tiêu chí cốt lõi:
      - bot.py có hàm choose_move(state)
      - REPORT.md tồn tại và không rỗng
      - git_log (đếm từ repo Git >= 4)
      - Quét rò rỉ mã bí mật API Key (T09)
      - Chạy thử Sandbox 1 nước đi để kiểm tra crash/timeout
    """
    errors: List[str] = []
    warnings: List[str] = []
    details: Dict[str, bool] = {
        "bot_py": False,
        "choose_move_fn": False,
        "report_md": False,
        "git_log": False,
    }
    detected_keys: List[Dict[str, str]] = []

    if not os.path.exists(repo_path):
        return ValidationResult(
            is_valid=False,
            details=details,
            errors=[f"Thư mục repository không tồn tại: {repo_path}"],
            commit_count=commit_count
        )

    # 1. Duyệt file trong repository
    files_map = {}
    for root, dirnames, filenames in os.walk(repo_path):
        # Bỏ qua thư mục .git khi tìm file
        if ".git" in dirnames:
            dirnames.remove(".git")
        rel = os.path.relpath(root, repo_path)
        for f in filenames:
            rel_file = os.path.normpath(os.path.join(rel, f)) if rel != "." else f
            files_map[rel_file.lower()] = os.path.join(root, f)

    # 2. Tiêu chí 1: Mã nguồn bot.py & Hàm choose_move
    bot_file = None
    for k, p in files_map.items():
        if k == "bot.py" or k.endswith("/bot.py") or k.endswith("\\bot.py"):
            bot_file = p
            break

    if bot_file and os.path.isfile(bot_file):
        details["bot_py"] = True
        if check_choose_move_in_code(bot_file):
            details["choose_move_fn"] = True
        else:
            errors.append("File bot.py thiếu định nghĩa hàm 'def choose_move(state)'.")
    else:
        errors.append("Thiếu file mã nguồn bắt buộc 'bot.py'.")

    # 3. Tiêu chí 2: Ý tưởng & Báo cáo thuật toán (REPORT.md)
    report_file = None
    for k, p in files_map.items():
        if os.path.basename(k) in ("report.md", "baocao.md"):
            report_file = p
            break

    if report_file and os.path.isfile(report_file):
        if os.path.getsize(report_file) > 10:
            details["report_md"] = True
        else:
            errors.append("File báo cáo ý tưởng 'REPORT.md' bị rỗng hoặc quá ngắn.")
    else:
        errors.append("Thiếu file báo cáo ý tưởng & giải thuật 'REPORT.md'.")

    # 4. Tiêu chí 3: Lịch sử commit Git
    git_dir = os.path.join(repo_path, ".git")
    details["git_log"] = os.path.exists(git_dir) or (commit_count > 0)
    if not details["git_log"]:
        errors.append("Thiếu lịch sử commit Git (không tìm thấy thư mục .git).")
    elif commit_count > 0 and commit_count < 4:
        warnings.append(
            f"Lưu ý: Lịch sử Git chỉ ghi nhận {commit_count} commits. "
            "Khuyến nghị tối thiểu 4 commits để chứng minh tiến trình tự lập trình qua các ngày."
        )

    # 5. Quét bảo mật API Key (T09)
    for k, p in files_map.items():
        if k.endswith((".py", ".md", ".txt", ".json", ".log", ".yaml")):
            f_keys = scan_file_for_api_keys(p)
            if f_keys:
                detected_keys.extend(f_keys)

    if detected_keys:
        warnings.append(
            f"CẢNH BÁO BẢO MẬT (T09): Phát hiện {len(detected_keys)} vị trí có thể chứa API key cá nhân! "
            "Vui lòng thu hồi khóa API trước khi công khai."
        )

    # 6. Chạy thử Sandbox (Kiểm tra xem bot có crash ngay nước đầu tiên không)
    if bot_file and details["choose_move_fn"]:
        try:
            # Tạo bot function từ file bot.py
            import importlib.util
            spec = importlib.util.spec_from_file_location(f"bot_module_{student_id}", bot_file)
            if spec and spec.loader:
                mod = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(mod)
                bot_fn = getattr(mod, "choose_move", None)
                if callable(bot_fn):
                    init_board = create_initial_board()
                    sandbox_res = execute_bot_move(bot_fn, init_board, timeout_sec=1.0, block_network=True)
                    if not sandbox_res.is_success:
                        errors.append(f"Bot crash hoặc lỗi trong Sandbox: {sandbox_res.error_code} - {sandbox_res.error_message}")
        except Exception as e:
            errors.append(f"Không thể nạp hoặc thực thi hàm choose_move: {str(e)[:150]}")

    is_valid = len(errors) == 0

    return ValidationResult(
        is_valid=is_valid,
        details=details,
        errors=errors,
        warnings=warnings,
        detected_api_keys=detected_keys,
        extracted_path=repo_path,
        commit_count=commit_count,
    )


# ─────────────────────────────────────────────────────────────────────────────
# 6. Điều Phối Toàn Bộ Pipeline Hàng Loạt (Batch Pipeline Orchestrator)
# ─────────────────────────────────────────────────────────────────────────────

def run_batch_import_pipeline(
    raw_csv: str,
    deadline_str: Optional[str] = None,
    dest_dir: str = DEFAULT_REPOS_STORAGE,
    max_workers: int = 16,
    task_id: Optional[str] = None
):
    """
    Tiến trình chạy nền (Background Task) điều phối toàn bộ chu trình 4 bước:
      1. Khử trùng lặp CSV.
      2. Clone & Freeze commit hàng loạt.
      3. Thẩm định bài nộp.
      4. Cập nhật kết quả vào DB.
    """
    if not task_id:
        task_id = str(uuid.uuid4())

    os.makedirs(dest_dir, exist_ok=True)

    # 1. Khử trùng lặp CSV
    accepted_students, stats = parse_google_form_csv_with_dedup(raw_csv, deadline_str)
    total_students = len(accepted_students)

    global_pipeline_progress.start(task_id, total_students, deadline_str)

    if total_students == 0:
        global_pipeline_progress.complete("Không có thí sinh nào trong file CSV hoặc tất cả bị loại trừ.")
        return

    deadline_dt = parse_flexible_datetime(deadline_str) if deadline_str else None

    # 2. Xử lý song song bằng ThreadPool
    from app.database import SessionLocal
    from app.models.user import User
    from app.models.submission import Submission

    db = SessionLocal()
    try:
        def process_one(st: Dict[str, Any]) -> Tuple[Dict[str, Any], ValidationResult]:
            # Nếu bản ghi bị đánh dấu nộp muộn hoàn toàn
            if st.get("late_rejected"):
                val_res = ValidationResult(
                    is_valid=False,
                    details={"bot_py": False, "choose_move_fn": False, "report_md": False, "git_log": False},
                    errors=[f"Bài thi nộp muộn sau hạn chót ({deadline_str})."],
                    commit_count=0
                )
                clone_res = {
                    "student_id": st["student_id"],
                    "error_code": "SUBMITTED_AFTER_DEADLINE",
                    "commit_count": 0,
                    "commit_hash": None,
                }
                return clone_res, val_res

            # Clone & Freeze
            clone_res = clone_and_freeze_single_repo(st, dest_dir, deadline_dt)
            if not clone_res["clone_success"]:
                val_res = ValidationResult(
                    is_valid=False,
                    details={"bot_py": False, "choose_move_fn": False, "report_md": False, "git_log": False},
                    errors=[clone_res.get("error_message") or "Lỗi khi tải repository."],
                    commit_count=0
                )
                return clone_res, val_res

            # Thẩm định
            val_res = validate_cloned_repo(
                clone_res["target_path"],
                st["student_id"],
                commit_count=clone_res["commit_count"]
            )
            return clone_res, val_res

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_student = {
                executor.submit(process_one, st): st
                for st in accepted_students
            }

            for future in as_completed(future_to_student):
                st = future_to_student[future]
                s_id = st["student_id"]
                try:
                    clone_res, val_res = future.result()

                    # Cập nhật DB
                    existing_user = db.query(User).filter(
                        (User.student_id == s_id) | (User.email == st["email"])
                    ).first()

                    if existing_user:
                        target_user = existing_user
                        target_user.name = st["name"]
                        target_user.student_id = s_id
                        target_user.github_repo_url = st["github_repo_url"]
                        target_user.bot_name = st["bot_name"]
                        target_user.commit_count = val_res.commit_count
                    else:
                        target_user = User(
                            id=str(uuid.uuid4()),
                            name=st["name"],
                            email=st["email"],
                            hashed_password="student_auto_hash",
                            student_id=s_id,
                            class_name=st["class_name"],
                            github_repo_url=st["github_repo_url"],
                            bot_name=st["bot_name"],
                            commit_count=val_res.commit_count,
                            is_active=True,
                        )
                        db.add(target_user)
                        db.flush()

                    # Cập nhật Submission
                    sub = db.query(Submission).filter(Submission.user_id == target_user.id).first()
                    if not sub:
                        sub = Submission(
                            id=str(uuid.uuid4()),
                            user_id=target_user.id,
                            github_repo_url=st["github_repo_url"],
                            bot_version="v1",
                            is_active=True,
                        )
                        db.add(sub)

                    sub.status = "valid" if val_res.is_valid else "invalid"
                    sub.commit_count = val_res.commit_count
                    sub.validation = val_res.to_dict()
                    sub.github_repo_url = st["github_repo_url"]
                    if clone_res.get("commit_hash"):
                        sub.test_run_result = {
                            "checked_out_commit": clone_res["commit_hash"],
                            "commit_date": clone_res.get("commit_date"),
                        }

                    db.commit()

                    # Cập nhật tiến độ
                    err_msg = val_res.errors[0] if val_res.errors else None
                    global_pipeline_progress.update_item(s_id, val_res.is_valid, err_msg)

                except Exception as ex:
                    db.rollback()
                    global_pipeline_progress.update_item(s_id, False, f"Lỗi DB: {str(ex)[:100]}")

        global_pipeline_progress.complete(
            f"Hoàn thành toàn bộ: {global_pipeline_progress.valid_count} bài hợp lệ, "
            f"{global_pipeline_progress.invalid_count} bài lỗi / tổng số {total_students} bài nộp."
        )

    except Exception as e:
        global_pipeline_progress.fail(str(e))
    finally:
        db.close()
