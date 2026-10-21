# ⚔️ ĐỀ ÁN TỔ CHỨC GIẢI ĐẤU THUẬT TOÁN OTTV2 & THIẾT KẾ HỆ THỐNG
## Dành cho 2.000 Sinh viên — Thể thức Swiss 13 Vòng & Vòng Chung kết Top 32
**Khoa Công nghệ Thông tin — Trường Đại học Công nghệ (VNU-UET)**

---

## 📌 1. BẢN KHÓA THẤU HIỂU & TRIẾT LÝ GIẢI ĐẤU (UNDERSTANDING LOCK)

* **Tên giải đấu:** Đấu Trường Lập Trình Thuật Toán & Game Chiến Thuật OTTv2.
* **Mục tiêu giáo dục:** Khuyến khích sinh viên tự tay lập trình tư duy thuật toán (Minimax, Alpha-Beta Pruning, Heuristic Evaluation, A* Search).
* **Định vị & Giới hạn AI:** AI (ChatGPT/Claude/Copilot) chỉ đóng vai trò trợ lý cú pháp/debug; **nghiêm cấm AI sinh toàn bộ code bot**. Sinh viên bắt buộc phải hiểu sâu sắc và giải trình được từng dòng mã nguồn.
* **Quy mô:** 2.000 sinh viên tham gia thi đấu đồng thời.
* **Chỉ tiêu chi phí & nhân lực:** **0 ĐỒNG CHI PHÍ MÁY CHỦ** và **Tự động hóa 90% nhân lực BTC**.

---

## 🏛️ 2. KIẾN TRÚC TỔNG THỂ 4 TRỤ CỘT (ZERO-COST 4-TIER ARCHITECTURE)

```
[2.000 Sinh viên UET]
       │  (1) Bấm "Use this template" -> Code trên Repo cá nhân
       ▼
┌──────────────────────────────────────────────────────────┐
│  TRỤ CỘT 1: GITHUB TEMPLATE + GOOGLE FORM THU LINK       │
│  • Sinh viên tạo repo ottv2-<MaSV> từ template chuẩn.    │
│  • GitHub Actions tự chạy test T08/T09 & quét API Key.   │
│  • Điền link repo vào Google Form ngắn (chỉ thu text).   │
│  • BTC chạy script clone 2.000 repo trong 5-10 phút.     │
└────────────────────────────┬─────────────────────────────┘
                             │  (2) BTC tải danh sách bot
                             ▼
┌──────────────────────────────────────────────────────────┐
│  TRỤ CỘT 2: BỘ CÔNG CỤ ĐIỀU HÀNH BTC (CLI TOOLKIT)       │
│  • pair_swiss.py: Bốc thăm 13 vòng theo chuẩn FIDE.      │
│  • Cắt 1.000 trận thành 10 gói file chunk_XX.json.       │
└────────────────────────────┬─────────────────────────────┘
                             │  (3) Phân phát gói trận đấu
                             ▼
┌──────────────────────────────────────────────────────────┐
│  TRỤ CỘT 3: CỤM MÁY CHẤM PHÂN TÁN SINH VIÊN (10 LAPTOPS) │
│  • 10 Laptop sinh viên BTC chạy song song (100 trận/máy). │
│  • Chạy bằng Subprocess Sandbox an toàn tuyệt đối.       │
│  • Xong 1 vòng trong 2-3 phút -> Gửi lại result_XX.json. │
└────────────────────────────┬─────────────────────────────┘
                             │  (4) Merge điểm & Xuất JSON
                             ▼
┌──────────────────────────────────────────────────────────┐
│  TRỤ CỘT 4: WEB TĨNH CLOUDFLARE PAGES (JAMSTACK CDN)     │
│  • rankings.json (Điểm 3-1-0, Buchholz, SB, Top 32).     │
│  • pairings.json (Lịch thi đấu vòng kế tiếp).            │
│  • /replays/*.json (Biên bản bàn cờ 9x9 SVG).            │
│  • 2.000 SV tra cứu tức thì (<50ms), không bao giờ sập.  │
└──────────────────────────────────────────────────────────┘
```

---

## ♟️ 3. THỂ THỨC THI ĐẤU SWISS 13 VÒNG & VÒNG CHUNG KẾT

### 3.1. Phân bổ thời gian (2 Ngày)
* **Ngày 1 (Vòng loại giai đoạn 1):** Thi đấu **8 vòng Swiss**. Thanh lọc các bot lỗi và phân tầng rõ rệt nhóm trên/nhóm dưới.
* **Ngày 2 (Vòng loại nước rút & Chung kết):**
  * Buổi sáng: Thi đấu **5 vòng Swiss cuối** (Vòng 9 $\to$ 13) để chốt danh sách Top 32.
  * Buổi chiều: **Vòng Chung kết Top 32** (Đổi luật địa hình, thi đấu loại trực tiếp Knockout).

