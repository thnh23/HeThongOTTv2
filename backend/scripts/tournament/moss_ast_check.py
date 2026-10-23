#!/usr/bin/env python3
"""
moss_ast_check.py — AST-based Source Code Plagiarism Detector
=============================================================
Công cụ phát hiện sao chép / đạo văn mã nguồn bot bằng phân tích Cây Cú Pháp Trừu Tượng (AST):
  1. Duyệt tất cả file bot.py trong thư mục repos/ (hoặc thư mục tuỳ chọn).
  2. Chuẩn hoá AST (AST Normalization):
     - Loại bỏ tên biến, tên hàm con, docstrings, chú thích, hằng số cụ thể.
     - Giữ nguyên cấu trúc luồng điều khiển (Loops, Branches, Expressions, Calls, Operations).
  3. Trích xuất K-gram AST shingles và tính toán độ tương đồng Jaccard & Containment.
  4. Gắn cờ các cặp thí sinh có độ tương đồng >= ngưỡng (mặc định 40%).
  5. Xuất báo cáo Markdown và JSON phục vụ Hội đồng Chấm thi OTTv2.
"""

import os
import sys
import ast
import json
import argparse
from typing import Dict, List, Set, Tuple, Any

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass


class ASTNormalizer(ast.NodeVisitor):
    """
    Duyệt cây cú pháp và trích xuất chuỗi token cấu trúc logic,
    bỏ qua tên định danh và giá trị hằng số để vô hiệu hóa thủ thuật đổi tên biến.
    """
    def __init__(self):
        self.tokens: List[str] = []

    def generic_visit(self, node: ast.AST):
        node_type = type(node).__name__
        # Bỏ qua các node bọc không mang tính logic đặc thù
        if node_type not in ("Load", "Store", "Del"):
            self.tokens.append(node_type)
        super().generic_visit(node)


def extract_ast_tokens(file_path: str) -> List[str]:
    """Đọc file python và phân tích ra chuỗi token AST chuẩn hoá."""
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            code = f.read()
        tree = ast.parse(code, filename=file_path)
        normalizer = ASTNormalizer()
        normalizer.visit(tree)
        return normalizer.tokens
    except Exception as e:
        return []


def generate_kgrams(tokens: List[str], k: int = 5) -> Set[Tuple[str, ...]]:
    """Tạo tập hợp k-grams từ chuỗi tokens."""
    if len(tokens) < k:
        return {tuple(tokens)} if tokens else set()
    return {tuple(tokens[i : i + k]) for i in range(len(tokens) - k + 1)}


def compute_similarity(tokens_a: List[str], tokens_b: List[str], k: int = 5) -> Tuple[float, float]:
    """
    Tính toán chỉ số tương đồng giữa 2 file:
    - Jaccard similarity = |A ∩ B| / |A ∪ B|
    - Containment = |A ∩ B| / min(|A|, |B|)
    """
    if not tokens_a or not tokens_b:
        return 0.0, 0.0

    kgrams_a = generate_kgrams(tokens_a, k=k)
    kgrams_b = generate_kgrams(tokens_b, k=k)

    if not kgrams_a or not kgrams_b:
        return 0.0, 0.0

    intersection = len(kgrams_a.intersection(kgrams_b))
    union = len(kgrams_a.union(kgrams_b))

    jaccard = intersection / union if union > 0 else 0.0
    containment = intersection / min(len(kgrams_a), len(kgrams_b))

    return round(jaccard, 4), round(containment, 4)


def scan_repositories(repos_dir: str) -> Dict[str, Dict[str, Any]]:
    """Quét tất cả các file bot.py của thí sinh trong thư mục repos."""
    bots: Dict[str, Dict[str, Any]] = {}

    if not os.path.exists(repos_dir):
        return bots

    for entry in sorted(os.listdir(repos_dir)):
        entry_path = os.path.join(repos_dir, entry)
        bot_file = None

        if os.path.isdir(entry_path):
            candidate = os.path.join(entry_path, "bot.py")
            if os.path.exists(candidate):
                bot_file = candidate
            else:
                for root, _, files in os.walk(entry_path):
                    if "bot.py" in files:
                        bot_file = os.path.join(root, "bot.py")
                        break
        elif entry.endswith(".py"):
            bot_file = entry_path

        if bot_file and os.path.exists(bot_file):
            student_id = entry
            tokens = extract_ast_tokens(bot_file)
            if tokens:
                bots[student_id] = {
                    "student_id": student_id,
                    "file_path": bot_file,
                    "token_count": len(tokens),
                    "tokens": tokens,
                }

    return bots


