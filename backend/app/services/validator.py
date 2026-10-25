"""
Submission Validator & Security Scanner
=======================================
Kiểm tra tính hợp lệ của gói nộp bài (.zip) theo thể lệ mới:
  1. Kiểm tra cấu trúc file:
     - bot.py: có hàm choose_move(state) tuân thủ luật OTTv2
     - REPORT.md: báo cáo ý tưởng chiến thuật & thuật toán tự phát triển
     - git_log.txt hoặc thư mục .git: minh chứng quá trình tự lập trình (>= 4 commits)
     (Loại bỏ hoàn toàn yêu cầu PROMPTS.md và chat_history để khuyến khích sinh viên tự code)
  2. Quét bảo mật tự động (T09):
     - Phát hiện API key chưa che trong code và tài liệu
       (OpenAI sk-..., Google AIzaSy..., Anthropic sk-ant-..., HuggingFace hf_...)
"""

import os
import re
import zipfile
import ast
from typing import Dict, List, Optional
from dataclasses import dataclass, field


# ────────────────────────────────────────────────
# API Key Patterns for Security Scan (T09)
# ────────────────────────────────────────────────
API_KEY_PATTERNS = [
    (r"sk-(?:proj-)?[a-zA-Z0-9_-]{20,}", "OpenAI API Key"),
    (r"AIzaSy[0-9A-Za-z_-]{33}", "Google / Gemini API Key"),
    (r"sk-ant-[a-zA-Z0-9_-]{20,}", "Anthropic API Key"),
    (r"hf_[a-zA-Z0-9]{20,}", "HuggingFace Token"),
    (r"(?:api[_-]?key|secret[_-]?key|access[_-]?token)\s*[:=]\s*['\"][a-zA-Z0-9_-]{16,}['\"]", "Generic API Key / Secret"),
]


@dataclass
class ValidationResult:
    is_valid: bool
    details: Dict[str, bool] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    detected_api_keys: List[Dict[str, str]] = field(default_factory=list)
    extracted_path: Optional[str] = None
    commit_count: int = 0

    def to_dict(self) -> dict:
        return {
            "is_valid": self.is_valid,
            "details": self.details,
            "errors": self.errors,
            "warnings": self.warnings,
            "detected_api_keys": self.detected_api_keys,
            "extracted_path": self.extracted_path,
            "commit_count": self.commit_count,
        }


def scan_file_for_api_keys(file_path: str) -> List[Dict[str, str]]:
    """Quét 1 file text để tìm API key bị lộ."""
    findings = []
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            for line_no, line in enumerate(f, 1):
                for pattern, key_type in API_KEY_PATTERNS:
                    matches = re.finditer(pattern, line)
                    for m in matches:
                        raw_key = m.group(0)
                        # Che bớt phần giữa để hiển thị an toàn
                        if len(raw_key) > 8:
                            masked_key = raw_key[:4] + "..." + raw_key[-4:]
                        else:
                            masked_key = "***"
                        findings.append({
                            "file": os.path.basename(file_path),
                            "line": line_no,
                            "type": key_type,
                            "masked": masked_key,
                        })
    except Exception:
        pass
    return findings


def check_choose_move_in_code(bot_path: str) -> bool:
    """Kiểm tra file bot.py có định nghĩa hàm choose_move(state) hay không."""
    try:
        with open(bot_path, "r", encoding="utf-8", errors="ignore") as f:
            tree = ast.parse(f.read(), filename=bot_path)
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef) and node.name == "choose_move":
                return True
    except Exception:
        pass
    return False