### 3.2. Quy tắc ghép cặp Swiss (Dutch System)
1. **Vòng 1:** Bốc thăm ngẫu nhiên 100% (Random Pairing).
2. **Vòng 2 đến 13:**
   * **Nhóm điểm (Score Groups):** Các bot cùng điểm số được xếp đấu với nhau.
   * **Tuyệt đối không tái đấu (Strict No-Rematch):** 2 bot chỉ gặp nhau tối đa 1 lần trong 13 vòng.
   * **Cân bằng màu quân (Color Balance):** Luân phiên cầm Trắng/Đen, không cầm 1 màu quá 2 lần liên tiếp.

### 3.3. Thang điểm & Hệ số phụ ưu tiên hàng đầu
1. **Điểm trận:** Thắng = **3 điểm**, Hòa = **1 điểm**, Thua = **0 điểm**.
2. **Hệ số phụ 1: Buchholz (BH)** = Tổng điểm của tất cả 13 đối thủ đã gặp (đánh giá độ khó lịch thi đấu).
3. **Hệ số phụ 2: Sonneborn-Berger (SB)** = $\sum(\text{Điểm đối thủ Thắng}) + 0.5 \times \sum(\text{Điểm đối thủ Hòa})$.
4. **Hệ số phụ 3:** Hiệu số quân cờ ăn được trên bàn cờ.

### 3.4. Vòng Chung kết Top 32 (Đổi luật địa hình)
* **Luật mới:** Xuất hiện các **ô chướng ngại vật / ô cấm đi** (ví dụ: cấm đi vào 4 ô trung tâm `d4, d6, f4, f6`).
* **Thời gian chuẩn bị:** Công bố luật mới trước 24h. Top 32 sinh viên được nộp bản cập nhật **"Bot v2"**.
* **Thể thức:** Knockout BO2 đổi phe (1 ván Trắng, 1 ván Đen; nếu hòa đánh ván phụ cờ chớp Blitz 0.5s/nước).

---

## 🛡️ 4. CHIẾN LƯỢC 4 TẦNG KIỂM SOÁT AI & ĐẠO VĂN (MOSS + GIT)

1. **Tầng 1 (Đề bài độc quyền):** Luật cờ OTTv2 (9×9, Búa-Kéo-Bao, ô đích `i9/a1`, 200 nước) là luật nội bộ UET. AI không có dữ liệu ván cờ mẫu; sinh viên bắt buộc tự tay viết hàm Heuristic đánh giá thế cờ.
2. **Tầng 2 (Lịch sử Git Commit):** Quy định bắt buộc: Repo phải có tối thiểu **4–5 commits** thể hiện quá trình phát triển (Khung hàm $\to$ Heuristic $\to$ Minimax $\to$ Alpha-Beta/Fix timeout). Bài nộp chỉ có 1 commit duy nhất sát deadline sẽ bị trừ điểm quá trình hoặc triệu tập vấn đáp.
3. **Tầng 3 (Quét cây cú pháp AST - MOSS Stanford):** Dùng MOSS so khớp cấu trúc cây cú pháp của 2.000 file `bot.py`. Nếu 2 sinh viên trùng logic $\ge 80\%$, hệ thống gắn cờ gian lận (dùng chung prompt AI hoặc sao chép của nhau).
4. **Tầng 4 (Vấn đáp 5 phút):** Vấn đáp trực tiếp Top 32 sinh viên lọt vào chung kết và nhóm nghi vấn từ MOSS để bảo vệ thuật toán trước khi nhận điểm 10.

---

## 💰 5. CƠ CHẾ QUY ĐỔI ĐIỂM HỌC PHẦN (GIỮ CHÂN SINH VIÊN)

Để sinh viên thi đấu hết mình đến tận vòng thứ 13, thang điểm được tính theo hình thức tích lũy trận thắng:
* **Mức sàn (6.5 – 7.0 điểm):** Nộp bài đúng hạn, vượt qua test CI/CD T08/T09 và thi đấu đủ 13 vòng (không bỏ cuộc giữa chừng).
* **Mốc 4 – 5 trận thắng:** Đạt **7.5 điểm**.
* **Mốc 6 – 7 trận thắng:** Đạt **8.0 – 8.5 điểm**.
* **Mốc 8 – 9 trận thắng:** Đạt **9.0 điểm**.
* **Mốc 10 – 11 trận thắng:** Đạt **9.5 điểm**.
* **Lọt vào Top 32:** Đạt **10.0 điểm tối đa** môn học phần + vinh danh trên bảng vàng website trường UET.

---

## 🎨 6. THIẾT KẾ GIAO DIỆN WEB NỀN SÁNG HIỆN ĐẠI (CLEAN LIGHT DESIGN)

### 6.1. Bảng màu giao diện mới:
* **Background:** Nền xám sáng thanh nhã `#F8FAFC`.
* **Surface Card:** Trắng tuyết `#FFFFFF`, viền mỏng `#E2E8F0`, đổ bóng mềm mại `0 4px 12px rgba(0,0,0,0.05)`.
* **Màu thương hiệu:** Xanh Hoàng Gia UET `#1D4ED8` kết hợp Xanh Mint `#059669` (Thắng) và Vàng Kim `#D97706` (Top 32).
* **Typography:** Phông chữ công nghệ **Plus Jakarta Sans / Inter** thanh thoát, chuẩn tương phản WCAG AAA.

