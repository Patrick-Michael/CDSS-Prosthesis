#!/usr/bin/env bash
set -euo pipefail

echo " Codespace setup started"

# Build & start your stack (detached)
echo " docker compose up --build -d"
docker compose up --build -d

# Brief status
echo "🔍 docker compose ps"
docker compose ps

echo "✅ Backend (8000) and Frontend (5174) are starting. Check the Ports tab."
