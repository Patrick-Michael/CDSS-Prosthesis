#!/usr/bin/env bash
set -euo pipefail

echo " Codespace setup started"

# Ensure Docker is ready before proceeding
i=0
until docker ps >/dev/null 2>&1; do
  i=$((i+1))
  [ $i -gt 30 ] && echo "❌ Docker not ready after 30s" && exit 1
  sleep 1
done

echo " Building images (this may take a few minutes)…"
if ! docker compose build --progress=plain; then
  echo " Docker Compose build failed."
  echo "   You can fix the code, then run:"
  echo "      docker compose build frontend --progress=plain"
else
  echo " Starting containers…"
  docker compose up -d
fi

echo " Current container status:"
docker compose ps || true

echo "✅ Setup complete! Open Ports tab:"
echo "   → http://localhost:5174 (Frontend)"
echo "   → http://localhost:8000 (API)"
