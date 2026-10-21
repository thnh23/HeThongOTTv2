# TÀI LIỆU THIẾT KẾ: QUY TRÌNH TIẾP NHẬN & THẨM ĐỊNH BÀI THI TỪ FORM (OTTV2 TOURNAMENT)
**Dự án**: Giải Đấu Bot Cờ Oẳn Tù Tì OTTv2 — Trường Đại học Công nghệ (VNU-UET)  
**Quy mô**: ~2.000 Thí sinh / Lớp học phần Lập trình Mạng  
**Trạng thái**: Đã phê duyệt qua quy trình Brainstorming  
**Ngày cập nhật**: 21/10/2026  

---

## 1. TỔNG QUAN & KHÓA NHẬN THỨC YÊU CẦU (UNDERSTANDING SUMMARY)

### 1.1. Mục tiêu (What is being built)
Xây dựng quy trình chuẩn 4 bước tiếp nhận và thẩm định bài thi tập trung từ Google Form:
1. **Thu thập tập trung**: Thí sinh fork template, hoàn thiện mã nguồn và nộp link GitHub Repository vào Google Form.
2. **Nạp & Khử trùng lặp (Deduplication)**: Admin nạp file CSV xuất từ Google Form, hệ thống tự động lọc bản ghi nộp mới nhất theo MSSV trước hạn chót (Deadline).
3. **Tải song song & Khóa thời gian (Parallel Cloner & Time Freeze)**: Sử dụng ThreadPool (16–32 workers) tải song song 2.000 repo (`--filter=blob:none`), tự động `git checkout` commit mới nhất **trước hạn chót** (ngăn chặn hành vi push code muộn sau khi đóng form).
4. **Thẩm định tự động & Phân phối máy chấm**: Kiểm tra 4 tiêu chí cốt lõi mới, xuất cổng tra cứu trực tuyến cho thí sinh và đóng gói 10 Chunks phục vụ cụm máy chấm phân tán.

### 1.2. Lý do tồn tại (Why it exists)
- **Giải bài toán 2.000 sinh viên**: Tránh nghẽn băng thông và đầy bộ nhớ Google Drive khi sinh viên upload file `.zip` trực tiếp; tận dụng hạ tầng lưu trữ phân tán và kiểm soát phiên bản mạnh mẽ của GitHub.
- **Khuyến khích tự tay lập trình & Đảm bảo công bằng**: Bắt buộc lịch sử commit liên tục qua các ngày/tuần, loại bỏ việc nộp mã copy sát giờ, chốt chặt thời điểm commit trước deadline.
- **Tối ưu hóa vận hành cho BTC**: Tự động hóa hoàn toàn từ khâu thu thập $\rightarrow$ tải $\rightarrow$ kiểm tra $\rightarrow$ phân loại lỗi $\rightarrow$ xuất dữ liệu thi đấu trong vòng 5 – 8 phút.

### 1.3. Tiêu chí đánh giá gói bài nộp
Hệ thống chỉ thẩm định 3 yếu tố cốt lõi:
1. **Mã nguồn Bot (`bot.py`)**: Có định nghĩa hàm `choose_move(state)` hợp lệ, vượt qua bước chạy thử trong Sandbox an toàn (1.0s/move, chặn mạng ngoài).
2. **Ý tưởng & Giải thuật (`REPORT.md`)**: Báo cáo phân tích chiến thuật, hàm lượng giá heuristic và độ sâu tìm kiếm.
3. **Tiến trình tự lập trình (`git_log.txt` hoặc `.git`)**: Bắt buộc lịch sử commit có $\ge 4$ commits để chứng minh quá trình tự viết và nâng cấp code.
*(Loại bỏ hoàn toàn yêu cầu nhật ký prompt `PROMPTS.md` và lịch sử chat `chat_history/`)*.

---

## 2. NHẬT KÝ QUYẾT ĐỊNH THIẾT KẾ (DECISION LOG)

