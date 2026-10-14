# OTTv2 Tournament Platform

Hệ thống tổ chức giải đấu bot **OTTv2** (Oán Thù Tương Tàn v2) cho sinh viên UET.

## Luật chơi nhanh

| Yếu tố | Chi tiết |
|--------|----------|
| Bàn cờ | 9×9 ô (cột a–i, hàng 1–9) |
| Di chuyển | 1 ô, 8 hướng (như quân Vua cờ Vua) |
| Ăn quân | Búa > Kéo > Bao > Búa; cùng loại chặn nhau |
| Thắng W1 | Ăn hết sạch 1 loại quân địch |
| Thắng W2 | Đưa quân vào ô **i9** (Trắng) hoặc **a1** (Đen) |

## Cấu trúc dự án

```
ottv2-tournament/
├── backend/            ← FastAPI + Engine OTTv2
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models/
│   │   ├── routers/
│   │   └── services/engine/   ← board.py + rules.py
│   ├── tests/          ← pytest T01–T10
│   ├── requirements.txt
│   └── Dockerfile
├── docker-compose.yml
└── rules.json          ← Luật machine-readable
```

## Khởi động nhanh

### 1. Cài đặt

```bash
cd backend
pip install -r requirements.txt
```

### 2. Cấu hình môi trường

```bash
cp .env.example .env
# Sửa SECRET_KEY trong .env
```

### 3. Chạy server

```bash
uvicorn app.main:app --reload --port 8000
```

Mở: http://localhost:8000/docs

### 4. Chạy tests

```bash
cd backend
pytest -v
```

### 5. Docker

```bash
docker-compose up --build
```

## Sprint Status

| Sprint | Nội dung | Trạng thái |
|--------|----------|-----------|
| **1** | Engine + Auth + DB | ✅ Xong |
| 2 | Sandbox + Referee + Submit API | 🔜 |
| 3 | Frontend React | 🔜 |
| 4 | Replay & Live WebSocket | 🔜 |
| 5 | Admin & Chấm điểm | 🔜 |
| 6 | Polish & Deploy | 🔜 |

## API Docs

Sau khi chạy server, truy cập:
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc
- **Health:** http://localhost:8000/health
- **Rules:** http://localhost:8000/api/rules
