@echo off
chcp 65001 >nul
echo ================================================================
echo   HỘI ĐỒNG CHẤM THI OTTV2 TOURNAMENT — THIẾT LẬP MÁY CHẤM 1-CLICK
echo   Khoa Công nghệ Thông tin — Trường Đại học Công nghệ (VNU-UET)
echo ================================================================
echo.

:: Kiểm tra Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] LỖI: Không tìm thấy Python trên máy. Vui lòng cài đặt Python 3.10+ từ python.org
    pause
    exit /b 1
)

echo [*] Python đã sẵn sàng:
python --version

:: Khởi tạo môi trường ảo độc lập nếu chưa có
if not exist ".venv" (
    echo [*] Đang khởi tạo môi trường ảo Python .venv...
    python -m venv .venv
)

echo [*] Kích hoạt môi trường ảo...
call .venv\Scripts\activate.bat

echo [*] Cài đặt các gói phụ trợ tối thiểu...
pip install -r requirements_node.txt --quiet

echo.
echo ================================================================
echo [✓] HOÀN TẤT THIẾT LẬP MÁY CHẤM!
echo.
echo HƯỚNG DẪN CHẤM THI TỪNG VÒNG:
echo   1. Nhận file chunk từ Ban Tổ Chức (VD: chunk_01.json)
echo   2. Chạy lệnh:
echo      python run_batch.py --chunk-file chunk_01.json --workers 4
echo   3. Gửi lại file kết quả result_01.json cho máy chủ Ban Tổ Chức.
echo ================================================================
echo.
pause