def run_plagiarism_check(
    repos_dir: str,
    threshold: float = 0.40,
    k: int = 5,
) -> Dict[str, Any]:
    """Chạy toàn bộ quy trình phát hiện đạo văn AST."""
    bots = scan_repositories(repos_dir)
    student_ids = list(bots.keys())
    total_bots = len(student_ids)

    flagged_pairs: List[Dict[str, Any]] = []
    comparisons = 0

    for i in range(total_bots):
        for j in range(i + 1, total_bots):
            comparisons += 1
            s_a = student_ids[i]
            s_b = student_ids[j]

            jaccard, containment = compute_similarity(bots[s_a]["tokens"], bots[s_b]["tokens"], k=k)
            max_sim = max(jaccard, containment)

            if max_sim >= threshold:
                flagged_pairs.append({
                    "student_a": s_a,
                    "student_b": s_b,
                    "file_a": bots[s_a]["file_path"],
                    "file_b": bots[s_b]["file_path"],
                    "token_count_a": bots[s_a]["token_count"],
                    "token_count_b": bots[s_b]["token_count"],
                    "jaccard_similarity": jaccard,
                    "containment_similarity": containment,
                    "score": max_sim,
                })

    flagged_pairs.sort(key=lambda x: x["score"], reverse=True)

    return {
        "total_bots": total_bots,
        "total_comparisons": comparisons,
        "threshold": threshold,
        "k_gram": k,
        "flagged_count": len(flagged_pairs),
        "flagged_pairs": flagged_pairs,
    }


