FROM python:3.11-slim

# System deps for sqlite + building wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    sqlite3 libsqlite3-dev build-essential curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && pip install -r requirements.txt

# Copy the backend code (Compose also mounts it for live dev)
COPY . .

EXPOSE 8000

# Force host 0.0.0.0 so Codespaces/Compose can reach it
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
