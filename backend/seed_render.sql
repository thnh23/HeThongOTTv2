-- ==========================================================
-- FILE SQL CẬP NHẬT DỮ LIỆU OTTv2 LÊN POSTGRESQL (RENDER CLOUD)
-- Hướng dẫn thực thi:
-- 1. Mở kết nối Database Render (qua DBeaver, pgAdmin, psql hoặc VS Code Database Client).
-- 2. Dán toàn bộ nội dung file này và nhấn "Execute / Run All".
--
-- TÀI KHOẢN ĐĂNG NHẬP MẪU:
-- 1. Admin BTC:  admin@uet.vnu.edu.vn    |  Mật khẩu: admin123
-- 2. Thí sinh:   studentA@uet.vnu.edu.vn |  Mật khẩu: pass123
--                studentB@uet.vnu.edu.vn |  Mật khẩu: pass123
--                studentC@uet.vnu.edu.vn |  Mật khẩu: pass123
--                (Tất cả tài khoản thí sinh khác đều có mật khẩu: pass123)
-- ==========================================================

-- 1. ĐẢM BẢO CẤU TRÚC BẢNG ĐẦY ĐỦ (THEO CHUẨN SQLALCHEMY ORM)

-- 1.1 Bảng USERS (Đầy đủ trường Swiss 13 Vòng & Giám sát Liêm chính học thuật)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    email VARCHAR(256) UNIQUE NOT NULL,
    hashed_password VARCHAR(256) NOT NULL,
    student_id VARCHAR(32),
    class_name VARCHAR(64),
    github_repo_url VARCHAR(512),
    bot_name VARCHAR(64),
    tier VARCHAR(16) DEFAULT 'SWISS',
    test_score DOUBLE PRECISION,
    is_top32 BOOLEAN DEFAULT FALSE,
    swiss_wins INTEGER DEFAULT 0,
    swiss_points INTEGER DEFAULT 0,
    buchholz DOUBLE PRECISION DEFAULT 0.0,
    sonneborn_berger DOUBLE PRECISION DEFAULT 0.0,
    commit_count INTEGER DEFAULT 0,
    moss_similarity DOUBLE PRECISION DEFAULT 0.0,
    notes TEXT,
    score_bot DOUBLE PRECISION DEFAULT 0.0,
    score_ai_profile DOUBLE PRECISION DEFAULT 0.0,
    score_interview DOUBLE PRECISION DEFAULT 0.0,
    score_report DOUBLE PRECISION DEFAULT 0.0,
    is_admin BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tự động bổ sung cột mới nếu bảng users đã tồn tại từ trước trên PostgreSQL
ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id VARCHAR(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS class_name VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_repo_url VARCHAR(512);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bot_name VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_top32 BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS swiss_wins INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS swiss_points INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS buchholz DOUBLE PRECISION DEFAULT 0.0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sonneborn_berger DOUBLE PRECISION DEFAULT 0.0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS commit_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS moss_similarity DOUBLE PRECISION DEFAULT 0.0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS score_bot DOUBLE PRECISION DEFAULT 0.0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS score_ai_profile DOUBLE PRECISION DEFAULT 0.0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS score_interview DOUBLE PRECISION DEFAULT 0.0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS score_report DOUBLE PRECISION DEFAULT 0.0;

-- 1.2 Bảng MATCHES (Quản lý các cặp đấu)
CREATE TABLE IF NOT EXISTS matches (
    id VARCHAR(36) PRIMARY KEY,
    tier VARCHAR(10) NOT NULL,
    bot_a_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bot_b_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',
    winner VARCHAR(1),
    end_code VARCHAR(10),
    total_moves INTEGER DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    replay_path VARCHAR(512),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    played_at TIMESTAMP
);

-- 1.3 Bảng REPLAYS (Biên bản lịch sử bàn cờ 9x9 vector)
CREATE TABLE IF NOT EXISTS replays (
    id VARCHAR(36) PRIMARY KEY,
    match_id VARCHAR(36) UNIQUE NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    moves_json TEXT DEFAULT '[]',
    states_json TEXT DEFAULT '[]'
);

-- 1.4 Bảng SUBMISSIONS (Quản lý mã nguồn, Git commits & Bot v1/v2)
CREATE TABLE IF NOT EXISTS submissions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',
    zip_path VARCHAR(512),
    github_repo_url VARCHAR(512),
    bot_version VARCHAR(16) DEFAULT 'v1',
    obstacle_support BOOLEAN DEFAULT FALSE,
    commit_count INTEGER DEFAULT 0,
    moss_score DOUBLE PRECISION DEFAULT 0.0,
    validation_json TEXT DEFAULT '{}',
    test_run_json TEXT,
    is_active BOOLEAN DEFAULT FALSE,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tự động bổ sung cột mới nếu bảng submissions đã tồn tại từ trước trên PostgreSQL
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS github_repo_url VARCHAR(512);
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS bot_version VARCHAR(16) DEFAULT 'v1';
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS obstacle_support BOOLEAN DEFAULT FALSE;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS commit_count INTEGER DEFAULT 0;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS moss_score DOUBLE PRECISION DEFAULT 0.0;


-- 2. CẬP NHẬT 10 TÀI KHOẢN (ADMIN BTC + 9 THÍ SINH ĐỦ CÁC TẦNG ĐIỂM SWISS)

INSERT INTO users (
    id, name, email, hashed_password,
    student_id, class_name, github_repo_url, bot_name,
    tier, test_score, is_top32,
    swiss_wins, swiss_points, buchholz, sonneborn_berger,
    commit_count, moss_similarity, notes,
    score_bot, score_ai_profile, score_interview, score_report,
    is_admin, is_active, registered_at
)
VALUES
  -- 2.1 Tài khoản Admin BTC
  ('user-admin', 'Ban Tổ Chức Giải Đấu (Admin)', 'admin@uet.vnu.edu.vn', '$2b$12$Pi9F.pzKrhdSSzUB/91BBeLTTQWm7/d5QHrQXaOchDQvOr0840qNi',
   'BTC-ADMIN', 'Hội Đồng Chấm Thi VNU-UET', 'https://github.com/vnu-uet/ottv2-tournament', 'RefereeEngine',
   'SWISS', 100.0, FALSE, 0, 0, 0.0, 0.0, 48, 0.0, 'Tài khoản quản trị viên tối cao hệ thống',
   100.0, 100.0, 100.0, 100.0, TRUE, TRUE, CURRENT_TIMESTAMP),

  -- 2.2 Nhóm Hạt Giống Hàng Đầu (Tier C - Lọt vào Top 32, 10-12 ván thắng, đã nâng cấp Bot v2)
  ('user-student-c2', 'Ngô Quang Huy', 'studentC2@uet.vnu.edu.vn', '$2b$12$3.R7B6Lzd0xUoac03npFUuMR5YmI8JlE9ND0rVezm9oKmDjq5tdja',
   '21020088', 'QH-2021-I/CQ-CNTT', 'https://github.com/ngoquanghuy-uet/ottv2-bot', 'ShadowBlade-v2',
   'C', 92.0, TRUE, 12, 36, 128.5, 102.0, 24, 8.5, 'Top 1 Vòng bảng Swiss — Thuật toán Minimax độ sâu 6 + Alpha-Beta',
   95.0, 90.0, 95.0, 92.0, FALSE, TRUE, CURRENT_TIMESTAMP),

  ('user-student-c', 'Lê Hoàng Cường', 'studentC@uet.vnu.edu.vn', '$2b$12$bloQ1ygNSjkarIIgOZs6vO5Q/AcQZI8/nv3z2qDKAB48nzC7dxjSS',
   '21020077', 'QH-2021-I/CQ-KTPM', 'https://github.com/lehoangcuong/ottv2-minimax', 'CuongMinimax-v2',
   'C', 88.0, TRUE, 11, 33, 122.0, 95.5, 18, 12.0, 'Top 2 Vòng bảng — Heuristic kiểm soát trung tâm và né bẫy góc W2',
   92.0, 88.0, 90.0, 88.0, FALSE, TRUE, CURRENT_TIMESTAMP),

  ('user-student-c3', 'Bùi Thanh Tùng', 'studentC3@uet.vnu.edu.vn', '$2b$12$viOYDN7de9ozRC8JXMuL4eIyEh6.tyrJit4wEVqdwcY/QVmy6E/MG',
   '21020099', 'QH-2021-I/CQ-ATTT', 'https://github.com/buithanhtung/ottv2-guardian', 'TungSecurityBot',
   'C', 85.0, TRUE, 10, 30, 116.5, 88.0, 15, 10.5, 'Top 3 Vòng bảng — Chiến thuật phòng ngự phản công vững chắc',
   90.0, 85.0, 88.0, 85.0, FALSE, TRUE, CURRENT_TIMESTAMP),

  -- 2.3 Nhóm Khá Giỏi (Tier B - 7-9 ván thắng, tiệm cận Top 32)
  ('user-student-b3', 'Hoàng Đức Thắng', 'studentB3@uet.vnu.edu.vn', '$2b$12$WhMjx57Ix4maMWZRAzl6mO6oWXyTW1wS4fzINak25QbPOzkcqj3im',
   '21020066', 'QH-2022-I/CQ-KHMT', 'https://github.com/hoangducthang/ottv2-solver', 'ThangHeuristic',
   'B', 72.0, FALSE, 9, 27, 108.0, 78.5, 14, 14.0, 'Chiến thuật ăn quân chủ động, tối ưu thời gian di chuyển <50ms',
   88.0, 82.0, 85.0, 82.0, FALSE, TRUE, CURRENT_TIMESTAMP),

  ('user-student-b2', 'Phạm Quốc Bảo', 'studentB2@uet.vnu.edu.vn', '$2b$12$z9XF0SATZbWqZL86Q8X.sOZHGjOl3UW7nEoXiw6/1cFNi0hwlA/ZS',
   '21020055', 'QH-2022-I/CQ-HTTT', 'https://github.com/phamquocbao/ottv2-bot', 'BaoGreedy',
   'B', 65.0, FALSE, 8, 24, 102.5, 72.0, 11, 16.5, 'Bot Greedy mở rộng, ưu tiên bảo vệ quân Kéo',
   85.0, 80.0, 80.0, 80.0, FALSE, TRUE, CURRENT_TIMESTAMP),

  ('user-student-b', 'Trần Thị Bình', 'studentB@uet.vnu.edu.vn', '$2b$12$0Hs48tKIHaFZFrDFif9cHuwF8DVV4bVr9ZBiTpC51Dv9Ep2v1K5Cq',
   '21020044', 'QH-2022-I/CQ-CNTT', 'https://github.com/tranthibinh/ottv2-project', 'BinhBot',
   'B', 58.0, FALSE, 7, 21, 96.0, 65.0, 10, 15.0, 'Thuật toán Minimax 3 tầng kết hợp đánh giá tỷ lệ quân',
   82.0, 78.0, 78.0, 78.0, FALSE, TRUE, CURRENT_TIMESTAMP),

  -- 2.4 Nhóm Cơ Bản (Tier A - Đạt yêu cầu môn học, 4-6 ván thắng)
  ('user-student-a3', 'Vũ Thị Mai', 'studentA3@uet.vnu.edu.vn', '$2b$12$tbN7plECzJzGOm.aY8c08.xv5A/FCGb.HfvgroknIYMQ6uV4TXP2a',
   '21020033', 'QH-2022-I/CQ-CLC', 'https://github.com/vuthimai/ottv2-starter', 'MaiBot',
   'A', 38.0, FALSE, 6, 18, 88.5, 56.0, 9, 18.0, 'Hoàn thành đúng hạn, thuật toán tìm đường cơ bản',
   78.0, 75.0, 75.0, 75.0, FALSE, TRUE, CURRENT_TIMESTAMP),

  ('user-student-a', 'Nguyễn Văn An', 'studentA@uet.vnu.edu.vn', '$2b$12$B6tXcFoS5S2mqhDWtFRZPOnyOviQPr6KBStahhbfYOd2DGdU7SJ8m',
   '21020011', 'QH-2022-I/CQ-CACLC', 'https://github.com/nguyenvanan/ottv2-bot', 'AnRandomPlus',
   'A', 35.0, FALSE, 5, 15, 82.0, 48.0, 8, 19.5, 'Bot ngẫu nhiên có kiểm soát luật không lặp nước đi',
   75.0, 70.0, 72.0, 72.0, FALSE, TRUE, CURRENT_TIMESTAMP),

  ('user-student-a2', 'Đỗ Minh Khang', 'studentA2@uet.vnu.edu.vn', '$2b$12$NUIv3DihoqE6EpGwfnN7eOd.fd02YN4KlrRzXHKfSnfZGN35Sh7fe',
   '21020022', 'QH-2022-I/CQ-KTPM', 'https://github.com/dominhkhang/ottv2-code', 'KhangBot',
   'A', 28.0, FALSE, 4, 12, 76.5, 40.0, 6, 22.0, 'Hoàn thành yêu cầu cơ bản, thi đấu đủ các vòng Swiss',
   72.0, 68.0, 70.0, 70.0, FALSE, TRUE, CURRENT_TIMESTAMP)

ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    hashed_password = EXCLUDED.hashed_password,
    student_id = EXCLUDED.student_id,
    class_name = EXCLUDED.class_name,
    github_repo_url = EXCLUDED.github_repo_url,
    bot_name = EXCLUDED.bot_name,
    tier = EXCLUDED.tier,
    test_score = EXCLUDED.test_score,
    is_top32 = EXCLUDED.is_top32,
    swiss_wins = EXCLUDED.swiss_wins,
    swiss_points = EXCLUDED.swiss_points,
    buchholz = EXCLUDED.buchholz,
    sonneborn_berger = EXCLUDED.sonneborn_berger,
    commit_count = EXCLUDED.commit_count,
    moss_similarity = EXCLUDED.moss_similarity,
    notes = EXCLUDED.notes,
    score_bot = EXCLUDED.score_bot,
    score_ai_profile = EXCLUDED.score_ai_profile,
    score_interview = EXCLUDED.score_interview,
    score_report = EXCLUDED.score_report,
    is_admin = EXCLUDED.is_admin,
    is_active = EXCLUDED.is_active;


-- 3. CẬP NHẬT 11 GÓI NỘP BÀI (SUBMISSIONS: BOT V1 & BOT V2 THÍCH ỨNG Ô CẢN)

INSERT INTO submissions (
    id, user_id, status, zip_path, github_repo_url,
    bot_version, obstacle_support, commit_count, moss_score,
    validation_json, test_run_json, is_active, submitted_at
)
VALUES
  -- 3.1 Gói nộp Bot v2 (Top 32 thích ứng bản đồ ô chướng ngại vật)
  ('eb3b5f25-8dce-4d6b-9459-afd5f1953106', 'user-student-c', 'valid',
   'storage/submissions/eb3b5f25-8dce-4d6b-9459-afd5f1953106/package.zip', 'https://github.com/lehoangcuong/ottv2-minimax',
   'v2', TRUE, 18, 12.0,
   '{"is_valid": true, "details": {"bot_py": true, "choose_move_fn": true, "report_md": true, "git_log": true, "obstacle_aware": true}, "errors": [], "warnings": [], "detected_api_keys": []}',
   '{"status": "win", "winner": "W", "end_code": "W2", "total_moves": 22, "duration_ms": 145, "reason": "Bot v2 né chướng ngại vật thành công (Thắng bằng mã W2)"}',
   TRUE, CURRENT_TIMESTAMP),

  ('c2c2c2c2-8dce-4d6b-9459-afd5f1953106', 'user-student-c2', 'valid',
   'storage/submissions/c2c2c2c2-8dce-4d6b-9459-afd5f1953106/package.zip', 'https://github.com/ngoquanghuy-uet/ottv2-bot',
   'v2', TRUE, 24, 8.5,
   '{"is_valid": true, "details": {"bot_py": true, "choose_move_fn": true, "report_md": true, "git_log": true, "obstacle_aware": true}, "errors": [], "warnings": [], "detected_api_keys": []}',
   '{"status": "win", "winner": "W", "end_code": "W1", "total_moves": 26, "duration_ms": 130, "reason": "Bot v2 né chướng ngại vật thành công (Thắng bằng mã W1)"}',
   TRUE, CURRENT_TIMESTAMP),

  ('c3c3c3c3-8dce-4d6b-9459-afd5f1953106', 'user-student-c3', 'valid',
   'storage/submissions/c3c3c3c3-8dce-4d6b-9459-afd5f1953106/package.zip', 'https://github.com/buithanhtung/ottv2-guardian',
   'v2', TRUE, 15, 10.5,
   '{"is_valid": true, "details": {"bot_py": true, "choose_move_fn": true, "report_md": true, "git_log": true, "obstacle_aware": true}, "errors": [], "warnings": [], "detected_api_keys": []}',
   '{"status": "win", "winner": "W", "end_code": "W2", "total_moves": 20, "duration_ms": 86, "reason": "Bot v2 né chướng ngại vật thành công (Thắng bằng mã W2)"}',
   TRUE, CURRENT_TIMESTAMP),

  -- 3.2 Gói nộp Bot v1 chuẩn (Vòng Swiss phân hạng)
  ('07593876-492b-4cc1-bd4e-59bf81204563', 'user-student-a', 'valid',
   'storage/submissions/07593876-492b-4cc1-bd4e-59bf81204563/package.zip', 'https://github.com/nguyenvanan/ottv2-bot',
   'v1', FALSE, 8, 19.5,
   '{"is_valid": true, "details": {"bot_py": true, "choose_move_fn": true, "report_md": true, "git_log": true}, "errors": [], "warnings": [], "detected_api_keys": []}',
   '{"status": "win", "winner": "W", "end_code": "W2", "total_moves": 28, "duration_ms": 45, "reason": "Bot thử nghiệm thành công (Thắng bằng mã W2)"}',
   TRUE, CURRENT_TIMESTAMP),

  ('a2a2a2a2-492b-4cc1-bd4e-59bf81204563', 'user-student-a2', 'valid',
   'storage/submissions/a2a2a2a2-492b-4cc1-bd4e-59bf81204563/package.zip', 'https://github.com/dominhkhang/ottv2-code',
   'v1', FALSE, 6, 22.0,
   '{"is_valid": true, "details": {"bot_py": true, "choose_move_fn": true, "report_md": true, "git_log": true}, "errors": [], "warnings": [], "detected_api_keys": []}',
   '{"status": "win", "winner": "W", "end_code": "W2", "total_moves": 30, "duration_ms": 52, "reason": "Bot thử nghiệm thành công (Thắng bằng mã W2)"}',
   TRUE, CURRENT_TIMESTAMP),

  ('a3a3a3a3-492b-4cc1-bd4e-59bf81204563', 'user-student-a3', 'valid',
   'storage/submissions/a3a3a3a3-492b-4cc1-bd4e-59bf81204563/package.zip', 'https://github.com/vuthimai/ottv2-starter',
   'v1', FALSE, 9, 18.0,
   '{"is_valid": true, "details": {"bot_py": true, "choose_move_fn": true, "report_md": true, "git_log": true}, "errors": [], "warnings": [], "detected_api_keys": []}',
   '{"status": "win", "winner": "W", "end_code": "W2", "total_moves": 24, "duration_ms": 78, "reason": "Bot thử nghiệm thành công (Thắng bằng mã W2)"}',
   TRUE, CURRENT_TIMESTAMP),

  ('e62f4366-862e-40ca-836f-c474102e5cf8', 'user-student-b', 'valid',
   'storage/submissions/e62f4366-862e-40ca-836f-c474102e5cf8/package.zip', 'https://github.com/tranthibinh/ottv2-project',
   'v1', FALSE, 10, 15.0,
   '{"is_valid": true, "details": {"bot_py": true, "choose_move_fn": true, "report_md": true, "git_log": true}, "errors": [], "warnings": [], "detected_api_keys": []}',
   '{"status": "win", "winner": "W", "end_code": "W1", "total_moves": 34, "duration_ms": 112, "reason": "Bot thử nghiệm thành công (Thắng bằng mã W1)"}',
   TRUE, CURRENT_TIMESTAMP),

  ('b2b2b2b2-862e-40ca-836f-c474102e5cf8', 'user-student-b2', 'valid',
   'storage/submissions/b2b2b2b2-862e-40ca-836f-c474102e5cf8/package.zip', 'https://github.com/phamquocbao/ottv2-bot',
   'v1', FALSE, 11, 16.5,
   '{"is_valid": true, "details": {"bot_py": true, "choose_move_fn": true, "report_md": true, "git_log": true}, "errors": [], "warnings": [], "detected_api_keys": []}',
   '{"status": "win", "winner": "W", "end_code": "W1", "total_moves": 38, "duration_ms": 98, "reason": "Bot thử nghiệm thành công (Thắng bằng mã W1)"}',
   TRUE, CURRENT_TIMESTAMP),

  ('b3b3b3b3-862e-40ca-836f-c474102e5cf8', 'user-student-b3', 'valid',
   'storage/submissions/b3b3b3b3-862e-40ca-836f-c474102e5cf8/package.zip', 'https://github.com/hoangducthang/ottv2-solver',
   'v1', FALSE, 14, 14.0,
   '{"is_valid": true, "details": {"bot_py": true, "choose_move_fn": true, "report_md": true, "git_log": true}, "errors": [], "warnings": [], "detected_api_keys": []}',
   '{"status": "win", "winner": "W", "end_code": "W1", "total_moves": 30, "duration_ms": 92, "reason": "Bot thử nghiệm thành công (Thắng bằng mã W1)"}',
   TRUE, CURRENT_TIMESTAMP),

  -- 3.3 Bản nộp cũ (Test lịch sử nộp bài)
  ('sub-old-a1-initial', 'user-student-a', 'invalid',
   'storage/submissions/07593876-492b-4cc1-bd4e-59bf81204563/package.zip', 'https://github.com/nguyenvanan/ottv2-bot',
   'v1', FALSE, 2, 0.0,
   '{"is_valid": false, "details": {"bot_py": true, "choose_move_fn": false, "report_md": false, "git_log": false}, "errors": ["Thiếu hàm choose_move(state) trong bot.py"], "warnings": ["Chưa có báo cáo chiến thuật REPORT.md"], "detected_api_keys": []}',
   '{"status": "crash", "winner": null, "end_code": "T1", "total_moves": 0, "duration_ms": 10, "reason": "Lỗi khởi tạo: bot.py không định nghĩa choose_move"}',
   FALSE, CURRENT_TIMESTAMP),

  ('sub-old-b1-initial', 'user-student-b', 'valid',
   'storage/submissions/e62f4366-862e-40ca-836f-c474102e5cf8/package.zip', 'https://github.com/tranthibinh/ottv2-project',
   'v1', FALSE, 5, 15.0,
   '{"is_valid": true, "details": {"bot_py": true, "choose_move_fn": true, "report_md": true, "git_log": true}, "errors": [], "warnings": [], "detected_api_keys": []}',
   '{"status": "loss", "winner": "B", "end_code": "W1", "total_moves": 40, "duration_ms": 120, "reason": "Thua bot đối thủ mẫu sau 40 nước"}',
   FALSE, CURRENT_TIMESTAMP)

ON CONFLICT (id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    status = EXCLUDED.status,
    zip_path = EXCLUDED.zip_path,
    github_repo_url = EXCLUDED.github_repo_url,
    bot_version = EXCLUDED.bot_version,
    obstacle_support = EXCLUDED.obstacle_support,
    commit_count = EXCLUDED.commit_count,
    moss_score = EXCLUDED.moss_score,
    validation_json = EXCLUDED.validation_json,
    test_run_json = EXCLUDED.test_run_json,
    is_active = EXCLUDED.is_active;


-- 4. CẬP NHẬT CÁC TRẬN ĐẤU MẪU (MATCHES)

INSERT INTO matches (id, tier, bot_a_id, bot_b_id, status, winner, end_code, total_moves, duration_ms, created_at, played_at)
VALUES
  ('match-demo-01', 'A', 'user-student-a', 'user-student-b', 'done', 'W', 'W1', 42, 15420, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('match-demo-02', 'A', 'user-student-a', 'user-student-c', 'done', 'W', 'W2', 58, 21300, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('match-demo-03', 'A', 'user-student-b', 'user-student-c', 'done', 'W', 'W1', 36, 12800, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
    tier = EXCLUDED.tier,
    bot_a_id = EXCLUDED.bot_a_id,
    bot_b_id = EXCLUDED.bot_b_id,
    status = EXCLUDED.status,
    winner = EXCLUDED.winner,
    end_code = EXCLUDED.end_code,
    total_moves = EXCLUDED.total_moves,
    duration_ms = EXCLUDED.duration_ms;


-- 5. CẬP NHẬT REPLAY CHO CÁC TRẬN ĐẤU MẪU (BÀN CỜ 9×9 OTTv2)

INSERT INTO replays (id, match_id, moves_json, states_json)
VALUES
  ('replay-demo-01', 'match-demo-01',
   '[{"player": "W", "from": "e2", "to": "e3", "captured": null}, {"player": "B", "from": "e8", "to": "e7", "captured": null}]',
   '[{"board": ["psrpsrpsr", "srpsrpsrp", ".........", ".........", ".........", ".........", ".........", "PRSPRSPSR", "RSPRSPSRP"], "move_number": 0}, {"board": ["psrpsrpsr", "srpsrpsrp", ".........", ".........", ".........", ".........", "....R....", "PRSP.SPSR", "RSPRSPSRP"], "move_number": 1}]'),
  ('replay-demo-02', 'match-demo-02',
   '[{"player": "W", "from": "b2", "to": "b3", "captured": null}, {"player": "B", "from": "b8", "to": "b7", "captured": null}]',
   '[{"board": ["psrpsrpsr", "srpsrpsrp", ".........", ".........", ".........", ".........", ".........", "PRSPRSPSR", "RSPRSPSRP"], "move_number": 0}, {"board": ["psrpsrpsr", "srpsrpsrp", ".........", ".........", ".........", ".........", "....R....", "PRSP.SPSR", "RSPRSPSRP"], "move_number": 1}]'),
  ('replay-demo-03', 'match-demo-03',
   '[{"player": "W", "from": "f2", "to": "f3", "captured": null}, {"player": "B", "from": "f8", "to": "f7", "captured": null}]',
   '[{"board": ["psrpsrpsr", "srpsrpsrp", ".........", ".........", ".........", ".........", ".........", "PRSPRSPSR", "RSPRSPSRP"], "move_number": 0}, {"board": ["psrpsrpsr", "srpsrpsrp", ".........", ".........", ".........", ".........", "....R....", "PRSP.SPSR", "RSPRSPSRP"], "move_number": 1}]')
ON CONFLICT (match_id) DO UPDATE SET
    moves_json = EXCLUDED.moves_json,
    states_json = EXCLUDED.states_json;


-- 6. KIỂM TRA SỐ LƯỢNG BẢN GHI SAU KHI CẬP NHẬT

SELECT 'users' AS table_name, count(*) AS total FROM users
UNION ALL
SELECT 'submissions', count(*) FROM submissions
UNION ALL
SELECT 'matches', count(*) FROM matches
UNION ALL
SELECT 'replays', count(*) FROM replays;
