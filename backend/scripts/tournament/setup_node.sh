#!/usr/bin/env bash
# ================================================================
#   HỘI ĐỒNG CHẤM THI OTTV2 TOURNAMENT — THIẾT LẬP MÁY CHẤM 1-CLICK (Linux / macOS)
#   Khoa Công nghệ Thông tin — Trường Đại học Công nghệ (VNU-UET)
# ================================================================

set -e

echo "=== THIẾT LẬP MÁY CHẤM OTTV2 (LINUX / MACOS) ==="

if ! command -v python3 &> /dev/null; then
    echo "[!] LỖI: Không tìm thấy python3. Vui lòng cài đặt Python 3.10+."
    exit 1
fi

echo "[*] Phiên bản Python:"
python3 --version

if [ ! -d ".venv" ]; then
    echo "[*] Đang khởi tạo môi trường ảo Python .venv..."
    python3 -m venv .venv
fi

echo "[*] Kích hoạt môi trường ảo..."
source .venv/bin/activate

echo "[*] Cài đặt phụ trợ tối thiểu..."
pip install -r requirements_node.txt --quiet

echo ""
echo "================================================================"
echo "[✓] HOÀN TẤT THIẾT LẬP MÁY CHẤM!"
echo ""
echo "HƯỚNG DẪN CHẤM THI TỪNG VÒNG:"
echo "  1. Nhận file chunk từ Ban Tổ Chức (VD: chunk_01.json)"
echo "  2. Chạy lệnh:"
echo "     python3 run_batch.py --chunk-file chunk_01.json --workers 4"
echo "  3. Gửi lại file kết quả result_01.json cho máy chủ Ban Tổ Chức."
echo "================================================================"
