@echo off
title OTTv2 Tournament Platform - LAN Launcher
chcp 65001 >nul
echo =====================================================================
echo    OTTv2 TOURNAMENT PLATFORM — KHỞI CHẠY MẠNG LAN CHO GIẢI ĐẤU
echo =====================================================================
echo.

:: Lấy địa chỉ IP mạng nội bộ (IPv4)
for /f "tokens=4" %%a in ('route print^|find " 0.0.0.0"') do (
    set LOCAL_IP=%%a
    goto :ip_found
)
:ip_found

echo [THÔNG TIN TRUY CẬP GIẢI ĐẤU NỘI BỘ]
echo - Giao diện thí sinh và BTC: http://%LOCAL_IP%:5173
echo - Máy chủ Backend API:       http://%LOCAL_IP%:8000
echo - Tài liệu API Swagger:      http://%LOCAL_IP%:8000/docs
echo.
echo [HƯỚNG DẪN THÍ SINH TRONG PHÒNG THI]
echo 1. Kết nối cùng mạng Wi-Fi/LAN của Ban Tổ Chức.
echo 2. Mở trình duyệt và truy cập: http://%LOCAL_IP%:5173
echo 3. Đăng nhập hoặc tạo tài khoản để nộp bài và theo dõi bảng xếp hạng.
echo.
echo =====================================================================
echo Đang khởi động Backend và Frontend...
echo =====================================================================

start "OTTv2 Backend (Port 8000)" cmd /k "cd backend && .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
timeout /t 3 /nobreak >nul
start "OTTv2 Frontend (Port 5173)" cmd /k "cd frontend && npm run dev -- --host 0.0.0.0"

echo.
echo Cả hai dịch vụ đã được khởi chạy trong các cửa sổ riêng biệt!
echo Nhấn phím bất kỳ để đóng trình khởi động này...
pause >nul
