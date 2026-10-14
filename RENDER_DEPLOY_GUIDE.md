# Hướng Dẫn Deploy Hệ Thống OTTv2 Lên Render.com 🚀

Tài liệu này hướng dẫn chi tiết cách triển khai toàn bộ hệ thống giải đấu **OTTv2 Tournament Platform** (gồm Backend FastAPI + Frontend React/Vite + WebSocket + Database) lên nền tảng đám mây **Render.com** hoàn toàn miễn phí.

---

## Cách 1: Triển Khai Nhanh Bằng Render Blueprint (Khuyên Dùng — 1 Click)

Dự án đã có sẵn file cấu hình [`render.yaml`](./render.yaml).

### Các bước thực hiện:
1. Đẩy mã nguồn dự án lên GitHub hoặc GitLab của bạn:
   ```bash
   git add .
   git commit -m "feat: chuẩn bị cấu hình deploy render"
   git push origin main
   ```
2. Đăng nhập vào [Render.com](https://dashboard.render.com/).
3. Tại trang Dashboard, nhấn nút **New +** ở góc trên bên phải → chọn **Blueprint**.
4. Chọn repository GitHub vừa đẩy lên và bấm **Connect**.
5. Render sẽ tự động đọc file `render.yaml` và nhận diện 2 dịch vụ:
   - `ottv2-backend` (Web Service Python)
   - `ottv2-frontend` (Static Site React/Vite)
6. Nhấn **Apply**. Render sẽ tự động cài đặt dependencies, build và triển khai cả 2 dịch vụ!

---

## Cách 2: Triển Khai Thủ Công Từng Dịch Vụ Trên Render Dashboard

Nếu bạn muốn kiểm soát từng dịch vụ riêng biệt, hãy làm theo hướng dẫn dưới đây:

### Bước 1: Tạo Backend Web Service
1. Tại Render Dashboard, bấm **New +** → chọn **Web Service**.
2. Chọn repository của bạn.
3. Điền thông tin cấu hình như sau:
   - **Name**: `ottv2-backend`
   - **Region**: `Singapore` (hoặc khu vực gần bạn nhất)
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: `Free`
4. Mở rộng phần **Advanced** → Thêm các biến môi trường (**Environment Variables**):
   | Key | Value | Giải thích |
   | :--- | :--- | :--- |
   | `PYTHON_VERSION` | `3.12.0` | Phiên bản Python |
   | `DATABASE_URL` | `sqlite:///./ottv2.db` | CSDL SQLite mặc định |
   | `SECRET_KEY` | *(Tạo ngẫu nhiên 32 ký tự)* | Khóa bí mật ký JWT Token |
   | `FRONTEND_URL` | `*` | Cho phép CORS từ Frontend |
   | `SANDBOX_TIMEOUT_SEC` | `5` | Thời gian tối đa mỗi nước đi bot (giây) |
   | `SANDBOX_MEMORY_MB` | `128` | Giới hạn RAM sandbox (MB) |
   | `STORAGE_PATH` | `./storage` | Thư mục lưu trữ bài nộp |
5. Nhấn **Create Web Service**.
6. Sau khi deploy xong, Render sẽ cấp cho bạn một URL, ví dụ:  
   👉 `https://ottv2-backend.onrender.com`

---

### Bước 2: Tạo Frontend Static Site
1. Tại Render Dashboard, bấm **New +** → chọn **Static Site**.
2. Chọn repository của bạn.
3. Điền thông tin cấu hình như sau:
   - **Name**: `ottv2-frontend`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Cấu hình **Redirects/Rewrites** (Rất quan trọng cho ứng dụng Single Page App):
   - Mở tab **Redirects/Rewrites** của Static Site vừa tạo.
   - Bấm **Add Rule**:
     - **Type**: `Rewrite`
     - **Source**: `/*`
     - **Destination**: `/index.html`
   *(Giúp người dùng khi F5 tải lại các trang như `/leaderboard`, `/admin`, `/matches/123` không bị lỗi 404)*
5. Mở tab **Environment** → Thêm các biến môi trường (**Environment Variables**):
   | Key | Value |
   | :--- | :--- |
   | `VITE_API_BASE_URL` | `https://<ten-backend-cua-ban>.onrender.com/api` |
   | `VITE_WS_BASE_URL` | `wss://<ten-backend-cua-ban>.onrender.com/ws` |
   *(Thay `<ten-backend-cua-ban>` bằng domain backend tạo ở Bước 1, chú ý WebSocket dùng tiền tố `wss://`)*
6. Nhấn **Save Changes** và bấm **Manual Deploy** → **Clear build cache & deploy**.
7. Sau khi build hoàn tất, bạn đã có trang web giải đấu online:  
   👉 `https://ottv2-frontend.onrender.com`

---

## 3. Tài Khoản & Dữ Liệu Mẫu Sau Khi Deploy

Hệ thống được thiết kế **tự động phát hiện database mới**:
- Khi backend khởi động lần đầu trên Render, nếu bảng dữ liệu đang trống, hệ thống sẽ **tự động seed tài khoản admin và bot mẫu**:
  - **Tài khoản Admin BTC**: `admin@uet.vnu.edu.vn` (Mật khẩu: `admin123`)
  - **Tài khoản Thí sinh mẫu**:
    - `studentA@uet.vnu.edu.vn` / `pass123`
    - `studentB@uet.vnu.edu.vn` / `pass123`
    - `studentC@uet.vnu.edu.vn` / `pass123`
  - Các ván đấu mẫu sẵn sàng để kiểm tra tính năng Replay và BXH!

---

## 4. Tùy Chọn: Sử Dụng Render PostgreSQL (Miễn Phí & Dữ Liệu Bền Vững)

Nếu bạn muốn dữ liệu trận đấu và bài nộp của sinh viên được lưu trữ vĩnh viễn (không bị reset khi instance free-tier ngủ đông):
1. Trên Render Dashboard, bấm **New +** → **PostgreSQL**.
2. Đặt tên, ví dụ: `ottv2-db`, chọn Plan **Free**.
3. Sau khi database tạo xong, sao chép chuỗi **Internal Database URL** (hoặc External Database URL).
4. Vào Web Service `ottv2-backend` → tab **Environment** → cập nhật:
   - `DATABASE_URL` = `dán chuỗi postgresql://... vừa copy`
5. Backend sẽ tự động kết nối và tạo toàn bộ bảng trên PostgreSQL mà không cần cấu hình thêm!
