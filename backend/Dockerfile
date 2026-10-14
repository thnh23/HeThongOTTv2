FROM python:3.12-slim

WORKDIR /app

# Cài dependencies trước để tận dụng Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Tạo thư mục storage
RUN mkdir -p ./storage

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]

