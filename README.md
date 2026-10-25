# ⚔️ OTTv2 Tournament Platform — Đấu Trường Trí Tuệ Nhân Tạo

> **Hệ thống tổ chức thi đấu, thẩm định bot và phát sóng trực tiếp giải đấu cờ OTTv2 (Oẳn Tù Tì v2) dành cho sinh viên Khoa CNTT — Trường Đại học Công nghệ (VNU-UET).**


[![FastAPI](https://img.shields.io/badge/Backend-FastAPI_0.103-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React_18_+_Vite-61DAFB?style=flat&logo=react)](https://react.dev/)
[![WebSocket](https://img.shields.io/badge/Realtime-WebSocket_Streaming-orange?style=flat)](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
[![Tests](https://img.shields.io/badge/Pytest-106%2F106_Passed_(100%25)-brightgreen?style=flat&logo=pytest)](https://docs.pytest.org/)
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
* **Pipeline Thu Bài Google Form Tự Động:** Tự động đọc file CSV nộp bài của hàng trăm/hàng nghìn sinh viên, clone repo GitHub, kiểm tra cấu trúc mã nguồn, đo thời gian phản hồi nước đi đầu tiên trong Sandbox siêu tốc.
* **Thẩm định gói bài nộp tự động (Validator T08/T09):** Tự động kiểm tra cấu trúc gói `.zip` (`bot.py`, `REPORT.md`, `git_log.txt` với $\ge 4$ commits) và quét rò rỉ mã bí mật API Key.
* **Sandbox cô lập an toàn (Sandbox T10 & In-Process Executor):** Chạy code bot trong môi trường kiểm soát, chặn truy cập mạng trái phép và xử lý bot crash/timeout mà không làm ảnh hưởng máy chủ (tối ưu hoạt động siêu nhẹ trên Cloud Render/Neon).
* **Multi-Driver Database Auto-Fallback:** Hỗ trợ linh hoạt cả SQLite cục bộ lẫn PostgreSQL trên Cloud (Render/Neon) với cơ chế tự động tương thích giữa `psycopg2-binary` và `psycopg` v3.
* **Admin BTC & Hội Đồng Chấm Điểm:** Giao diện chấm thi chuyên dụng cho Hội đồng: duyệt trực tiếp mã nguồn bot, tiến trình tự lập trình qua lịch sử Git commit, báo cáo ý tưởng thuật toán, tự động tính điểm theo trọng số Bảng điểm Swiss 13 Vòng & Top 32 và điều hành giải đấu tập trung.
* **Bảo vệ toàn diện:** Middleware Rate Limiting trượt cửa sổ chống DoS/brute-force, `ErrorBoundary` ngăn chặn sập giao diện, giao diện tối ưu 100% trên thiết bị di động.

---

## 🗂️ 3. Cấu Trúc Dự Án

```
ottv2-tournament/
├── backend/                        # Máy chủ FastAPI + Engine Referee
│   ├── app/
│   │   ├── main.py                 # Ứng dụng chính, CORS, Rate Limit, Lifespan
│   │   ├── config.py               # Cấu hình môi trường (Pydantic Settings)
│   │   ├── database.py             # Kết nối SQLAlchemy (Hỗ trợ SQLite, PostgreSQL đa driver)
│   │   ├── middleware/             # Rate Limiting Sliding-window
│   │   ├── models/                 # ORM Models (User, Match, Replay, Submission)
│   │   ├── routers/                # API Endpoints: auth, submit, matches, leaderboard, admin
│   │   ├── services/
│   │   │   ├── engine/             # Engine OTTv2: board.py, rules.py, referee.py
│   │   │   ├── sandbox.py          # Môi trường chạy bot an toàn
│   │   │   ├── validator.py        # Thẩm định gói nộp T08 & Scanner T09
│   │   │   ├── pipeline_service.py # Xử lý tự động batch nộp bài từ Google Form CSV
│   │   │   └── starter_bots/       # Bot mẫu: RandomBot, GreedyBot, FaultyBots
│   │   └── websocket/              # Quản lý kết nối WebSocket thời gian thực
│   ├── tests/                      # Bộ kiểm thử 106 unit tests (T01–T10, API, Swiss, Pipeline)
│   ├── scripts/                    # Công cụ quản trị & Kịch bản thi đấu
│   │   ├── reset_clean_db.py       # Reset sạch CSDL và đồng bộ tài khoản Admin BTC
│   │   ├── test_db_connection.py   # Kiểm tra độ trễ & cấu trúc bảng CSDL
│   │   ├── load_test_tournament.py # Kịch bản load test 50-100 bot đồng thời
│   │   └── run_full_tournament_pipeline.py # Điều hành giải đấu tự động phân tán
│   ├── seed_demo_data.py           # Khởi tạo tài khoản và ván đấu mẫu
│   ├── requirements.txt            # Thư viện Python (FastAPI, SQLAlchemy, psycopg,...)
│   └── Dockerfile                  # Đóng gói Docker Backend (Đã tích hợp Git & tối ưu Python slim)
├── frontend/                       # Giao diện Web (React 18 + Vite)
│   ├── src/
│   │   ├── app/                    # Router và cấu hình ứng dụng
│   │   ├── modules/
│   │   │   ├── home/               # Trang chủ giới thiệu giải đấu
│   │   │   ├── rules/              # Trang luật thi đấu chi tiết
│   │   │   ├── leaderboard/        # Bảng xếp hạng real-time theo Tier & Điểm Swiss
│   │   │   ├── matches/            # Danh sách ván đấu, Replay & Live Board
│   │   │   ├── submit/             # Cổng nộp bài và kiểm tra gói zip
│   │   │   ├── auth/               # Đăng nhập & Đăng ký
│   │   │   └── admin/              # Trung tâm điều hành & chấm điểm Hội đồng
│   │   └── shared/                 # Thành phần dùng chung (BoardSVG, Navbar, ErrorBoundary)
│   └── Dockerfile                  # Multi-stage Docker build cho Frontend (Node Serve)
├── docker-compose.yml              # Khởi chạy toàn bộ hệ thống bằng Docker
├── render.yaml                     # Cấu hình Blueprint deploy 1-click lên Render
├── rules.json                      # Đặc tả luật máy đọc công khai
├── RENDER_DEPLOY_GUIDE.md          # Hướng dẫn chi tiết triển khai Cloud
└── BAO_CAO_TONG_HOP_GIAI_DAU_VA_HE_THONG_OTTV2.md # Báo cáo đề án toàn diện
```

---

## 🚀 4. Hướng Dẫn Cài Đặt & Chạy Cục Bộ (Local)

### ⚡ Khởi Chạy 1-Click Cả Backend & Frontend (Khuyên Dùng)

Dự án đã tích hợp sẵn script tự động bật cả Backend (:8000), Frontend (:5173) và mở trình duyệt:
- **Trên Windows (Double-click)**: Chạy file `start_dev.bat` tại thư mục gốc của dự án.
- **Hoặc qua PowerShell**:
  ```powershell
  .\start_dev.ps1
  ```
- **Dừng toàn bộ hệ thống**: Chạy `stop_dev.bat` hoặc tắt 2 cửa sổ terminal vừa mở.

---

### 4.1. Chạy Thủ Công Backend (FastAPI)

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

# 5. Khởi chạy máy chủ API (Chỉ watch thư mục app để không reload khi tải bài nộp vào storage)
uvicorn app.main:app --reload --reload-dir app --port 8000
```
* API Docs: `http://localhost:8000/docs`
* Kiểm tra Health: `http://localhost:8000/health`

### 4.2. Tiện Ích Quản Trị CSDL & Kiểm Tra Kết Nối

Backend cung cấp các script CLI mạnh mẽ hỗ trợ quản trị viên:
```bash
cd backend

# Kiểm tra kết nối CSDL hiện tại (SQLite cục bộ hoặc PostgreSQL trên Cloud)
python scripts/test_db_connection.py

# Kiểm tra với chuỗi kết nối Cloud cụ thể (ví dụ Neon / Render)
python scripts/test_db_connection.py --db-url "postgresql+psycopg2://user:pass@ep-host.region.neon.tech/neondb?sslmode=require"

# Reset sạch sẽ toàn bộ CSDL và tạo sẵn tài khoản Admin BTC:
# Lưu ý: Thêm cờ --skip-local-storage khi reset DB Cloud từ xa để không xóa nhầm file local storage
python scripts/reset_clean_db.py --db-url "postgresql+psycopg2://user:pass@ep-host.region.neon.tech/neondb?sslmode=require" --skip-local-storage
```

### 4.3. Chạy Frontend (React + Vite)

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

Sau khi chạy lệnh `seed_demo_data.py` hoặc `reset_clean_db.py`, hệ thống đã có sẵn các tài khoản sau:

| Vai trò | Email đăng nhập | Mật khẩu | Quyền hạn |
| :--- | :--- | :--- | :--- |
| **Ban Tổ Chức (Admin)** | `admin@uet.vnu.edu.vn` | `admin123` | Toàn quyền Admin BTC, khởi chạy giải, quản lý bài nộp, chấm điểm |
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

### Chạy Unit Tests Toàn Diện (106/106 Tests Passed - 100%):
```bash
cd backend
pytest -v
```
Toàn bộ 106 ca kiểm thử bao gồm:
* **T01–T06:** Khởi tạo bàn cờ 9x9, sinh nước đi hợp lệ, cơ chế ăn quân Oẳn Tù Tì, điều kiện thắng W1 (hết quân) & W2 (chuồng đối phương), điều kiện hòa D1 (200 nước) & D2 (lặp cờ 3 lần).
* **T07–T10:** Phạt thua bot T1 (Timeout, Crash, Nước đi sai), cơ chế Sandbox chặn socket mạng & an toàn hệ thống, Thẩm định gói nộp T08 và Scanner rò rỉ API key T09.
* **Pipeline & DB Multi-driver:** Kiểm thử tự động chuẩn hóa chuỗi kết nối CSDL, parse ngày giờ Google Form tiếng Việt (`SA`/`CH`, múi giờ `GMT+7`), và thuật toán bốc thăm Swiss System FIDE.

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
| **Sprint 7** | Batch CSV Pipeline + Multi-driver PostgreSQL + Swiss 13 Vòng + 106 Tests | ✅ **Hoàn thành** |

---

## 📜 9. Bản Quyền & Giấy Phép

Dự án được xây dựng phục vụ môn học **Lập Trình Mạng** — Trường Đại học Công nghệ, ĐHQGHN (VNU-UET).  
Mã nguồn mở theo giấy phép MIT License.
