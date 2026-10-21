# 🏆 ĐIỀU LỆ & KẾ HOẠCH TỔ CHỨC GIẢI ĐẤU CỜ CHIẾN THUẬT OTTV2
## Dành cho 2.000 Sinh viên — Học phần Lập Trình Mạng (Khoa CNTT, VNU-UET)

---

## 🎯 I. MỤC ĐÍCH & Ý NGHĨA GIẢI ĐẤU

1. **Khuyến khích sinh viên tự tay lập trình & rèn luyện tư duy thuật toán:** Tạo môi trường học tập thực chiến, giúp sinh viên áp dụng các kiến thức cấu trúc dữ liệu, giải thuật tìm kiếm (Minimax, Heuristic, A*) và giao thức mạng vào một bài toán cụ thể.
2. **Sân chơi học thuật công bằng, minh bạch:** Đảm bảo tất cả 2.000 sinh viên đều được cọ xát với nhiều đối thủ có trình độ tương đương, không bị loại sớm như các thể thức thông thường.
3. **Tối ưu hóa nguồn lực:** Tổ chức giải đấu quy mô lớn với **chi phí máy chủ 0 đồng**, tận dụng sức mạnh máy tính cá nhân của sinh viên và các nền tảng công nghệ sẵn có.

---

## 👥 II. QUY MÔ & ĐỐI TƯỢNG THAM GIA

* **Đối tượng:** Toàn bộ sinh viên đăng ký học phần Lập Trình Mạng (ước tính **2.000 sinh viên**).
* **Hình thức tham gia:** Cá nhân (mỗi sinh viên tự lập trình một chương trình bot tham gia thi đấu).
* **Thời gian tổ chức:** Diễn ra trong **2 ngày cuối tuần** (Thứ Bảy & Chủ Nhật).

---

## ♟️ III. THỂ THỨC THI ĐẤU: HỆ THỤY SĨ (SWISS SYSTEM) 13 VÒNG

Giải đấu áp dụng thể thức **Swiss System** (chuẩn FIDE cờ vua quốc tế), chia làm 2 giai đoạn:

```
[2.000 Thí sinh] ───► [GIAI ĐOẠN 1: 13 VÒNG SWISS] ───► [Top 32] ───► [GIAI ĐOẠN 2: CHUNG KẾT KNOCKOUT]
                      • Ngày 1: Đánh 8 vòng                     • Đổi luật: Thêm ô chướng ngại vật
                      • Ngày 2: Đánh 5 vòng                     • Thi đấu loại trực tiếp BO2 đổi phe
```

### 1. Phân bổ các vòng đấu
* **Ngày 1 (Thứ Bảy) — Vòng loại giai đoạn 1:** Thi đấu **8 vòng**.
  * Mục tiêu: Thanh lọc các bot lỗi kỹ thuật, phân tầng rõ rệt các nhóm điểm từ cao đến thấp.
* **Ngày 2 (Chủ Nhật) — Vòng loại nước rút & Vòng Chung kết:**
  * **Buổi sáng (5 vòng cuối - Vòng 9 đến 13):** Cuộc đua nước rút căng thẳng để chọn ra **32 thí sinh xuất sắc nhất (Top 32)**.
  * **Buổi chiều (Vòng Chung kết):** 32 thí sinh bước vào đấu loại trực tiếp để tranh ngôi Vô địch.

