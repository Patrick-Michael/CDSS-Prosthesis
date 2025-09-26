#!/usr/bin/env bash
set -euo pipefail

echo " Codespace setup started"

echo " Building images (with logs)…"
docker compose build --progress=plain

echo " Starting containers (detached)…"
docker compose up -d

echo " Status:"
docker compose ps

echo "✅ Ready. Open the Ports tab (5174 = Frontend, 8000 = API)."
