"""
Generate Google Form Submission Demo Records
=============================================
Tạo file CSV mẫu chuẩn dữ liệu sinh viên nộp bài qua Google Form.
Mặc định: 200 bản ghi (gồm ~190 thí sinh duy nhất + ~10 lần nộp lại cập nhật bot).
Định dạng:
  Dấu thời gian, Họ và tên, Mã sinh viên, Email, Lớp học phần, Link GitHub Repository, Tên Bot
"""

import os
import sys
import random
import argparse
from datetime import datetime, timedelta

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DEFAULT_OUTPUT_CSV = os.path.join(ROOT_DIR, "data", "google_form_submissions_demo.csv")

SURNAMES = [
    "Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng",
    "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý", "Đinh", "Đoàn", "Trịnh", "Mai"
]

MIDDLENAMES = [
    "Văn", "Thị", "Đức", "Hoàng", "Minh", "Quang", "Hải", "Tuấn", "Đình", "Bảo",
    "Quốc", "Gia", "Nhật", "Hữu", "Thành", "Thế", "Xuân", "Trọng", "Bá", "Thanh"
]

FIRSTNAMES = [
    "Nam", "An", "Cường", "Đức", "Huy", "Kiệt", "Long", "Khôi", "Phước", "Quyết",
    "Sơn", "Trọng", "Tuấn", "Nghĩa", "Khoa", "Hoàng", "Tài", "Phong", "Triết", "Hậu",
    "Tú", "Vinh", "Bảo", "Trường", "Danh", "Phúc", "Giáp", "Bích", "Hương", "Linh",
    "Mai", "Nga", "Trang", "Vy", "Châu", "Dũng", "Thắng", "Quân", "Hiếu", "Đạt"
]

BOT_PREFIXES = [
    "Alpha", "Beta", "Mega", "Cyber", "Shadow", "Quantum", "Hyper", "Deep",
    "Storm", "Iron", "Falcon", "Viper", "Phoenix", "Titan", "Nexus", "Zenith",
    "Apex", "Prime", "Neo", "Ghost", "Vortex", "Chrono", "Blaze", "Frost",
    "Mystic", "Omega", "Greedy", "MiniMax", "Dragon", "Tiger"
]

BOT_SUFFIXES = [
    "Bot", "Knight", "Sniper", "Breaker", "Thinker", "Solver", "Hunter",
    "Guard", "Striker", "Master", "Engine", "AI", "Agent", "Core", "Tactician"
]

CLASSES = ["INT3304 1", "INT3304 2", "INT3304 3", "INT3304 4", "INT3304 5"]

TEMPLATE_REPO = "https://github.com/thnh23/ottv2-bot-template"


