# **CDSS-Prosthesis**

Decision support system for dental prosthesis planning; backend (Python) + frontend (React/Vite).

---

## **Showcase & User Journey**
See the full [showcase](./showcase) with screenshots and workflow explanation.

---

## **Run in GitHub Codespaces**

You can try this project directly in your browser using **GitHub Codespaces** – no local setup needed.

1. Click this button to launch a Codespace on the main branch:

   [![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/Patrick-Michael/CDSS-Prosthesis?quickstart=1)

2. Wait for the Codespace to build.  
   - The development environment (Python, Node, Docker) is created automatically.  
   - Backend and frontend services are built and started inside Docker.  

3. Once setup is complete:  
   - The **frontend** will be available on forwarded port **5174** → it should open in a browser tab automatically.  
   - The **backend API** is available on forwarded port **8000**.

> First-time startup may take a few minutes. After that, resuming a Codespace is much faster since the environment is cached.


## Useful Docker Commands

After starting the Codespace and building the containers, you can manage the stack with these commands:

### Starting / Stopping (After stopping the codespace, restarting it requires this Docker command)
```bash
# Start (or restart) everything in the background
docker compose up -d

# Stop everything
docker compose down
```

**Checking Status & Logs**
```bash
# Show container status
docker compose ps

# Follow logs from all services
docker compose logs -f

# View logs from backend only
docker compose logs -f backend

# View logs from frontend only
docker compose logs -f frontend
```


---
## **Setup on your machine**

### Requirements

* Python 3.10+ (3.11 recommended)

* Node.js 18+ (20 recommended), npm 9+


## **Quick start on your machine**

### 1. Backend (API)

#### macOS / Linux

```bash
  cd backend
  python -m venv venv 
  source venv/bin/activate 
  pip install -r requirements.txt 
  uvicorn main:app --reload --port 8000
```

#### Windows 

``` powerShell
  cd backend
  python -m venv venv
  .\venv\Scripts\Activate.ps1
  pip install -r requirements.txt
  uvicorn main:app --reload --port 8000 
  ```


Backend runs at http://localhost:8000

Health check: GET /health → { "ok": true }


### 2. Frontend (UI)

#### macOS / Linux

```  bash
  cd frontend
  cp .env.example .env      # first time only
  npm install
  npm run dev 
  ```


#### Windows (PowerShell)

```  powershell
  cd frontend
  copy .env.example .env   # first time only
  npm install
  npm run dev 
  ```


*Frontend runs at the URL Vite prints (usually http://localhost:5173).*




---
**Disclaimer**: This is an educational prototype and not a medical-ready tool.  

