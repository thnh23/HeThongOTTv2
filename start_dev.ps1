# ================================================================
#   ⚔️  KHỞI ĐỘNG HỆ THỐNG OTTV2 TOURNAMENT PLATFORM (POWERSHELL)
#   Khoa Công nghệ Thông tin — Trường Đại học Công nghệ (VNU-UET)
# ================================================================

$RootDir = $PSScriptRoot

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  ⚔️  KHỞI ĐỘNG HỆ THỐNG OTTV2 TOURNAMENT PLATFORM" -ForegroundColor Cyan
Write-Host "  Khoa Công nghệ Thông tin — Trường ĐH Công nghệ (VNU-UET)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Khởi động Backend (FastAPI :8000)
Write-Host "[*] Đang khởi động Backend FastAPI (Port 8000)..." -ForegroundColor Yellow
$BackendCmd = "cd '$RootDir\backend'; if (Test-Path .venv\Scripts\Activate.ps1) { . .venv\Scripts\Activate.ps1 }; uvicorn app.main:app --reload --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $BackendCmd

# 2. Khởi động Frontend (Vite :5173)
Write-Host "[*] Đang khởi động Frontend Vite (Port 5173)..." -ForegroundColor Yellow
$FrontendCmd = "cd '$RootDir\frontend'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $FrontendCmd

# 3. Đợi máy chủ sẵn sàng rồi mở trình duyệt
Write-Host "[*] Đang chờ dịch vụ sẵn sàng..." -ForegroundColor Gray
Start-Sleep -Seconds 3

Write-Host "[✓] Đã khởi động thành công! Đang mở trình duyệt..." -ForegroundColor Green
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  🌐 Trang chủ & Giao diện Web: http://localhost:5173" -ForegroundColor White
Write-Host "  📋 Cổng Nộp Bài & Tra Cứu:     http://localhost:5173/submit" -ForegroundColor White
Write-Host "  🏆 Bảng Xếp Hạng 13 Vòng:      http://localhost:5173/leaderboard" -ForegroundColor White
Write-Host "  ⚔️  Kênh Trực Tiếp Ván Đấu:    http://localhost:5173/matches/live" -ForegroundColor White
Write-Host "  🛡️  Trang Quản Trị Viên (BTC):  http://localhost:5173/admin" -ForegroundColor White
Write-Host "  📖 Tài liệu API (Swagger):     http://localhost:8000/docs" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "(Để dừng hệ thống: Đóng 2 cửa sổ PowerShell vừa được mở)" -ForegroundColor Gray
