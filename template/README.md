# 🏆 OTTv2 Tournament — GitHub Template Chuẩn

Template chính thức dành cho sinh viên tham gia Giải đấu Lập trình Bot Cờ Oẳn Tù Tì v2 (OTTv2) — Môn học Lập Trình Mạng (INT3304), Khoa CNTT, Trường Đại học Công nghệ (VNU-UET).

---

## 🚀 HƯỚNG DẪN KHỞI TẠO BÀI THI (4 BƯỚC)

1. **Khởi tạo Repository:**
   - Bấm nút **Use this template** (màu xanh lá) ở góc trên bên phải.
   - Đặt tên repository theo cú pháp: `ottv2-<MaSV>` (ví dụ: `ottv2-22028100`).
   - Chọn chế độ: **Public** (Bắt buộc).

2. **Lập trình Bot:**
   - Clone repository về máy cá nhân:
     ```bash
     git clone https://github.com/<your-username>/ottv2-<MaSV>.git
     ```
   - Cài đặt thuật toán của bạn trong file `bot.py` tại hàm `choose_move(state)`.
   - Viết báo cáo giải thuật tại `REPORT.md`.

3. **Commit & Kiểm tra CI/CD:**
   - Thực hiện commit đều đặn tối thiểu 4 lần:
     ```bash
     git add .
     git commit -m "feat: implement minimax search depth 3"
     git push origin main
     ```
   - Kiểm tra tab **Actions** trên GitHub để chắc chắn toàn bộ test đều đạt màu xanh (Pass).

4. **Nộp Link Qua Google Form:**
   - Copy đường dẫn GitHub Repository của bạn và điền vào Google Form chính thức của lớp môn học trước hạn chót.
   - Tra cứu kết quả thẩm định máy chủ tại Cổng Tra Cứu chính thức: `http://<server-ip>/lookup`.

---

## ⚠️ QUY CHẾ GIẢI ĐẤU
- **Hệ thống KHÔNG tự điền bot hộ:** Mọi trường hợp repository Private, thiếu file `bot.py`, lỗi cú pháp, hoặc crash sẽ bị **xử thua trực tiếp (Forfeit T1)** 0 điểm.
- **Thời gian tính toán tối đa:** 2.0 giây cho mỗi nước đi.
- **Nghiêm cấm:** Gọi thư viện mạng (`socket`, `requests`, v.v.) hoặc sao chép mã nguồn của thí sinh khác (hệ thống sử dụng AST MOSS để kiểm tra).