### 2. Nguyên tắc bốc thăm ghép cặp Swiss
* **Vòng 1:** Bốc thăm ghép cặp ngẫu nhiên 100% giữa 2.000 thí sinh (1.000 cặp đấu).
* **Từ Vòng 2 đến Vòng 13:**
  * **Cùng nhóm điểm gặp nhau:** Các bot có cùng điểm số (ví dụ: nhóm 3 trận thắng, nhóm 2 trận thắng) sẽ được ghép cặp đấu với nhau. Thí sinh thắng sẽ gặp đối thủ mạnh dần; thí sinh thua sẽ gặp đối thủ vừa sức hơn.
  * **Tuyệt đối không tái đấu:** Hai bot chỉ gặp nhau **tối đa một lần duy nhất** trong suốt 13 vòng.
  * **Cân bằng màu quân (Trắng / Đen):** Đảm bảo số ván cầm quân Trắng (đi trước) và quân Đen (đi sau) của mỗi thí sinh là tương đương nhau. Không thí sinh nào phải cầm một màu quân quá 2 vòng liên tiếp.

### 3. Thang điểm trận đấu & Các chỉ số phụ
* **Điểm trận:**
  * **Thắng:** Được **3 điểm**.
  * **Hòa:** Được **1 điểm**.
  * **Thua:** Được **0 điểm**.
* **Xếp hạng khi bằng điểm (Chỉ số phụ ưu tiên hàng đầu):**
  1. **Hệ số Buchholz (BH):** Tổng số điểm của toàn bộ 13 đối thủ mà thí sinh đã chạm trán (thí sinh nào có lịch thi đấu gặp nhiều đối thủ mạnh hơn sẽ được xếp trên).
  2. **Hệ số Sonneborn-Berger (SB):** Tổng điểm của các đối thủ mà mình đã đánh bại cộng với một nửa điểm của các đối thủ mà mình đã hòa (đánh giá chất lượng của các chiến thắng).
  3. **Hiệu số quân cờ:** Tổng số quân ăn được trừ đi số quân bị đối phương ăn trong suốt giải.

---

## 🔥 IV. VÒNG CHUNG KẾT TOP 32 & CƠ CHẾ ĐỔI LUẬT ĐỘT PHÁ

* **Đối tượng:** 32 thí sinh có thứ hạng cao nhất sau 13 vòng Swiss.
* **Cơ chế Đổi luật bàn cờ (Tăng độ khó):**
  * Để thử thách khả năng tư duy giải thuật nâng cao, bàn cờ 9×9 ở Vòng Chung kết sẽ xuất hiện các **ô chướng ngại vật / ô cấm đi** (các vị trí cố định trên bàn cờ mà quân cờ không thể di chuyển vào).
  * **Công bố trước 24 giờ:** Ban tổ chức sẽ công bố cấu hình ô cản trước 24 giờ (vào cuối Ngày 1).
  * **Cơ hội nâng cấp Bot v2:** Top 32 thí sinh có 24 giờ để tinh chỉnh lại thuật toán tìm đường (A*, Minimax) và nộp bản cập nhật "Bot v2" cho vòng chung kết.
* **Thể thức thi đấu:** Đấu loại trực tiếp (Knockout) theo thể thức **BO2 đổi phe** (mỗi cặp đấu 2 ván, 1 ván cầm Trắng, 1 ván cầm Đen; nếu hòa sẽ thi đấu ván phụ cờ chớp 0.5s/nước).

---

## 📥 V. QUY TRÌNH NỘP BÀI & TIẾP NHẬN BÀI THI

Để hệ thống không bị nghẽn mạng khi 2.000 sinh viên cùng nộp bài sát giờ deadline:

1. **Chuẩn bị mã nguồn:** Sinh viên tạo một repository trên tài khoản GitHub cá nhân của mình từ mẫu chuẩn do Ban tổ chức cung cấp (`uet-ottv2-template`).
2. **Kiểm tra tự động trước khi nộp:** Ngay khi sinh viên đẩy code lên GitHub, hệ thống kiểm thử tự động của GitHub sẽ lập tức kiểm tra xem bài nộp có đúng định dạng file hay không và phát hiện rò rỉ mã bí mật API Key.
3. **Nộp bài:** Sinh viên chỉ cần điền Mã Sinh Viên và đường link repository GitHub của mình vào một biểu mẫu Google Form ngắn gọn.
4. **Thu thập dữ liệu:** Ban tổ chức sử dụng công cụ tự động để tải toàn bộ 2.000 mã nguồn về máy tính điều hành trong vòng 5–10 phút mà không tốn chi phí thuê máy chủ.

