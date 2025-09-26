FROM python:3.11-slim

# System deps for sqlite + building wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    sqlite3 libsqlite3-dev build-essential curl \
 && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install Python deps first for better layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && pip install -r requirements.txt

# Copy the backend code (Compose also mounts it for live dev)
COPY . .

EXPOSE 8000

# Dev-friendly reload. For production, drop --reload.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
