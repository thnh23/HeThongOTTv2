# BÁO CÁO THUẬT TOÁN BOT CỜ OẲN TÙ TÌ v2 (OTTV2)

**Thông tin thí sinh:**
- Họ và tên: [Nguyễn Văn A]
- Mã sinh viên: [2202xxxx]
- Lớp học phần: INT3304 [1/2/3] — Lập trình mạng
- Link GitHub Repository: `https://github.com/<username>/ottv2-<MaSV>`

---

## 1. Ý TƯỞNG CHIẾN THUẬT & GIẢI THUẬT TÌM KIẾM
*Mô tả kiến trúc thuật toán chính điều khiển bot (Minimax, Alpha-Beta Pruning, Heuristic Greedy, MCTS, v.v.):*
- Độ sâu tìm kiếm (Search Depth): [Ví dụ: 3 - 4 tầng]
- Kỹ thuật cắt tỉa (Pruning): [Mô tả cách tỉa nhánh để đảm bảo thời gian < 300ms]
- Cơ chế kiểm soát thời gian (Time Management): [Cách thức ngắt tìm kiếm nếu gần chạm ngưỡng 300ms]

---

## 2. THIẾT KẾ HÀM ĐÁNH GIÁ THẾ CỜ (HEURISTIC FUNCTION)
*Trình bày các trọng số và yếu tố đánh giá điểm số của một trạng thái bàn cờ:*
1. **Chênh lệch lực lượng quân cờ (Material balance):**
   - Số lượng Búa ($R$), Bao ($P$), Kéo ($S$) còn lại của ta so với đối thủ.
2. **Ưu thế vị trí & kiểm soát trung tâm (Positional advantage):**
   - Điểm thưởng khi chiếm lĩnh các ô trung tâm bàn cờ 9×9.
3. **Mức độ an toàn và đe dọa (Threat / Vulnerability evaluation):**
   - Đánh giá khả năng bắt quân trong nước tiếp theo và nguy cơ bị đối phương phản công.
4. **Xử lý ô chướng ngại vật (Obstacles):**
   - Chiến lược né tránh ô cấm hoặc ép quân đối phương vào góc kẹt.

---

## 3. KẾT QUẢ THỬ NGHIỆM ĐẤU TẬP
*Bảng thống kê tỷ lệ thắng/thua khi tự đấu tập với các bot mẫu:*
- Đấu với `RandomBot`: [Ví dụ: 100% thắng]
- Đấu với `GreedyBot`: [Ví dụ: 85% thắng]
- Đấu với `ObstacleBot` (trên bàn cờ có ô cản): [Ví dụ: 75% thắng]
- Độ trễ tính toán trung bình: [Ví dụ: 45ms / nước đi]