def generate_records(total_records: int = 200):
    random.seed(42)  # Deterministic generation for consistency

    base_time = datetime(2026, 10, 20, 8, 0, 0)
    end_time = datetime(2026, 10, 24, 12, 0, 0)
    time_span_seconds = int((end_time - base_time).total_seconds())

    # Tính toán số lượng thí sinh gốc (khoảng 95% tổng số bản ghi, 5% còn lại là nộp lại/duplicate)
    if total_records <= 10:
        unique_students_count = total_records
    else:
        unique_students_count = max(1, int(total_records * 0.95))

    students = []
    for i in range(unique_students_count):
        # Mã sinh viên K67 (ví dụ từ 22021001 trở đi)
        s_id = f"2202{str(1001 + i).zfill(4)}"
        surname = random.choice(SURNAMES)
        middle = random.choice(MIDDLENAMES)
        first = random.choice(FIRSTNAMES)
        full_name = f"{surname} {middle} {first}"
        email = f"{s_id}@vnu.edu.vn"
        class_name = random.choice(CLASSES)

        prefix = random.choice(BOT_PREFIXES)
        suffix = random.choice(BOT_SUFFIXES)
        version = random.choice(["v1", "v2", "Pro", "X", "Max", "Prime", "Lite"])
        bot_name = f"{prefix}{suffix}_{version}"

        students.append({
            "student_id": s_id,
            "name": full_name,
            "email": email,
            "class_name": class_name,
            "bot_name": bot_name,
            "github_repo_url": TEMPLATE_REPO,
        })

    # Tạo danh sách các dòng nộp bài
    records = []

    # 1. Thêm bản nộp ban đầu cho từng sinh viên
    for student in students:
        random_seconds = random.randint(0, time_span_seconds - 3600)
        sub_time = base_time + timedelta(seconds=random_seconds)
        records.append({
            "timestamp": sub_time,
            "name": student["name"],
            "student_id": student["student_id"],
            "email": student["email"],
            "class_name": student["class_name"],
            "github_repo_url": student["github_repo_url"],
            "bot_name": student["bot_name"],
        })

    # 2. Thêm các bản nộp cập nhật (re-submission / duplicate) để đạt đúng total_records
    duplicates_needed = total_records - len(records)
    for _ in range(duplicates_needed):
        student = random.choice(students)
        # Nộp lại sau đó từ 1 đến 24 giờ
        random_seconds = random.randint(time_span_seconds // 2, time_span_seconds)
        sub_time = base_time + timedelta(seconds=random_seconds)
        updated_bot_name = f"{student['bot_name']}_Final"
        records.append({
            "timestamp": sub_time,
            "name": student["name"],
            "student_id": student["student_id"],
            "email": student["email"],
            "class_name": student["class_name"],
            "github_repo_url": student["github_repo_url"],
            "bot_name": updated_bot_name,
        })

    # Đưa vào 2 dòng kiểm thử lỗi (repo không tồn tại) để test tính năng cảnh báo của pipeline (nếu đủ số lượng)
    if len(records) > 25:
        records[10]["github_repo_url"] = "https://github.com/non-existent-user-1234/ottv2-broken-repo"
        records[10]["bot_name"] = "CrashBot_Error"
        records[25]["github_repo_url"] = "https://github.com/test-error-account/broken-link"
        records[25]["bot_name"] = "BugHunter_Error"

    # Sắp xếp bản ghi theo thời gian nộp
    records.sort(key=lambda r: r["timestamp"])

    return records


def write_csv(records, output_path):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    try:
        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            # Header chuẩn Google Form
            f.write("Dấu thời gian,Họ và tên,Mã sinh viên,Email,Lớp học phần,Link GitHub Repository,Tên Bot\n")
            for r in records:
                dt: datetime = r["timestamp"]
                period = "SA" if dt.hour < 12 else "CH"
                formatted_time = dt.strftime(f"%Y/%m/%d %I:%M:%S {period} GMT+7")
                line = f'"{formatted_time}","{r["name"]}","{r["student_id"]}","{r["email"]}","{r["class_name"]}","{r["github_repo_url"]}","{r["bot_name"]}"\n'
                f.write(line)

        print(f"[✓] Đã tạo thành công {len(records)} bản ghi CSV vào: {output_path}")
        return True
    except PermissionError:
        print(f"\n[!] LỖI TRUY CẬP (Permission Denied):")
        print(f"    Tệp '{output_path}' hiện đang được mở bởi ứng dụng khác (ví dụ: Microsoft Excel).")
        fallback_path = output_path.replace(".csv", f"_{len(records)}.csv")
        try:
            with open(fallback_path, "w", encoding="utf-8-sig", newline="") as f:
                f.write("Dấu thời gian,Họ và tên,Mã sinh viên,Email,Lớp học phần,Link GitHub Repository,Tên Bot\n")
                for r in records:
                    dt: datetime = r["timestamp"]
                    period = "SA" if dt.hour < 12 else "CH"
                    formatted_time = dt.strftime(f"%Y/%m/%d %I:%M:%S {period} GMT+7")
                    line = f'"{formatted_time}","{r["name"]}","{r["student_id"]}","{r["email"]}","{r["class_name"]}","{r["github_repo_url"]}","{r["bot_name"]}"\n'
                    f.write(line)
            print(f"    [i] Đã tự động lưu thành công {len(records)} bản ghi vào tệp thay thế:")
            print(f"        -> {fallback_path}")
            print(f"    (Để ghi đè vào tệp chính, vui lòng ĐÓNG file trong Excel rồi chạy lại script).")
            return True
        except Exception:
            print(f"    -> Vui lòng ĐÓNG file này trong Excel rồi chạy lại script.")
            return False
    except Exception as e:
        print(f"\n[!] Lỗi khi ghi tệp CSV: {e}")
        return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Tạo file CSV demo nộp bài Google Form")
    parser.add_argument(
        "count",
        nargs="?",
        type=int,
        default=200,
        help="Số lượng bản ghi cần tạo (mặc định: 200)",
    )
    parser.add_argument(
        "-o", "--output",
        type=str,
        default=DEFAULT_OUTPUT_CSV,
        help=f"Đường dẫn tệp CSV xuất ra (mặc định: {DEFAULT_OUTPUT_CSV})",
    )
    args = parser.parse_args()

    recs = generate_records(args.count)
    write_csv(recs, args.output)
