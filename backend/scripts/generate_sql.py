import json
import os
import sys
import subprocess

# Ensure backend root is in sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

# Auto-detect and switch to virtual environment if current interpreter lacks dependencies
venv_win = os.path.join(BASE_DIR, ".venv", "Scripts", "python.exe")
venv_unix = os.path.join(BASE_DIR, ".venv", "bin", "python")
venv_python = venv_win if os.path.exists(venv_win) else (venv_unix if os.path.exists(venv_unix) else None)

if venv_python and os.path.normcase(sys.executable) != os.path.normcase(venv_python):
    try:
        import sqlalchemy
    except ModuleNotFoundError:
        res = subprocess.run([venv_python] + sys.argv, cwd=BASE_DIR)
        sys.exit(res.returncode)

import seed_demo_data as s

def generate():
    sql = []
    sql.append('-- ==========================================================')
    sql.append('-- FILE SQL CẬP NHẬT DỮ LIỆU OTTv2 LÊN POSTGRESQL (RENDER)')
    sql.append('-- Hướng dẫn: Mở file này trong VS Code Extension (Database Client / PostgreSQL),')
    sql.append('-- kết nối tới database Render và nhấn "Run All" (hoặc Ctrl+A -> Execute).')
    sql.append('-- ==========================================================\n')

    sql.append('-- 1. Đảm bảo cấu trúc các bảng đã tồn tại (CREATE TABLE IF NOT EXISTS)')
    sql.append('''
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
''')

    sql.append('-- 2. CẬP NHẬT 10 TÀI KHOẢN (9 THÍ SINH ĐỦ 3 BẢNG A, B, C + 1 TÀI KHOẢN ADMIN BTC)')
    sql.append('INSERT INTO users (id, name, email, hashed_password, tier, test_score, score_bot, score_ai_profile, score_interview, score_report, is_admin, is_active, registered_at)')
    sql.append('VALUES')

    user_rows = []
    for u in s.users_data:
        h = s.hash_password(u['password'])
        name = u['name'].replace("'", "''")
        is_admin_str = "TRUE" if u.get("is_admin", False) else "FALSE"
        user_rows.append(
            f"  ('{u['id']}', '{name}', '{u['email']}', '{h}', '{u['tier']}', {u['test_score']}, 0.0, 0.0, 0.0, 0.0, {is_admin_str}, TRUE, CURRENT_TIMESTAMP)"
        )

    sql.append(',\n'.join(user_rows))
    sql.append('''ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    hashed_password = EXCLUDED.hashed_password,
    tier = EXCLUDED.tier,
    test_score = EXCLUDED.test_score,
    is_admin = EXCLUDED.is_admin,
    is_active = EXCLUDED.is_active;\n''')

    sql.append('-- 3. CẬP NHẬT 3 GÓI NỘP BÀI CHUẨN (SUBMISSIONS) CHO BẢNG A, B, C')
    sql.append('INSERT INTO submissions (id, user_id, status, zip_path, validation_json, test_run_json, is_active, submitted_at)')
    sql.append('VALUES')

    sub_rows = []
    for sub in s.submissions_data:
        v_json = json.dumps(sub['validation']).replace("'", "''")
        t_json = json.dumps(sub['test_run_result']).replace("'", "''")
        is_active_str = "TRUE" if sub.get('is_active', False) else "FALSE"
        sub_rows.append(
            f"  ('{sub['id']}', '{sub['user_id']}', '{sub['status']}', '{sub['zip_path']}', '{v_json}', '{t_json}', {is_active_str}, CURRENT_TIMESTAMP)"
        )

    sql.append(',\n'.join(sub_rows))
    sql.append('''ON CONFLICT (id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    status = EXCLUDED.status,
    zip_path = EXCLUDED.zip_path,
    validation_json = EXCLUDED.validation_json,
    test_run_json = EXCLUDED.test_run_json,
    is_active = EXCLUDED.is_active;\n''')

    sql.append('-- 4. CẬP NHẬT CÁC TRẬN ĐẤU MẪU (MATCHES)')
    sql.append('INSERT INTO matches (id, tier, bot_a_id, bot_b_id, status, winner, end_code, total_moves, duration_ms, created_at, played_at)')
    sql.append('VALUES')

    match_rows = []
    for m in s.matches_data:
        winner_val = f"'{m['winner']}'" if m['winner'] else "NULL"
        end_code_val = f"'{m['end_code']}'" if m['end_code'] else "NULL"
        match_rows.append(
            f"  ('{m['id']}', '{m['tier']}', '{m['bot_a_id']}', '{m['bot_b_id']}', '{m['status']}', {winner_val}, {end_code_val}, {m['total_moves']}, {m['duration_ms']}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        )

    sql.append(',\n'.join(match_rows))
    sql.append('''ON CONFLICT (id) DO UPDATE SET
    tier = EXCLUDED.tier,
    bot_a_id = EXCLUDED.bot_a_id,
    bot_b_id = EXCLUDED.bot_b_id,
    status = EXCLUDED.status,
    winner = EXCLUDED.winner,
    end_code = EXCLUDED.end_code,
    total_moves = EXCLUDED.total_moves,
    duration_ms = EXCLUDED.duration_ms;\n''')

    sql.append('-- 5. CẬP NHẬT REPLAY CHO CÁC TRẬN ĐẤU MẪU')
    sql.append('INSERT INTO replays (id, match_id, moves_json, states_json)')
    sql.append('VALUES')

    replay_rows = []
    for i, m in enumerate(s.matches_data, 1):
        m_json = json.dumps(m['moves']).replace("'", "''")
        s_json = json.dumps(m['states']).replace("'", "''")
        replay_rows.append(
            f"  ('replay-demo-0{i}', '{m['id']}', '{m_json}', '{s_json}')"
        )

    sql.append(',\n'.join(replay_rows))
    sql.append('''ON CONFLICT (match_id) DO UPDATE SET
    moves_json = EXCLUDED.moves_json,
    states_json = EXCLUDED.states_json;\n''')

    sql.append('-- 6. KIỂM TRA SỐ LƯỢNG BẢN GHI SAU KHI CẬP NHẬT')
    sql.append('''
SELECT 'users' AS table_name, count(*) AS total FROM users
UNION ALL
SELECT 'submissions', count(*) FROM submissions
UNION ALL
SELECT 'matches', count(*) FROM matches
UNION ALL
SELECT 'replays', count(*) FROM replays;
''')

    content = '\n'.join(sql)
    out_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'seed_render.sql')
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Generated {out_path} successfully ({len(content)} bytes)!")

if __name__ == '__main__':
    generate()
