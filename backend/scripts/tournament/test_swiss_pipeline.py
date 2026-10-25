#!/usr/bin/env python3
"""
test_swiss_pipeline.py — End-to-End Test for Swiss Tournament CLI Engine
=========================================================================
Kiểm thử toàn diện 3 công cụ:
  1. pair_swiss.py: Ghép cặp và chia chunk
  2. run_batch.py: Chấm thi song song qua multiprocessing
  3. merge_and_publish.py: Hợp nhất điểm, tính Buchholz / SB và xuất bản JSON
"""

import os
import sys
import shutil
import tempfile
import subprocess
import json

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", ".."))
PYTHON_EXE = sys.executable


def test_pipeline():
    test_dir = os.path.join(CURRENT_DIR, "_test_swiss_run")
    if os.path.exists(test_dir):
        shutil.rmtree(test_dir)
    os.makedirs(test_dir, exist_ok=True)

    chunks_dir = os.path.join(test_dir, "chunks")
    results_dir = os.path.join(test_dir, "results")
    publish_dir = os.path.join(test_dir, "published")
    os.makedirs(results_dir, exist_ok=True)

    players_file = os.path.join(test_dir, "test_players.json")
    with open(players_file, "w", encoding="utf-8") as f:
        json.dump([{"id": f"p_{i}", "name": f"Player {i}", "bot_name": f"Bot_{i}"} for i in range(1, 41)], f)

    print("\n[BƯỚC 1] Chạy pair_swiss.py cho 40 thí sinh, chia 4 chunk...")
    pair_script = os.path.join(CURRENT_DIR, "pair_swiss.py")
    res = subprocess.run([
        PYTHON_EXE, pair_script,
        "--round", "1",
        "--player-count", "40",
        "--num-chunks", "4",
        "--players-file", players_file,
        "--chunks-dir", chunks_dir
    ], capture_output=True, text=True, encoding="utf-8", cwd=BACKEND_DIR)
    assert res.returncode == 0, f"pair_swiss.py failed: {res.stderr}"
    print("✓ pair_swiss.py chạy thành công!")

    # Kiểm tra 4 file chunk
    for i in range(1, 5):
        chunk_file = os.path.join(chunks_dir, f"chunk_{str(i).zfill(2)}.json")
        assert os.path.exists(chunk_file), f"Thiếu {chunk_file}"
        with open(chunk_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            assert len(data["matches"]) == 5, f"Chunk {i} phải có 5 trận đấu (tổng 20 trận cho 40 thí sinh)"
    print("✓ 4 chunk_XX.json đã được tạo chuẩn xác (5 trận/chunk)!")

    print("\n[BƯỚC 2] Chạy run_batch.py trên 4 chunk...")
    batch_script = os.path.join(CURRENT_DIR, "run_batch.py")
    for i in range(1, 5):
        chunk_file = os.path.join(chunks_dir, f"chunk_{str(i).zfill(2)}.json")
        result_file = os.path.join(results_dir, f"result_{str(i).zfill(2)}.json")
        res = subprocess.run([
            PYTHON_EXE, batch_script,
            "--chunk-file", chunk_file,
            "--output-file", result_file,
            "--workers", "2",
            "--timeout", "1.0"
        ], capture_output=True, text=True, encoding="utf-8", cwd=BACKEND_DIR)
        assert res.returncode == 0, f"run_batch.py failed for chunk {i}: {res.stderr}"
        assert os.path.exists(result_file), f"Thiếu {result_file}"
        with open(result_file, "r", encoding="utf-8") as f:
            rdata = json.load(f)
            assert rdata["total_matches"] == 5
    print("✓ Cả 4 file result_XX.json đã chấm xong và hợp lệ!")

    print("\n[BƯỚC 3] Chạy merge_and_publish.py...")
    merge_script = os.path.join(CURRENT_DIR, "merge_and_publish.py")
    res = subprocess.run([
        PYTHON_EXE, merge_script,
        "--round", "1",
        "--results-dir", results_dir,
        "--players-file", os.path.join(chunks_dir, "players_before_r1.json"),
        "--publish-dir", publish_dir
    ], capture_output=True, text=True, encoding="utf-8", cwd=BACKEND_DIR)
    assert res.returncode == 0, f"merge_and_publish.py failed: {res.stderr}"

    # Kiểm tra các file đã xuất bản
    standings_file = os.path.join(publish_dir, "standings.json")
    top32_file = os.path.join(publish_dir, "top32.json")
    round_file = os.path.join(publish_dir, "round_1.json")

    assert os.path.exists(standings_file)
    assert os.path.exists(top32_file)
    assert os.path.exists(round_file)

    with open(standings_file, "r", encoding="utf-8") as f:
        standings = json.load(f)
        assert len(standings) == 40
        assert standings[0]["rank"] == 1
        assert "buchholz" in standings[0]
        assert "sonneborn_berger" in standings[0]
        assert standings[0]["grade_projection"] == "10.0 (A+)"

    with open(top32_file, "r", encoding="utf-8") as f:
        top32 = json.load(f)
        assert len(top32) == 32
        for t in top32:
            assert t["is_top32"] is True

    print("✓ Toàn bộ file JSON tĩnh (standings.json, top32.json, round_1.json) chuẩn xác 100%!")

    # Dọn dẹp thư mục test
    shutil.rmtree(test_dir)
    print("\n============================================================")
    print("🎉 TOÀN BỘ PIPELINE SWISS ENGINE ĐÃ VƯỢT QUA TEST THÀNH CÔNG!")
    print("============================================================\n")


if __name__ == "__main__":
    test_pipeline()
