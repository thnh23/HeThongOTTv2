#!/usr/bin/env python3
"""
1_clone_from_sheets.py — Tải hàng loạt Repository từ Google Form
================================================================
Khoa Công nghệ Thông tin — Trường Đại học Công nghệ (VNU-UET)

Chức năng:
  1. Đọc file CSV xuất từ Google Form (hoặc API).
  2. Tự động nhận diện cột Mã SV, Họ Tên, Email, Link GitHub Repo.
  3. Dùng ThreadPoolExecutor tải song song (10-20 luồng) 2.000 repo về máy:
     storage/submissions/repos/<student_id>/
  4. Báo cáo tỷ lệ thành công, các repo bị private hoặc 404.
"""

import os
import sys
import csv
import io
import argparse
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", ".."))
DEFAULT_REPOS_DIR = os.path.join(BACKEND_DIR, "storage", "submissions", "repos")


def parse_csv_submissions(csv_path: str) -> List[Dict[str, str]]:
    """Đọc và chuẩn hóa dữ liệu từ file CSV Google Form."""
    if not os.path.exists(csv_path):
        print(f"[-] Lỗi: Không tìm thấy file CSV tại '{csv_path}'")
        return []

    with open(csv_path, "r", encoding="utf-8-sig", errors="ignore") as f:
        reader = list(csv.reader(f))

    if not reader or len(reader) < 2:
        print("[-] File CSV rỗng hoặc chỉ có dòng tiêu đề!")
        return []

    headers = reader[0]

    def match_idx(keywords):
        for idx, h in enumerate(headers):
            cl = h.lower().strip()
            if any(k in cl for k in keywords):
                return idx
        return -1

    id_idx = match_idx(["mã sinh viên", "mssv", "student id", "student_id", "msv"])
    name_idx = match_idx(["họ và tên", "họ tên", "tên", "full name", "name"])
    email_idx = match_idx(["email", "địa chỉ", "mail"])
    repo_idx = match_idx(["github", "repo", "link", "repository", "url"])

    students = []
    for row in reader[1:]:
        if not row:
            continue
        def get_v(idx):
            return row[idx].strip() if 0 <= idx < len(row) else ""

        s_id = get_v(id_idx)
        s_name = get_v(name_idx)
        s_email = get_v(email_idx)
        s_repo = get_v(repo_idx)

        if not s_id and not s_repo:
            continue

        students.append({
            "student_id": s_id or f"sv_{len(students)+1}",
            "name": s_name or f"Sinh Viên {s_id}",
            "email": s_email or f"{s_id}@vnu.edu.vn",
            "repo_url": s_repo,
        })

    return students


def clone_single_repo(student: Dict[str, str], dest_dir: str, depth: int = 1) -> Dict[str, Any]:
    """Clone hoặc cập nhật 1 repository GitHub của sinh viên."""
    s_id = student["student_id"]
    repo_url = student["repo_url"]
    target_path = os.path.join(dest_dir, s_id)

    if not repo_url or "github.com" not in repo_url:
        return {"student_id": s_id, "status": "invalid_url", "error": "URL GitHub không hợp lệ"}

    # Chuẩn hóa link repo (bỏ .git nếu có, hoặc thêm nếu cần)
    clean_url = repo_url.strip()
    if not clean_url.endswith(".git"):
        clean_url += ".git"

    if os.path.exists(target_path):
        # Đã tồn tại -> git pull
        try:
            res = subprocess.run(
                ["git", "pull", "--ff-only"],
                cwd=target_path,
                capture_output=True,
                text=True,
                timeout=30,
            )
            if res.returncode == 0:
                return {"student_id": s_id, "status": "updated", "path": target_path}
            else:
                return {"student_id": s_id, "status": "pull_failed", "error": res.stderr.strip()[:100]}
        except Exception as e:
            return {"student_id": s_id, "status": "error", "error": str(e)}

    # Chưa tồn tại -> git clone
    try:
        cmd = ["git", "clone", "--depth", str(depth), clean_url, target_path]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=45)
        if res.returncode == 0:
            return {"student_id": s_id, "status": "cloned", "path": target_path}
        else:
            err_msg = res.stderr.strip()
            if "Authentication failed" in err_msg or "Repository not found" in err_msg:
                return {"student_id": s_id, "status": "private_or_404", "error": "Repo Private hoặc không tồn tại (404)"}
            return {"student_id": s_id, "status": "clone_failed", "error": err_msg[:100]}
    except subprocess.TimeoutExpired:
        return {"student_id": s_id, "status": "timeout", "error": "Quá thời gian kết nối (Timeout 45s)"}
    except Exception as e:
        return {"student_id": s_id, "status": "error", "error": str(e)}


def main():
    parser = argparse.ArgumentParser(description="Tải hàng loạt Repository từ file CSV Google Form")
    parser.add_argument("--csv", required=True, help="Đường dẫn file CSV Google Form")
    parser.add_argument("--out", default=DEFAULT_REPOS_DIR, help="Thư mục lưu trữ mã nguồn")
    parser.add_argument("--workers", type=int, default=15, help="Số luồng tải song song (mặc định: 15)")
    parser.add_argument("--dry-run", action="store_true", help="Chỉ kiểm tra danh sách mà không clone")

    args = parser.parse_args()

    print("=" * 65)
    print("  UET OTTV2 TOURNAMENT — BATCH REPOSITORY CLONER")
    print("=" * 65)

    students = parse_csv_submissions(args.csv)
    print(f"[*] Đã đọc được {len(students)} bản ghi từ '{args.csv}'.")

    if args.dry_run:
        print("[*] Chế độ DRY-RUN: Hiển thị 5 bản ghi mẫu:")
        for s in students[:5]:
            print(f"    - MSSV: {s['student_id']:<10} | {s['name']:<25} | {s['repo_url']}")
        return

    os.makedirs(args.out, exist_ok=True)
    print(f"[*] Đang tải song song {len(students)} repositories với {args.workers} workers...")

    results = {"cloned": 0, "updated": 0, "failed": 0}
    failed_list = []

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(clone_single_repo, s, args.out): s for s in students}
        completed_count = 0
        total = len(futures)

        for future in as_completed(futures):
            res = future.result()
            completed_count += 1
            st = res.get("status")

            if st in ("cloned", "updated"):
                results[st] += 1
            else:
                results["failed"] += 1
                failed_list.append(res)

            if completed_count % 50 == 0 or completed_count == total:
                print(f"    Tiến độ: {completed_count}/{total} ({int(completed_count/total*100)}%) | Thành công: {results['cloned'] + results['updated']} | Lỗi: {results['failed']}")

    print("\n" + "=" * 65)
    print(f"TỔNG KẾT BATCH CLONE:")
    print(f"  ✓ Clone mới thành công:  {results['cloned']}")
    print(f"  ✓ Cập nhật thành công:   {results['updated']}")
    print(f"  ✗ Thất bại (Lỗi/Private): {results['failed']}")
    if failed_list:
        print(f"  Danh sách 5 lỗi đầu tiên:")
        for f in failed_list[:5]:
            print(f"    - SV {f['student_id']}: {f.get('error', 'Unknown')}")
    print("=" * 65)


if __name__ == "__main__":
    main()
