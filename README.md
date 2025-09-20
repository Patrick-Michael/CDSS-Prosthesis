CDSS-Prosthesis

Decision support system for dental prosthesis planning — backend (Python) + frontend (React/Vite).
This is a work-in-progress tool and not medical-ready.

Requirements:

Python 3.10+ (3.11 recommended)

Node.js 18+ (20 recommended), npm 9+

Git (optional if you download as ZIP)



Quick start
1) Backend (API)

macOS / Linux

cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000


Windows (PowerShell)

cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000


Backend runs at http://localhost:8000

Health check: GET /health → { "ok": true }