---

## 💻 VI. MÔ HÌNH VẬN HÀNH MÁY CHẤM PHÂN TÁN (CHI PHÍ 0 ĐỒNG)

Thay vì phải thuê máy chủ đám mây đắt tiền, giải đấu sử dụng **Cụm máy chấm tình nguyện viên của sinh viên**:

* **Quy mô cụm máy chấm:** 10 máy tính xách tay (laptop) của các bạn sinh viên trong Ban Kỹ thuật / Trợ giảng.
* **Cách thức phân chia công việc:**
  * Mỗi vòng đấu có 1.000 trận. Ban tổ chức chia đều thành 10 gói dữ liệu (mỗi gói 100 trận đấu).
  * Mỗi máy chấm nhận 1 gói và chạy tự động. Nhờ môi trường cách ly an toàn đã được nâng cấp, máy tính của sinh viên chấm thi được bảo vệ 100% khỏi virus, mã độc hoặc treo máy.
  * **Thời gian xử lý:** Mỗi máy chỉ mất khoảng **2 – 3 phút** để chấm xong 100 trận.
  * Toàn bộ 1.000 trận của một vòng đấu hoàn thành trong vòng chưa đầy **5 phút**!

---

## 📊 VII. CÔNG BỐ KẾT QUẢ & CỔNG THÔNG TIN TRỰC TUYẾN

* **Cổng thông tin giải đấu:** Kết quả được cập nhật sau mỗi vòng đấu lên trang web tĩnh của giải đấu chạy trên nền tảng Cloudflare CDN (băng thông không giới hạn, máy chủ đặt tại Hà Nội).
* **Khả năng chịu tải:** 2.000 sinh viên có thể liên tục bấm F5 để xem điểm, tra cứu vị trí bảng xếp hạng và xem lịch thi đấu vòng sau với tốc độ tức thì (<50ms) mà **không bao giờ lo bị sập trang web**.
* **Tính năng tra cứu thông minh:** Sinh viên chỉ cần gõ Mã Sinh Viên của mình vào thanh tìm kiếm trên trang chủ để xem ngay: thứ hạng hiện tại, đối thủ vòng tiếp theo là ai, đánh ở bàn số mấy, cầm quân Trắng hay Đen.
* **Xem lại ván cờ (Replay):** Mọi ván cờ đều có thể xem lại trực quan từng nước đi trên bàn cờ vector 9×9 sắc nét.

---

## 🛡️ VIII. CHÍNH SÁCH LIÊM CHÍNH HỌC THUẬT & KIỂM SOÁT AI

Giải đấu đặt mục tiêu rèn luyện năng lực lập trình thực chất, do đó việc sử dụng AI được kiểm soát chặt chẽ qua **4 tầng bảo vệ**:

| Tầng kiểm soát | Cơ chế thực hiện | Mục đích |
| :--- | :--- | :--- |
| **1. Đề bài độc quyền** | Luật chơi OTTv2 (9×9, Búa-Kéo-Bao, ô góc `i9/a1`) là luật nội bộ của UET, không có trên mạng. | Các AI như ChatGPT/Claude không có sẵn ván cờ mẫu; sinh viên bắt buộc phải tự tay thiết kế hàm Heuristic đánh giá thế cờ. |
| **2. Bằng chứng quá trình (Git)** | Yêu cầu bài nộp phải có tối thiểu **4–5 commits** trên GitHub thể hiện các bước làm bài từng ngày. | Ngăn chặn việc sao chép prompt AI "ăn xổi" (chỉ có 1 commit duy nhất sát giờ deadline). |
| **3. Quét đạo văn cú pháp (MOSS)** | Sử dụng hệ thống MOSS của Đại học Stanford để so sánh cây cú pháp logic giữa 2.000 bài nộp. | Phát hiện các nhóm sinh viên dùng chung một câu prompt AI hoặc sao chép mã nguồn của nhau (trùng lặp $\ge 80\%$). |
| **4. Vấn đáp bảo vệ (Top 32)** | Phỏng vấn trực tiếp 5 phút đối với 32 thí sinh lọt vào vòng chung kết và các bài có nghi vấn. | Sinh viên phải trực tiếp giải thích được công thức và dòng code của mình trước Hội đồng mới được công nhận kết quả. |

