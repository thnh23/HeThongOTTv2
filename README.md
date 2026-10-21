# ⚔️ OTTv2 Tournament Platform — Đấu Trường Trí Tuệ Nhân Tạo

> **Hệ thống tổ chức thi đấu, thẩm định bot và phát sóng trực tiếp giải đấu cờ OTTv2 (Oẳn Tù Tì v2) dành cho sinh viên Khoa CNTT — Trường Đại học Công nghệ (VNU-UET).**


[![FastAPI](https://img.shields.io/badge/Backend-FastAPI_0.103-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React_18_+_Vite-61DAFB?style=flat&logo=react)](https://react.dev/)
[![WebSocket](https://img.shields.io/badge/Realtime-WebSocket_Streaming-orange?style=flat)](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
[![Tests](https://img.shields.io/badge/Pytest-73%2F73_Passed_(100%25)-brightgreen?style=flat&logo=pytest)](https://docs.pytest.org/)
[![Docker](https://img.shields.io/badge/Deployment-Docker_&_Render_Cloud-2496ED?style=flat&logo=docker)](https://render.com)

---

## 📖 1. Luật Chơi Nhanh OTTv2 (9×9)

| Yếu tố | Chi tiết quy định |
| :--- | :--- |
| **Bàn cờ** | Kích thước **9×9 ô** (Cột `a–i`, Hàng `1–9`). |
| **Quân cờ** | Gồm 3 loại quân: **Búa** (R - Rock), **Kéo** (S - Scissors), **Bao** (P - Paper). |
| **Di chuyển** | Di chuyển **1 ô theo 8 hướng** (tương tự quân Vua trong cờ Vua). |
| **Cơ chế ăn quân** | Theo luật Oẳn Tù Tì: **Búa > Kéo > Bao > Búa**. Quân cùng loại sẽ chặn nhau (không thể đi vào). |
| **Mã kết thúc** | • **W1**: Đối phương mất sạch 1 loại quân (ví dụ: ăn hết toàn bộ Kéo).<br>• **W2**: Quân vào chuồng góc đối phương (`i9` với Trắng, `a1` với Đen).<br>• **D1 / D2**: Hòa do quá 200 nước hoặc lặp lại thế cờ 3 lần.<br>• **T1**: Xử thua do Bot Timeout, Crash, hoặc nước đi không hợp lệ. |

---

## 🌟 2. Các Tính Năng Nổi Bật

* **BoardSVG & Replay Player:** Bàn cờ vector 9×9 trực quan, mượt mà. Trình chiếu phát lại toàn bộ lịch sử nước đi với thanh trượt tiến độ, điều chỉnh tốc độ (1x–4x) và xuất file replay JSON.
* **WebSocket Live Streaming:** Cập nhật bảng xếp hạng và phát sóng trực tiếp ván đấu đang diễn ra theo thời gian thực không cần tải lại trang.
* **Thẩm định gói bài nộp tự động (Validator T08/T09):** Tự động kiểm tra cấu trúc gói `.zip` (`bot.py`, `REPORT.md`, `git_log.txt` với $\ge 4$ commits) và quét rò rỉ mã bí mật API Key.
* **Sandbox cô lập an toàn (Sandbox T10):** Chạy code bot trong môi trường kiểm soát, chặn truy cập mạng trái phép và xử lý bot crash/timeout mà không làm ảnh hưởng máy chủ.
* **Admin BTC & Hội Đồng Chấm Điểm:** Giao diện chấm thi chuyên dụng cho Hội đồng: duyệt trực tiếp mã nguồn bot, tiến trình tự lập trình qua lịch sử Git commit, báo cáo ý tưởng thuật toán, tự động tính điểm theo trọng số Bảng điểm Swiss 13 Vòng & Top 32 và điều hành giải đấu tập trung.
* **Bảo vệ toàn diện:** Middleware Rate Limiting trượt cửa sổ chống DoS/brute-force, `ErrorBoundary` ngăn chặn sập giao diện, giao diện tối ưu 100% trên thiết bị di động.

---

## 🗂️ 3. Cấu Trúc Dự Án

```
ottv2-tournament/
├── backend/                        # Máy chủ FastAPI + Engine Referee
│   ├── app/
│   │   ├── main.py                 # Ứng dụng chính, CORS, Rate Limit, Lifespan
│   │   ├── config.py               # Cấu hình môi trường (Pydantic)
│   │   ├── database.py             # Kết nối SQLAlchemy (SQLite / PostgreSQL)
│   │   ├── middleware/             # Rate Limiting Sliding-window
│   │   ├── models/                 # ORM Models (User, Match, Replay, Submission)
│   │   ├── routers/                # API Endpoints: auth, submit, matches, leaderboard, admin
│   │   ├── services/
│   │   │   ├── engine/             # Engine OTTv2: board.py, rules.py, referee.py
│   │   │   ├── sandbox.py          # Môi trường chạy bot an toàn
│   │   │   ├── validator.py        # Thẩm định gói nộp T08 & Scanner T09
│   │   │   └── starter_bots/       # Bot mẫu: RandomBot, GreedyBot, FaultyBots
│   │   └── websocket/              # Quản lý kết nối WebSocket thời gian thực
│   ├── tests/                      # Bộ kiểm thử 73 unit tests (T01–T10)
│   ├── scripts/                    # Kịch bản load test 50-100 bot
│   ├── seed_demo_data.py           # Khởi tạo tài khoản và ván đấu mẫu
│   ├── requirements.txt            # Thư viện Python
│   └── Dockerfile                  # Đóng gói Docker Backend
├── frontend/                       # Giao diện Web (React 18 + Vite)
│   ├── src/
│   │   ├── app/                    # Router và cấu hình ứng dụng
│   │   ├── modules/
│   │   │   ├── home/               # Trang chủ giới thiệu giải đấu
│   │   │   ├── rules/              # Trang luật thi đấu chi tiết
│   │   │   ├── leaderboard/        # Bảng xếp hạng real-time theo Tier
│   │   │   ├── matches/            # Danh sách ván đấu, Replay & Live Board
│   │   │   ├── submit/             # Cổng nộp bài và kiểm tra gói zip
│   │   │   ├── auth/               # Đăng nhập & Đăng ký
│   │   │   └── admin/              # Trung tâm điều hành & chấm điểm Hội đồng
│   │   └── shared/                 # Thành phần dùng chung (BoardSVG, Navbar, ErrorBoundary)
│   ├── nginx.conf                  # Reverse Proxy Nginx cho production
│   └── Dockerfile                  # Multi-stage Docker build cho Frontend
├── docker-compose.yml              # Khởi chạy toàn bộ hệ thống bằng Docker
├── render.yaml                     # Cấu hình Blueprint deploy 1-click lên Render
├── rules.json                      # Đặc tả luật máy đọc công khai
└── RENDER_DEPLOY_GUIDE.md          # Hướng dẫn chi tiết triển khai Cloud
```

---

## 🚀 4. Hướng Dẫn Cài Đặt & Chạy Cục Bộ (Local)

### 4.1. Chạy Backend (FastAPI)

```bash
# 1. Di chuyển vào thư mục backend
cd backend

# 2. Tạo môi trường ảo và kích hoạt
python -m venv .venv
# Trên Windows:
.\.venv\Scripts\activate
# Trên Linux/macOS:
source .venv/bin/activate

# 3. Cài đặt dependencies
pip install -r requirements.txt

# 4. Nạp dữ liệu thi đấu mẫu (Admin + Bot mẫu)
python seed_demo_data.py

# 5. Khởi chạy máy chủ API
uvicorn app.main:app --reload --port 8000
```
* API Docs: `http://localhost:8000/docs`
* Kiểm tra Health: `http://localhost:8000/health`

### 4.2. Chạy Frontend (React + Vite)

Mở một cửa sổ dòng lệnh mới:
```bash
# 1. Di chuyển vào thư mục frontend
cd frontend

# 2. Cài đặt thư viện Node
npm install

# 3. Khởi chạy dev server
npm run dev
```
* Mở trình duyệt và truy cập: **`http://localhost:5173`**

---

## 🔑 5. Tài Khoản Thử Nghiệm Mẫu

Sau khi chạy lệnh `seed_demo_data.py`, hệ thống đã có sẵn các tài khoản sau:

| Vai trò | Email đăng nhập | Mật khẩu | Quyền hạn |
| :--- | :--- | :--- | :--- |
| **Ban Tổ Chức (Admin)** | `admin@uet.vnu.edu.vn` | `admin123` | Toàn quyền Admin BTC, khởi chạy giải, chấm điểm |
| **Thí sinh Bảng A** | `studentA@uet.vnu.edu.vn` | `pass123` | Nộp bài, theo dõi kết quả thi đấu |
| **Thí sinh Bảng A** | `studentB@uet.vnu.edu.vn` | `pass123` | Nộp bài, theo dõi kết quả thi đấu |
| **Thí sinh Bảng A** | `studentC@uet.vnu.edu.vn` | `pass123` | Nộp bài, theo dõi kết quả thi đấu |

---

## ☁️ 6. Triển Khai Lên Render.com Cloud (Miễn Phí 100%)

Dự án hỗ trợ triển khai hoàn chỉnh lên **Render Cloud** với CSDL PostgreSQL vĩnh viễn:

### Triển khai 1-Click bằng Blueprint:
1. Đẩy mã nguồn lên kho GitHub của bạn:
   ```bash
   git init && git add . && git commit -m "feat: init repo"
   git push -u origin main
   ```
2. Mở [Render Dashboard](https://dashboard.render.com/) ➔ Chọn **New +** ➔ **Blueprint**.
3. Kết nối với repo GitHub vừa tạo. Render sẽ tự động đọc tệp [`render.yaml`](./render.yaml) và khởi tạo cả Backend lẫn Frontend.

*(Xem hướng dẫn chi tiết từng bước tạo PostgreSQL Database và Static Site tại [RENDER_DEPLOY_GUIDE.md](./RENDER_DEPLOY_GUIDE.md)).*

---

## 🧪 7. Kiểm Thử & Đảm Bảo Chất Lượng

### Chạy Unit Tests Engine & Referee (73/73 Tests Passed):
```bash
cd backend
pytest -v
```
Toàn bộ các ca kiểm thử T01–T10 (Bàn cờ, Nước đi, Ăn quân, W1/W2, D1/D2, Timeout T1, Sandbox mạng, Validator gói nộp, Scanner API key) đều đạt **100% tỷ lệ vượt qua**.

### Chạy Kịch Bản Kiểm Thử Chịu Tải (50 Bot — 100 Trận Đồng Thời):
```bash
cd backend
python scripts/load_test_tournament.py
```
* Tốc độ xử lý: **~4.36 trận/giây**.
* Tự động bắt đúng mọi lỗi crash, timeout, phạm luật mà không làm sập server.

---

## 📋 8. Trạng Thái Hoàn Thành Các Sprint

| Sprint | Nội Dung Công Việc | Trạng Thái |
| :---: | :--- | :---: |
| **Sprint 1** | Engine luật OTTv2 (`board.py`, `rules.py`) + JWT Auth + Database Schema | ✅ **Hoàn thành** |
| **Sprint 2** | Sandbox an toàn + Referee ván đấu + Validator T08/T09 + Core API | ✅ **Hoàn thành** |
| **Sprint 3** | Frontend React Core (Trang chủ, Rules, Leaderboard, Matches, Submit) | ✅ **Hoàn thành** |
| **Sprint 4** | BoardSVG tương tác + Replay Player 9×9 + WebSocket Live Stream | ✅ **Hoàn thành** |
| **Sprint 5** | Admin Dashboard + Runner giải đấu Round-Robin + Chấm điểm hồ sơ AI | ✅ **Hoàn thành** |
| **Sprint 6** | Tối ưu Mobile + ErrorBoundary + Rate Limiting + Deploy Docker/Render | ✅ **Hoàn thành** |

---

## 📜 9. Bản Quyền & Giấy Phép

Dự án được xây dựng phục vụ môn học **Lập Trình Mạng** — Trường Đại học Công nghệ, ĐHQGHN (VNU-UET).  
Mã nguồn mở theo giấy phép MIT License.