| STT | Vấn đề / Quyết định | Các phương án đã cân nhắc | Quyết định lựa chọn & Lý do |
| :---: | :--- | :--- | :--- |
| **D1** | **Hình thức Form thu nhận bài** | • Web upload zip trực tiếp<br>• Google Form upload zip lên Drive<br>• Google Form thu link GitHub Repo | **Google Form thu link GitHub Repo**: Không giới hạn dung lượng Drive, tận dụng hạ tầng Git, có commit history minh bạch. |
| **D2** | **Thời điểm & Cách thức thẩm định** | • Webhook tức thời qua Apps Script<br>• Thẩm định theo đợt (Batch)<br>• Chỉ thẩm định ngày thi | **Thẩm định theo đợt (Batch)**: Tránh quá tải server lúc cao điểm, phù hợp gom dữ liệu sau deadline để chốt đồng loạt. |
| **D3** | **Quy tắc chốt mã nguồn (Freeze)** | • Lấy commit HEAD mới nhất<br>• Yêu cầu gõ Commit hash vào form<br>• Tự động checkout commit trước deadline | **Tự động checkout commit trước deadline**: Tự động hóa 100%, ngăn chặn gian lận tiếp tục sửa code sau khi đã hết giờ nộp form. |
| **D4** | **Kênh phản hồi cho thí sinh** | • Xuất Google Sheets công khai<br>• Cổng Tra Cứu trên Web theo MSSV<br>• Gửi email cá nhân | **Cổng Tra Cứu trên Web theo MSSV**: Tiện lợi, bảo mật email/thông tin cá nhân, sinh viên chủ động kiểm tra trạng thái bài nộp. |
| **D5** | **Kiến trúc triển khai** | • Phương án 1: Web Async Pipeline<br>• Phương án 2: CLI Local<br>• Phương án 3: Apps Script Webhook | **Phương Án 1 (Web Async Pipeline)**: Tích hợp 1-click trực quan trên Dashboard của BTC, có thanh tiến độ live, không phụ thuộc script máy cá nhân. |

---

## 3. THIẾT KẾ KIẾN TRÚC CHI TIẾT (SYSTEM ARCHITECTURE)

```
[Admin UI: CSV + Deadline] ──> [POST /api/admin/pipeline/import-and-validate]
                                               │
                                               ▼ (Async Task ID)
                                   ┌───────────────────────┐
                                   │  BatchPipelineWorker  │
                                   └───────────┬───────────┘
                                               │
     ┌───────────────────┬─────────────────────┼─────────────────────┐
     ▼                   ▼                     ▼                     ▼
[1. CSV Parser]   [2. Git Cloner]      [3. Commit Freezer]   [4. Batch Validator]
Lọc MSSV duy nhất   Tải 16-32 luồng     Lùi về commit         Kiểm tra bot.py,
trước Deadline      blobless clone      hợp lệ trước giờ G    REPORT.md, commit count
     │                   │                     │                     │
     └───────────────────┴─────────────────────┼─────────────────────┘
                                               ▼
                              [Cơ Sở Dữ Liệu: Users & Submissions]
                                               │
                      ┌────────────────────────┴────────────────────────┐
                      ▼                                                 ▼
        [GET /api/submissions/lookup]                    [GET /api/admin/pipeline/export-report]
        Cổng sinh viên tra cứu theo MSSV                 File Excel/CSV đối soát lỗi cho BTC
```

### 3.1. Các dịch vụ Backend Core
1. **`CSVParserService`**:
   - Nhận file CSV Google Form, tự động nhận diện các cột: Dấu thời gian, Họ tên, MSSV, Email, Link GitHub Repo, Tên Bot.
   - Nhóm bản ghi theo `student_id`. Nếu một thí sinh nộp nhiều lần, chỉ giữ dòng nộp cuối cùng có `timestamp <= deadline`.
2. **`ParallelClonerService`**:
   - Sử dụng `concurrent.futures.ThreadPoolExecutor(max_workers=16..32)`.
   - Lệnh tải: `git clone --filter=blob:none <repo_url> storage/submissions/repos/<student_id>`.
   - Thiết lập `GIT_TERMINAL_PROMPT=0` và timeout 15s/repo để tránh treo lệnh khi gặp repo Private.
3. **`CommitFreezeService`**:
   - Chạy lệnh: `git rev-list -n 1 --before="<deadline_iso>" HEAD`.
   - Nếu commit hash tìm được khác `HEAD`, chạy: `git checkout <commit_hash>`.
   - Ghi lại thông tin: `checked_out_commit`, `commit_date`, `commit_count`.