---

## 🎁 IX. CƠ CHẾ QUY ĐỔI ĐIỂM HỌC PHẦN & KHEN THƯỞNG

Để tạo động lực cho sinh viên kiên trì thi đấu trọn vẹn đến tận vòng thứ 13 (không bỏ cuộc giữa chừng), điểm học phần được xây dựng theo **thang điểm tích lũy chiến thắng**:

* **Mức sàn (6.5 – 7.0 điểm môn học):** Nộp bài đúng quy cách kỹ thuật và tham gia thi đấu nghiêm túc đủ 13 vòng Swiss (không bị xử thua do bỏ cuộc).
* **Mốc 4 – 5 trận thắng:** Đạt **7.5 điểm**.
* **Mốc 6 – 7 trận thắng:** Đạt **8.0 – 8.5 điểm**.
* **Mốc 8 – 9 trận thắng:** Đạt **9.0 điểm**.
* **Mốc 10 – 11 trận thắng:** Đạt **9.5 điểm**.
* **Lọt vào Top 32 xuất sắc nhất:** Đạt **10.0 điểm tối đa học phần** + Nhận giấy khen và vinh danh trên trang tin trường Đại học Công nghệ (VNU-UET).

---

## ⏰ X. LỊCH TRÌNH TỔ CHỨC CHI TIẾT (TIMELINE)

### Ngày 1 (Thứ Bảy) — Vòng Loại Swiss (8 Vòng Đầu)
* **08:00 – 08:30:** Ban tổ chức chốt danh sách 2.000 bot nộp bài hợp lệ.
* **08:30 – 11:30:** Thi đấu **Vòng 1 đến Vòng 4** (Mỗi vòng kéo dài khoảng 30–40 phút gồm: chạy trận đấu, tính điểm và thời gian nghỉ giữa hiệp).
* **11:30 – 13:30:** Nghỉ trưa.
* **13:30 – 16:30:** Thi đấu **Vòng 5 đến Vòng 8**.
* **17:00:** Công bố bảng xếp hạng Ngày 1 và **công bố luật bàn cờ mới (ô chướng ngại vật)** cho ngày thi đấu thứ 2.

### Ngày 2 (Chủ Nhật) — Nước Rút & Vòng Chung Kết Top 32
* **08:30 – 11:30:** Thi đấu **Vòng 9 đến Vòng 13** (Chốt danh sách Top 32 lọt vào Chung kết).
* **11:30 – 13:30:** Nghỉ trưa & Top 32 nộp bản cập nhật "Bot v2" thích ứng với chướng ngại vật.
* **13:30 – 14:00:** Vấn đáp nhanh 5 phút kiểm tra năng lực Top 32.
* **14:00 – 16:30:** **Vòng Chung kết Knockout Top 32:**
  * 14:00: Vòng 1/16 (32 thí sinh $\to$ 16 thí sinh).
  * 14:45: Vòng Tứ kết (16 $\to$ 8 thí sinh).
  * 15:30: Vòng Bán kết (8 $\to$ 4 thí sinh).
  * 16:00: Trận Chung kết & Tranh hạng Ba (Trình chiếu màn hình lớn).
* **16:30 – 17:00:** Bế mạc, tổng kết điểm học phần và trao giải.