### 6.2. Các tính năng nổi bật trên Web:
1. **Hero Search Widget:** Ô tìm kiếm lớn `🔍 Nhập Mã Sinh Viên (VD: 23020001)...` ➔ Hiển thị tức thì thứ hạng, điểm, đối thủ vòng sau và bàn đấu.
2. **Leaderboard Swiss:** Bảng phẳng Data Table có tab chuyển 13 vòng đấu, ruy-băng vàng kim phân cách Top 32.
3. **Replay Player SVG:** Bàn cờ gỗ sáng (Lichess/Chess.com style) với biểu tượng Búa-Kéo-Bao vector sắc nét, có nút Play/Pause và biên bản nước đi tương tác.
4. **Hỗ trợ ô cản Vòng Chung kết:** Tự động vẽ các ô chướng ngại vật màu xám cấm đi trên bàn cờ cho các ván đấu Top 32.

---

## ⚙️ 7. QUY TRÌNH KỸ THUẬT DÒNG LỆNH (CLI) CHO BAN TỔ CHỨC

Toàn bộ giải đấu được vận hành bằng 5 script Python tại `backend/scripts/tournament/`:

| Bước | Tên Script | Chức năng | Thời gian chạy |
| :---: | :--- | :--- | :---: |
| **1** | `1_clone_from_sheets.py` | Đọc file CSV Google Form, tự động `git clone` 2.000 repo về thư mục `submissions/`. | 5 – 8 phút |
| **2** | `2_moss_and_commits.py` | Gửi code lên MOSS Stanford quét AST + đếm số commit của từng sinh viên. | 3 phút |
| **3** | `3_pair_swiss.py` | Ghép cặp Swiss 1.000 trận theo FIDE Dutch System; cắt thành `chunk_01.json` $\to$ `chunk_10.json`. | 10 giây |
| **4** | `4_run_batch.py` | 10 laptop sinh viên chạy song song (100 trận/máy qua sandbox subprocess an toàn). | 2 – 3 phút |
| **5** | `5_merge_and_publish.py` | Gom 10 file `result_XX.json`, tính Buchholz/SB, xuất `rankings.json` lên Cloudflare Pages. | 5 giây |

---

## 📋 8. NHẬT KÝ QUYẾT ĐỊNH (DECISION LOG)

| Vấn đề | Quyết định chọn | Các phương án đã cân nhắc | Lý do lựa chọn |
| :--- | :--- | :--- | :--- |
| **Kênh nộp bài** | GitHub Template cá nhân + Google Form thu link URL | Google Form nộp zip, Cloudflare R2 direct upload, GitHub Classroom | Không phụ thuộc Classroom; 0đ chi phí; GitHub gánh tải; có Git commit history; Google Form không lo đầy Drive. |
| **Phát hiện AI / Gian lận** | Chiến lược 4 tầng: Đề kháng AI + Lịch sử commit + MOSS Stanford + Vấn đáp Top 32 | Mua phần mềm AI detector thương mại, Vấn đáp 2.000 người | Chi phí 0đ; loại bỏ báo oan (False Positive); tập trung chất xám vào bảo vệ thuật toán của Top 32. |
| **Hạ tầng máy chấm** | Cụm máy chấm phân tán File-batch (10 laptop sinh viên) | Thuê server Cloud 32-core đắt tiền, Hàng đợi LAN socket | Chi phí 0đ; không lo rớt mạng phòng lab; máy sinh viên chạy 2 phút/vòng qua sandbox an toàn tuyệt đối. |
| **Công bố kết quả** | Web tĩnh Jamstack trên Cloudflare Pages | WebSocket server động trên Render, Gửi 26.000 email | Chi phí 0đ; Cloudflare CDN chịu tải vô hạn khi 2.000 sinh viên F5 liên tục; độ trễ <50ms. |
| **Phong cách giao diện** | Modern Clean Light (Nền sáng thanh lịch, bàn cờ Lichess style) | Cyberpunk Dark Theme cũ, Minimalist Codeforces phẳng | Sáng sủa, trang nhã, đúng chất giải đấu Olympic đại học chính quy; hiển thị cực rõ trên máy chiếu giảng đường. |
| **Cơ chế điểm học phần** | Điểm lũy tiến theo số trận thắng ở 13 vòng Swiss | Chỉ lấy điểm Top cao, Trọng số 70% báo cáo + 30% Swiss | Giữ chân 2.000 sinh viên thi đấu hết mình đến vòng 13, chống bỏ giải (AFK) giữa chừng. |
| **Đổi luật Vòng Chung kết** | Bổ sung ô chướng ngại vật; công bố trước 24h & nộp Bot v2 | Giữ nguyên luật cũ, Đổi luật ngẫu nhiên zero-shot | Kích thích Top 32 nâng cấp thuật toán A* / Minimax theo địa hình mới; tạo kịch tính cho ngày thi đấu thứ 2. |
