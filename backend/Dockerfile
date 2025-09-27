FROM python:3.11-slim

# System deps (sqlite + curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    sqlite3 libsqlite3-dev curl \
 && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt \

# Copy app
COPY . .

EXPOSE 8000

# Gunicorn (Uvicorn workers), no auto-reload in prod
# Adjust workers based on CPU (e.g., 2–4)
CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "main:app", "-b", "0.0.0.0:8000", "-w", "4"]