4. **`BatchValidatorService`**:
   - Kiểm tra tệp `bot.py` và hàm `choose_move(state)`.
   - Kiểm tra tệp `REPORT.md` (không rỗng, $\ge 50$ ký tự).
   - Kiểm tra `commit_count >= 4`.
   - Quét rò rỉ API key (T09).
   - Chạy thử trong Sandbox an toàn (`execute_bot_move`) với bàn cờ mở đầu, timeout 1.0s.

---

## 4. XỬ LÝ CÁC CA BIÊN & BẢO VỆ AN TOÀN (EDGE CASES & SECURITY)

| Tình huống thực tế (Edge Case) | Cơ chế phát hiện & Xử lý kỹ thuật | Trạng thái ghi nhận |
| :--- | :--- | :--- |
| **Repo Private (403/404)** | `git clone` trả về lỗi xác thực hoặc không tìm thấy. Biến `GIT_TERMINAL_PROMPT=0` chặn nhắc mật khẩu. | `ERROR_REPO_PRIVATE`: Yêu cầu chuyển repo sang Public trong Settings của GitHub. |
| **Toàn bộ commit sau Deadline** | `git rev-list --before` không tìm thấy commit hợp lệ nào. | `ERROR_LATE_COMMIT`: Nộp muộn sau giờ chót. |
| **Lịch sử commit $< 4$** | Tổng commit hợp lệ trước deadline ít hơn 4. | `WARN_FEW_COMMITS`: Vẫn được thi đấu nhưng ghi nhận để trừ điểm thành phần tiến trình tự code. |
| **Thiếu file `bot.py` / `REPORT.md`** | File không tồn tại trong thư mục gốc của repository. | `ERROR_MISSING_FILES`: Báo rõ tên file còn thiếu. |
| **Nhập sai link (chứa `/tree/main`)** | Thí sinh copy link từ thanh địa chỉ trình duyệt. | Regex tự động chuẩn hóa về link gốc `.git`. |
| **Rò rỉ mã bí mật (T09)** | Quét regex phát hiện API key OpenAI, Google Gemini, Anthropic. | `WARN_API_KEY_LEAK`: Cảnh báo đỏ yêu cầu thí sinh revoke key ngay lập tức. |

---

## 5. THIẾT KẾ GIAO DIỆN & CỔNG TRA CỨU

### 5.1. Cổng Tra Cứu Cho Thí Sinh (`/lookup`)
- **Đường dẫn**: `/lookup` trên thanh điều hướng chính của hệ thống.
- **Tính năng**:
  - Nhập **Mã Sinh Viên (MSSV)** tra cứu tức thời.
  - Hiển thị Commit Hash được chốt để thi đấu và thời điểm commit.
  - Hiển thị tình trạng 4 tiêu chí cốt lõi bằng các badge trực quan (Xanh: Đạt, Đỏ: Lỗi, Vàng: Cảnh báo).
  - Hướng dẫn cụ thể cách sửa nếu bị lỗi repo Private hoặc thiếu file.

### 5.2. Admin Dashboard Quản Lý Pipeline
- **Thành phần mới trong Tab Google Form**:
  - Bộ chọn ngày giờ **Hạn chót nộp bài (Deadline)**.
  - Nút **"Khởi động Nhập & Thẩm Định Hàng Loạt"**.
  - Thanh tiến độ động (Live Progress Bar): `Đã xử lý: X / 2000 (Y%)`.
  - Bảng thống kê đối soát: Số lượng Hợp lệ, Repo Private, Lỗi file, Cảnh báo ít commit.
  - Nút **"Đóng gói 10 Chunks cho Cụm Máy Chấm"**: Tự động sinh `chunk_01.zip` ... `chunk_10.zip`.

---

## 6. LỘ TRÌNH TRIỂN KHAI (IMPLEMENTATION ROADMAP)

1. **Giai đoạn 1 (Backend Core)**: Xây dựng `pipeline_service.py` (khử trùng lặp CSV, clone song song, lùi commit trước deadline, batch validation).
2. **Giai đoạn 2 (Backend APIs)**: Xây dựng các route `/api/admin/pipeline/*` và `/api/submissions/lookup`.
3. **Giai đoạn 3 (Frontend UI)**: Xây dựng trang tra cứu `/lookup` cho thí sinh và nâng cấp tab Google Form trên Admin Dashboard.
4. **Giai đoạn 4 (Testing & Verification)**: Viết unit tests kiểm thử bộ lọc CSV, logic freeze commit và integration test chạy thử nghiệm với tập dữ liệu mẫu.
