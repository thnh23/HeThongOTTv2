#!/usr/bin/env bash
# OTTv2 Tournament Platform - LAN Launcher for Linux/macOS
set -e

echo "====================================================================="
echo "   OTTv2 TOURNAMENT PLATFORM — KHỞI CHẠY MẠNG LAN CHO GIẢI ĐẤU"
echo "====================================================================="

LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || ipconfig getifaddr en0 2>/dev/null || echo "127.0.0.1")

echo ""
echo "[THÔNG TIN TRUY CẬP GIẢI ĐẤU NỘI BỘ]"
echo "- Giao diện thí sinh và BTC: http://${LOCAL_IP}:5173"
echo "- Máy chủ Backend API:       http://${LOCAL_IP}:8000"
echo "- Tài liệu API Swagger:      http://${LOCAL_IP}:8000/docs"
echo ""

echo "Đang khởi động dịch vụ..."
cd "$(dirname "$0")"

# Khởi chạy backend nền
(cd backend && python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000) &
BACKEND_PID=$!

# Khởi chạy frontend nền
(cd frontend && npm run dev -- --host 0.0.0.0) &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
echo "Dịch vụ đang hoạt động. Nhấn Ctrl+C để dừng."
wait
