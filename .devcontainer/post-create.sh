#!/usr/bin/env bash
set -euo pipefail

echo " Starting Codespace setup..."

echo " Step 1/2: Building and starting containers (docker compose up --build -d)…"
docker compose up --build -d

echo " Step 2/2: Verifying services are healthy…"
# Wait briefly for healthcheck to pass; adjust if needed
sleep 3
docker compose ps

echo "✅ Setup complete. Containers are running."
echo "ℹ️  Open the Ports panel in Codespaces to access:"
echo "    - 5174 → Frontend (Vite)"
echo "    - 8000 → Backend API (FastAPI)"