def generate_markdown_report(report_data: Dict[str, Any], output_path: str):
    """Xuất báo cáo chi tiết ra file Markdown chuẩn UET."""
    lines = [
        "# BÁO CÁO THẨM ĐỊNH TÁC QUYỀN MÃ NGUỒN (MOSS AST CHECK)",
        "### Giải Đấu Cờ Lập Trình Mạng OTTv2 — Trường Đại học Công Nghệ (VNU-UET)",
        "",
        f"- **Tổng số bài nộp được quét:** {report_data['total_bots']} bots",
        f"- **Tổng số cặp đối sánh AST:** {report_data['total_comparisons']:,} cặp",
        f"- **Ngưỡng cảnh báo đạo văn:** {int(report_data['threshold'] * 100)}%",
        f"- **Số cặp bị gắn cờ nghi vấn:** **{report_data['flagged_count']} cặp**",
        "",
        "---",
        "",
        "## 📋 DANH SÁCH CÁC CẶP BÀI NỘP CÓ DẤU HIỆU SAO CHÉP MÃ NGUỒN",
        "",
    ]

    if not report_data["flagged_pairs"]:
        lines.append("> [!NOTE]")
        lines.append(f"> Không phát hiện cặp mã nguồn nào vượt ngưỡng tương đồng {int(report_data['threshold'] * 100)}%. Toàn bộ mã nguồn sinh viên độc lập và hợp lệ!")
    else:
        lines.append("| Hạng | Thí Sinh A (MSSV) | Thí Sinh B (MSSV) | Độ Tương Đồng AST | Mức Độ Bao Hàm | Đánh Giá Tác Quyền |")
        lines.append("| :---: | :---: | :---: | :---: | :---: | :--- |")

        for rank, p in enumerate(report_data["flagged_pairs"], 1):
            jaccard_pct = f"{p['jaccard_similarity'] * 100:.1f}%"
            contain_pct = f"{p['containment_similarity'] * 100:.1f}%"
            score_pct = p["score"] * 100

            if score_pct >= 85:
                verdict = "🚨 **Rất cao (Sao chép gần như nguyên bản)**"
            elif score_pct >= 60:
                verdict = "⚠️ **Cao (Cùng logic tìm kiếm & heuristic)**"
            else:
                verdict = "🔍 **Cần vấn đáp (Tương đồng cấu trúc cơ bản)**"

            lines.append(
                f"| #{rank} | `{p['student_a']}` | `{p['student_b']}` | **{jaccard_pct}** | {contain_pct} | {verdict} |"
            )

        lines.extend([
            "",
            "### 📌 Khuyến nghị xử lý dành cho Hội đồng Chấm thi:",
            "1. **Mức độ >= 80%:** Triệu tập thí sinh vấn đáp 5 phút, yêu cầu giải trình trực tiếp từng hàm trong `bot.py`.",
            "2. **Kiểm tra nhật ký Git (`git_log`):** Đối chiếu thời gian các commit của hai bên để xác định tác giả gốc.",
            "3. **Thang điểm trừ:** Căn cứ Điều 1.5 Quy chế môn học, bài làm sao chép không được bảo vệ hợp lệ sẽ bị hủy kết quả giải đấu.",
        ])

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def main():
    parser = argparse.ArgumentParser(description="AST-based Code Plagiarism Detector for OTTv2 Bots")
    parser.add_argument(
        "--repos-dir",
        type=str,
        default=os.path.join(os.path.dirname(__file__), "..", "..", "storage", "submissions", "repos"),
        help="Thư mục chứa repositories của sinh viên (storage/submissions/repos)",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=0.40,
        help="Ngưỡng tương đồng AST để gắn cờ (mặc định 0.40 = 40%)",
    )
    parser.add_argument(
        "--k-gram",
        type=int,
        default=5,
        help="Kích thước k-gram AST token shingles (mặc định 5)",
    )
    parser.add_argument(
        "--output-md",
        type=str,
        default=None,
        help="Đường dẫn file báo cáo Markdown (mặc định moss_report.md tại repos-dir)",
    )
    parser.add_argument(
        "--output-json",
        type=str,
        default=None,
        help="Đường dẫn file báo cáo JSON",
    )
    args = parser.parse_args()

    repos_dir = os.path.abspath(args.repos_dir)
    print(f"============================================================")
    print(f"[*] CÔNG CỤ PHÁT HIỆN ĐẠO VĂN AST (MOSS AST CHECK)")
    print(f"[*] Quét thư mục: {repos_dir}")
    print(f"[*] Ngưỡng tương đồng: {int(args.threshold * 100)}% (k-gram={args.k_gram})")
    print(f"============================================================")

    res = run_plagiarism_check(repos_dir, threshold=args.threshold, k=args.k_gram)

    print(f"[✓] Đã phân tích: {res['total_bots']} bài nộp")
    print(f"[✓] Tổng số cặp so sánh: {res['total_comparisons']:,}")
    print(f"[!] Số cặp vượt ngưỡng {int(args.threshold * 100)}%: {res['flagged_count']} cặp\n")

    if res["flagged_pairs"]:
        print(f"{'Hạng':<5} | {'Thí sinh A':<15} | {'Thí sinh B':<15} | {'Jaccard':<9} | {'Bao hàm':<9} | {'Tình trạng'}")
        print("-" * 75)
        for idx, p in enumerate(res["flagged_pairs"][:15], 1):
            status_text = "🚨 RẤT CAO" if p["score"] >= 0.8 else ("⚠️ CAO" if p["score"] >= 0.6 else "🔍 NGHI VẤN")
            print(f"#{idx:<4} | {p['student_a']:<15} | {p['student_b']:<15} | {p['jaccard_similarity']*100:>6.1f}% | {p['containment_similarity']*100:>6.1f}% | {status_text}")

    # Xuất file báo cáo Markdown
    md_path = args.output_md or os.path.join(os.path.dirname(repos_dir), "moss_report.md")
    generate_markdown_report(res, md_path)
    print(f"\n[✓] Đã xuất báo cáo Markdown tại: {md_path}")

    # Xuất file JSON nếu có yêu cầu
    if args.output_json:
        with open(args.output_json, "w", encoding="utf-8") as f:
            json.dump(res, f, indent=2, ensure_ascii=False)
        print(f"[✓] Đã xuất dữ liệu JSON tại: {args.output_json}")


if __name__ == "__main__":
    main()