def validate_submission_zip(
    zip_path: str,
    extract_dir: str,
    tier: str = "A",
) -> ValidationResult:
    """
    Giải nén và kiểm tra tính hợp lệ toàn diện của gói nộp bài.
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

    if not os.path.exists(zip_path):
        return ValidationResult(
            is_valid=False,
            details=details,
            errors=[f"File zip không tồn tại: {zip_path}"]
        )

    # 1. Giải nén an toàn
    os.makedirs(extract_dir, exist_ok=True)
    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            # Ngăn Zip Slip attack (đường dẫn chứa ../ hoặc thoát khỏi thư mục extract)
            abs_extract = os.path.abspath(extract_dir)
            for member in zf.infolist():
                norm = os.path.normpath(member.filename)
                target_dest = os.path.abspath(os.path.join(extract_dir, member.filename))
                if (
                    norm.startswith("..")
                    or os.path.isabs(norm)
                    or not (target_dest == abs_extract or target_dest.startswith(abs_extract + os.sep))
                ):
                    return ValidationResult(
                        is_valid=False,
                        details=details,
                        errors=["Phát hiện đường dẫn không an toàn trong file zip (Zip Slip)"]
                    )
            zf.extractall(extract_dir)
    except zipfile.BadZipFile:
        return ValidationResult(
            is_valid=False,
            details=details,
            errors=["File nộp không phải định dạng ZIP hợp lệ."]
        )
    except Exception as e:
        return ValidationResult(
            is_valid=False,
            details=details,
            errors=[f"Lỗi khi giải nén file zip: {str(e)}"]
        )

    # 2. Tìm kiếm các file trong thư mục giải nén (có thể nằm ở root hoặc trong 1 subfolder)
    # Xác định root thực sự của bài nộp
    target_root = extract_dir
    entries = [e for e in os.listdir(extract_dir) if not e.startswith("__MACOSX")]
    if len(entries) == 1 and os.path.isdir(os.path.join(extract_dir, entries[0])):
        # Gói nộp được nén cả thư mục cha
        target_root = os.path.join(extract_dir, entries[0])

    # Duyệt file case-insensitive
    files_map = {}
    dirs_map = {}
    for root, dirnames, filenames in os.walk(target_root):
        rel = os.path.relpath(root, target_root)
        for d in dirnames:
            dirs_map[os.path.normpath(os.path.join(rel, d)).lower()] = os.path.join(root, d)
        for f in filenames:
            rel_file = os.path.normpath(os.path.join(rel, f)) if rel != "." else f
            files_map[rel_file.lower()] = os.path.join(root, f)

    # 3. Tiêu chí 1: Mã nguồn bot.py & Hàm choose_move(state)
    bot_file = None
    for k, path in files_map.items():
        if k == "bot.py" or k.endswith("/bot.py") or k.endswith("\\bot.py"):
            bot_file = path
            break

    if bot_file and os.path.isfile(bot_file):
        details["bot_py"] = True
        if check_choose_move_in_code(bot_file):
            details["choose_move_fn"] = True
        else:
            errors.append("File bot.py thiếu định nghĩa hàm 'def choose_move(state)'.")
    else:
        errors.append("Thiếu file mã nguồn bắt buộc 'bot.py'.")

    # 4. Tiêu chí 2: Ý tưởng chiến thuật & Thuật toán (REPORT.md)
    report_file = None
    for k, path in files_map.items():
        if os.path.basename(k) in ("report.md", "baocao.md"):
            report_file = path
            break

    if report_file and os.path.isfile(report_file):
        if os.path.getsize(report_file) > 10:
            details["report_md"] = True
        else:
            errors.append("File báo cáo ý tưởng 'REPORT.md' bị rỗng hoặc quá ngắn.")
    else:
        errors.append("Thiếu file báo cáo ý tưởng & phân tích giải thuật 'REPORT.md'.")

    # 5. Tiêu chí 3: Lịch sử commit Git (Minh chứng quá trình tự lập trình)
    git_found = False
    commit_count = 0
    git_log_file = None
    for k, path in files_map.items():
        if os.path.basename(k) in ("git_log.txt", "git.log", "git_log.md"):
            git_found = True
            git_log_file = path
            break
    if not git_found:
        for k, path in dirs_map.items():
            if os.path.basename(k) == ".git":
                git_found = True
                break

    # Trích xuất và đếm số lượng commit
    if git_log_file and os.path.isfile(git_log_file):
        try:
            with open(git_log_file, "r", encoding="utf-8", errors="ignore") as gf:
                content = gf.read()
                # 1. Định dạng chuẩn: commit [a-f0-9]{7,}
                full_commits = re.findall(r"^commit\s+[a-f0-9]{7,}", content, re.MULTILINE | re.IGNORECASE)
                if full_commits:
                    commit_count = len(full_commits)
                else:
                    # 2. Định dạng git log --oneline
                    oneline_commits = [
                        line for line in content.splitlines()
                        if re.match(r"^[a-f0-9]{6,12}\s+", line.strip(), re.IGNORECASE)
                    ]
                    if oneline_commits:
                        commit_count = len(oneline_commits)
                    else:
                        # 3. Đếm số dòng không rỗng (ước tính)
                        non_empty = [l for l in content.splitlines() if l.strip()]
                        commit_count = min(len(non_empty), 5)
        except Exception:
            pass

    details["git_log"] = git_found
    if not git_found:
        errors.append("Thiếu lịch sử commit Git ('git_log.txt' hoặc thư mục '.git') để xác thực tiến trình tự viết code.")
    elif commit_count > 0 and commit_count < 4:
        warnings.append(
            f"Lưu ý: Lịch sử Git chỉ ghi nhận {commit_count} commit. "
            "Quy định giải đấu khuyến nghị tối thiểu 4–5 commits để minh chứng quá trình tự phát triển mã nguồn."
        )

    if tier and str(tier).upper() == "C" and not git_found:
        errors.append("Bảng C yêu cầu bắt buộc phải có git_log.txt hoặc thư mục .git để xác thực tiến trình code.")

    # 8. Quét bảo mật API Key (T09)
    for k, path in files_map.items():
        if k.endswith((".py", ".md", ".txt", ".json", ".log", ".html")):
            found_keys = scan_file_for_api_keys(path)
            if found_keys:
                detected_keys.extend(found_keys)

    if detected_keys:
        warnings.append(
            f"CẢNH BÁO BẢO MẬT (T09): Phát hiện {len(detected_keys)} vị trí có thể chứa API key cá nhân! "
            "Vui lòng che hoặc thu hồi khóa API trước khi công khai."
        )

    is_valid = len(errors) == 0

    return ValidationResult(
        is_valid=is_valid,
        details=details,
        errors=errors,
        warnings=warnings,
        detected_api_keys=detected_keys,
        extracted_path=target_root,
        commit_count=commit_count,
    )
