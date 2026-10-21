"""
Submission Validator & Security Scanner
=======================================
Kiểm tra tính hợp lệ của gói nộp bài (.zip):
  1. Kiểm tra cấu trúc file (Bảng 4 spec):
     - bot.py: có hàm choose_move(state)
     - PROMPTS.md: tồn tại và không rỗng (T08)
     - chat_history/: thư mục có ít nhất 1 file
     - REPORT.md: tồn tại và không rỗng
     - git log: bắt buộc với Bảng C
  2. Quét bảo mật tự động (T09):
     - Phát hiện API key chưa che trong code hoặc chat_history
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

    def to_dict(self) -> dict:
        return {
            "is_valid": self.is_valid,
            "details": self.details,
            "errors": self.errors,
            "warnings": self.warnings,
            "detected_api_keys": self.detected_api_keys,
            "extracted_path": self.extracted_path,
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
        "prompts_md": False,
        "chat_history": False,
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
            # Ngăn Zip Slip attack (đường dẫn chứa ../)
            for member in zf.infolist():
                norm = os.path.normpath(member.filename)
                if norm.startswith("..") or os.path.isabs(norm):
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

    # 3. Kiểm tra bot.py
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
        errors.append("Thiếu file bắt buộc 'bot.py'.")

    # 4. Kiểm tra PROMPTS.md (T08)
    prompts_file = None
    for k, path in files_map.items():
        if os.path.basename(k) in ("prompts.md", "prompt.md"):
            prompts_file = path
            break

    if prompts_file and os.path.isfile(prompts_file):
        size = os.path.getsize(prompts_file)
        if size > 10:
            details["prompts_md"] = True
        else:
            errors.append("File 'PROMPTS.md' bị rỗng hoặc quá ngắn (< 10 bytes).")
    else:
        errors.append("Thiếu file bắt buộc 'PROMPTS.md' (T08: Không nhận gói nộp thiếu danh sách prompt).")

    # 5. Kiểm tra REPORT.md
    report_file = None
    for k, path in files_map.items():
        if os.path.basename(k) in ("report.md", "baocao.md"):
            report_file = path
            break

    if report_file and os.path.isfile(report_file):
        if os.path.getsize(report_file) > 10:
            details["report_md"] = True
        else:
            errors.append("File 'REPORT.md' bị rỗng hoặc quá ngắn.")
    else:
        errors.append("Thiếu file bắt buộc 'REPORT.md'.")

    # 6. Kiểm tra chat_history/
    chat_dir = None
    for k, path in dirs_map.items():
        if os.path.basename(k) in ("chat_history", "chat_histories", "chats", "chat"):
            chat_dir = path
            break

    if chat_dir and os.path.isdir(chat_dir):
        chat_files = [f for f in os.listdir(chat_dir) if os.path.isfile(os.path.join(chat_dir, f))]
        if len(chat_files) >= 1:
            details["chat_history"] = True
        else:
            errors.append("Thư mục 'chat_history/' rỗng, chưa chứa file xuất lịch sử chat.")
    else:
        errors.append("Thiếu thư mục bắt buộc 'chat_history/'.")

    # 7. Kiểm tra git_log (Chuẩn Liêm Chính Học Thuật Giải Đấu Swiss)
    git_found = False
    for k, path in files_map.items():
        if os.path.basename(k) in ("git_log.txt", "git.log", "git_log.md"):
            git_found = True
            break
    for k, path in dirs_map.items():
        if os.path.basename(k) == ".git":
            git_found = True
            break

    details["git_log"] = git_found
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
    )
