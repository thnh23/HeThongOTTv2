-- ==========================================================
-- FILE SQL CẬP NHẬT DỮ LIỆU OTTv2 LÊN POSTGRESQL (RENDER)
-- Hướng dẫn: Mở file này trong VS Code Extension (Database Client / PostgreSQL),
-- kết nối tới database Render và nhấn "Run All" (hoặc Ctrl+A -> Execute).
-- ==========================================================

-- 1. Đảm bảo cấu trúc các bảng đã tồn tại (CREATE TABLE IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    email VARCHAR(256) UNIQUE NOT NULL,
    hashed_password VARCHAR(256) NOT NULL,
    tier VARCHAR(10),
    test_score DOUBLE PRECISION,
    score_bot DOUBLE PRECISION DEFAULT 0.0,
    score_ai_profile DOUBLE PRECISION DEFAULT 0.0,
    score_interview DOUBLE PRECISION DEFAULT 0.0,
    score_report DOUBLE PRECISION DEFAULT 0.0,
    is_admin BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS replays (
    id VARCHAR(36) PRIMARY KEY,
    match_id VARCHAR(36) UNIQUE NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    moves_json TEXT DEFAULT '[]',
    states_json TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS submissions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',
    zip_path VARCHAR(512),
    validation_json TEXT DEFAULT '{}',
    test_run_json TEXT,
    is_active BOOLEAN DEFAULT FALSE,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. CẬP NHẬT 10 TÀI KHOẢN (9 THÍ SINH ĐỦ 3 BẢNG A, B, C + 1 TÀI KHOẢN ADMIN BTC)
INSERT INTO users (id, name, email, hashed_password, tier, test_score, score_bot, score_ai_profile, score_interview, score_report, is_admin, is_active, registered_at)
VALUES
  ('user-student-a', 'Nguyễn Văn An (K66-CACLC)', 'studentA@uet.vnu.edu.vn', '$2b$12$mdFogoPo/bsM9AGNGbVS.eTIIv8jeOjCujsg5JAwoLwY.80Ww.tLq', 'A', 35.0, 0.0, 0.0, 0.0, 0.0, FALSE, TRUE, CURRENT_TIMESTAMP),
  ('user-student-a2', 'Đỗ Minh Khang (K66-KTPM)', 'studentA2@uet.vnu.edu.vn', '$2b$12$kXVSqVvUeaEgNHX.7g8.eO0PexUEGfYE2y.4TGN0K7KsyhGQnKnbO', 'A', 28.0, 0.0, 0.0, 0.0, 0.0, FALSE, TRUE, CURRENT_TIMESTAMP),
  ('user-student-a3', 'Vũ Thị Mai (K66-CLC)', 'studentA3@uet.vnu.edu.vn', '$2b$12$KdXrnegpA6QvVzI.JWPOBeIwiGgSyoSQ/vGe4FZHmSHU.cKa2BfV6', 'A', 38.0, 0.0, 0.0, 0.0, 0.0, FALSE, TRUE, CURRENT_TIMESTAMP),
  ('user-student-b', 'Trần Thị Bình (K66-CNTT)', 'studentB@uet.vnu.edu.vn', '$2b$12$1vcVMiBBJcpy2i58BVv0uOlXlxer6FVNnFMlJVJgzQ6FfyoX2Ylq2', 'B', 58.0, 0.0, 0.0, 0.0, 0.0, FALSE, TRUE, CURRENT_TIMESTAMP),
  ('user-student-b2', 'Phạm Quốc Bảo (K66-HTTT)', 'studentB2@uet.vnu.edu.vn', '$2b$12$BOzvPLFs9ztroff6cMWsU.vq5DRjw4Pn40xC/oSXw5v3/edBxdBra', 'B', 65.0, 0.0, 0.0, 0.0, 0.0, FALSE, TRUE, CURRENT_TIMESTAMP),
  ('user-student-b3', 'Hoàng Đức Thắng (K66-KHMT)', 'studentB3@uet.vnu.edu.vn', '$2b$12$peE5hz5S/tKiGzukPlqZKegUaHmIp8sYezngnOflSrNyy5x4d3ppu', 'B', 72.0, 0.0, 0.0, 0.0, 0.0, FALSE, TRUE, CURRENT_TIMESTAMP),
  ('user-student-c', 'Lê Hoàng Cường (K65-KTPM)', 'studentC@uet.vnu.edu.vn', '$2b$12$AaVHk6XK4PR58D9/Wa2f9eaTNa2KQfJwLYUyKIt3/sR6jj7y3nLuu', 'C', 88.0, 0.0, 0.0, 0.0, 0.0, FALSE, TRUE, CURRENT_TIMESTAMP),
  ('user-student-c2', 'Ngô Quang Huy (K65-CNTT)', 'studentC2@uet.vnu.edu.vn', '$2b$12$fwZbtrMSTTpKyAe9SgMak.x0CALdPL8SJNV3W99L36.7roqqse./W', 'C', 92.0, 0.0, 0.0, 0.0, 0.0, FALSE, TRUE, CURRENT_TIMESTAMP),
  ('user-student-c3', 'Bùi Thanh Tùng (K65-ATTT)', 'studentC3@uet.vnu.edu.vn', '$2b$12$CUsHosYN3TMiBjS12cHLlu.aFjHieRwGWAsbJpq9mHVllJ5mCf7Vi', 'C', 85.0, 0.0, 0.0, 0.0, 0.0, FALSE, TRUE, CURRENT_TIMESTAMP),
  ('user-admin', 'Ban Tổ Chức Giải Đấu (Admin)', 'admin@uet.vnu.edu.vn', '$2b$12$hZCXUCTS6SBwNAiAcz9meeKKA5WrG6iNKRW7jdsS6kp1CDmFfPhSm', 'A', 100.0, 0.0, 0.0, 0.0, 0.0, TRUE, TRUE, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    hashed_password = EXCLUDED.hashed_password,
    tier = EXCLUDED.tier,
    test_score = EXCLUDED.test_score,
    is_admin = EXCLUDED.is_admin,
    is_active = EXCLUDED.is_active;

-- 3. CẬP NHẬT 3 GÓI NỘP BÀI CHUẨN (SUBMISSIONS) CHO BẢNG A, B, C
INSERT INTO submissions (id, user_id, status, zip_path, validation_json, test_run_json, is_active, submitted_at)
VALUES
  ('07593876-492b-4cc1-bd4e-59bf81204563', 'user-student-a', 'valid', 'storage/submissions/07593876-492b-4cc1-bd4e-59bf81204563/package.zip', '{"is_valid": true, "details": {"bot_py": true, "choose_move_fn": true, "prompts_md": true, "chat_history": true, "report_md": true, "git_log": false}, "errors": [], "warnings": [], "detected_api_keys": []}', '{"status": "win", "winner": "W", "end_code": "W2", "total_moves": 28, "duration_ms": 45, "reason": "Bot th\u1eed nghi\u1ec7m th\u00e0nh c\u00f4ng (Th\u1eafng b\u1eb1ng m\u00e3 W2)"}', TRUE, CURRENT_TIMESTAMP),
  ('e62f4366-862e-40ca-836f-c474102e5cf8', 'user-student-b', 'valid', 'storage/submissions/e62f4366-862e-40ca-836f-c474102e5cf8/package.zip', '{"is_valid": true, "details": {"bot_py": true, "choose_move_fn": true, "prompts_md": true, "chat_history": true, "report_md": true, "git_log": false}, "errors": [], "warnings": [], "detected_api_keys": []}', '{"status": "win", "winner": "W", "end_code": "W1", "total_moves": 34, "duration_ms": 112, "reason": "Bot th\u1eed nghi\u1ec7m th\u00e0nh c\u00f4ng (Th\u1eafng b\u1eb1ng m\u00e3 W1)"}', TRUE, CURRENT_TIMESTAMP),
  ('eb3b5f25-8dce-4d6b-9459-afd5f1953106', 'user-student-c', 'valid', 'storage/submissions/eb3b5f25-8dce-4d6b-9459-afd5f1953106/package.zip', '{"is_valid": true, "details": {"bot_py": true, "choose_move_fn": true, "prompts_md": true, "chat_history": true, "report_md": true, "git_log": true}, "errors": [], "warnings": [], "detected_api_keys": []}', '{"status": "win", "winner": "W", "end_code": "W2", "total_moves": 22, "duration_ms": 185, "reason": "Bot th\u1eed nghi\u1ec7m th\u00e0nh c\u00f4ng (Th\u1eafng b\u1eb1ng m\u00e3 W2)"}', TRUE, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    status = EXCLUDED.status,
    zip_path = EXCLUDED.zip_path,
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

-- 5. CẬP NHẬT REPLAY CHO CÁC TRẬN ĐẤU MẪU
INSERT INTO replays (id, match_id, moves_json, states_json)
VALUES
  ('replay-demo-01', 'match-demo-01', '[{"player": "W", "from": "e2", "to": "e3", "captured": null}, {"player": "B", "from": "e8", "to": "e7", "captured": null}]', '[{"board": ["psrpsrpsr", "srpsrpsrp", ".........", ".........", ".........", ".........", ".........", "PRSPRSPSR", "RSPRSPSRP"], "move_number": 0}, {"board": ["psrpsrpsr", "srpsrpsrp", ".........", ".........", ".........", ".........", "....R....", "PRSP.SPSR", "RSPRSPSRP"], "move_number": 1}]'),
  ('replay-demo-02', 'match-demo-02', '[{"player": "W", "from": "b2", "to": "b3", "captured": null}, {"player": "B", "from": "b8", "to": "b7", "captured": null}]', '[{"board": ["psrpsrpsr", "srpsrpsrp", ".........", ".........", ".........", ".........", ".........", "PRSPRSPSR", "RSPRSPSRP"], "move_number": 0}, {"board": ["psrpsrpsr", "srpsrpsrp", ".........", ".........", ".........", ".........", "....R....", "PRSP.SPSR", "RSPRSPSRP"], "move_number": 1}]'),
  ('replay-demo-03', 'match-demo-03', '[{"player": "W", "from": "f2", "to": "f3", "captured": null}, {"player": "B", "from": "f8", "to": "f7", "captured": null}]', '[{"board": ["psrpsrpsr", "srpsrpsrp", ".........", ".........", ".........", ".........", ".........", "PRSPRSPSR", "RSPRSPSRP"], "move_number": 0}, {"board": ["psrpsrpsr", "srpsrpsrp", ".........", ".........", ".........", ".........", "....R....", "PRSP.SPSR", "RSPRSPSRP"], "move_number": 1}]')
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
