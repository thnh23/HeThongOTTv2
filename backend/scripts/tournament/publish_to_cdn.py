#!/usr/bin/env python3
"""
publish_to_cdn.py — Jamstack Static Publisher & Cloudflare Pages Deployer
========================================================================
Tự động xuất bản dữ liệu tĩnh JSON sang thư mục static frontend và CDN.
Trụ cột 4 trong Báo cáo kiến trúc: 0đ chi phí máy chủ, phục vụ 2.000 SV cùng lúc.
"""

import os
import sys
import shutil
import json
import argparse
import subprocess

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, "..", "..", ".."))
FRONTEND_PUBLIC_DATA = os.path.join(PROJECT_ROOT, "frontend", "public", "data")


def publish_data(
    published_dir: str,
    target_frontend_dir: str = FRONTEND_PUBLIC_DATA,
    deploy_cloudflare: bool = False,
    cloudflare_project: str = "ottv2-tournament",
):
    """Đồng bộ các file JSON sang frontend public/data và CDN."""
    if not os.path.exists(published_dir):
        print(f"[!] Thư mục nguồn không tồn tại: {published_dir}")
        return False

    os.makedirs(target_frontend_dir, exist_ok=True)

    copied_files = []
    for item in os.listdir(published_dir):
        if item.endswith(".json"):
            src = os.path.join(published_dir, item)
            dst = os.path.join(target_frontend_dir, item)
            shutil.copy2(src, dst)
            copied_files.append(item)

    print(f"============================================================")
    print(f"[*] JAMSTACK STATIC PUBLISHER (TRỤ CỘT 4: CHI PHÍ 0Đ)")
    print(f"[*] Đã đồng bộ {len(copied_files)} file JSON sang: {target_frontend_dir}")
    for f in copied_files:
        file_size = os.path.getsize(os.path.join(target_frontend_dir, f))
        print(f"   • {f} ({file_size / 1024:.1f} KB)")
    print(f"============================================================")

    # Nếu được yêu cầu deploy Cloudflare Pages qua Wrangler
    if deploy_cloudflare:
        print(f"[*] Đang xuất bản lên Cloudflare Pages (Project: {cloudflare_project})...")
        try:
            cmd = ["npx", "wrangler", "pages", "deploy", published_dir, f"--project-name={cloudflare_project}"]
            res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
            if res.returncode == 0:
                print(f"[✓] Đã xuất bản Cloudflare Pages thành công!")
            else:
                print(f"[!] Wrangler deploy cảnh báo: {res.stderr}")
        except Exception as e:
            print(f"[!] Không thể chạy wrangler: {e}")

    return True


def main():
    parser = argparse.ArgumentParser(description="Publish Jamstack JSON to Frontend & CDN")
    parser.add_argument(
        "--published-dir",
        type=str,
        default=os.path.join(PROJECT_ROOT, "backend", "published"),
        help="Thư mục chứa file JSON đã xuất bản (standings.json, top32.json)",
    )
    parser.add_argument(
        "--frontend-dir",
        type=str,
        default=FRONTEND_PUBLIC_DATA,
        help="Thư mục public/data của Frontend",
    )
    parser.add_argument(
        "--deploy",
        action="store_true",
        help="Đẩy thẳng lên Cloudflare Pages qua Wrangler",
    )
    parser.add_argument(
        "--project-name",
        type=str,
        default="ottv2-tournament",
        help="Tên Cloudflare Pages Project",
    )
    args = parser.parse_args()

    publish_data(
        published_dir=args.published_dir,
        target_frontend_dir=args.frontend_dir,
        deploy_cloudflare=args.deploy,
        cloudflare_project=args.project_name,
    )


if __name__ == "__main__":
    main()
