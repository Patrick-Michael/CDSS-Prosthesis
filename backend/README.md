# Backend – Prostho CDSS

This folder contains the **backend service** for the Prosthodontic Clinical Decision Support System (CDSS).  
It provides a REST API used by the frontend to generate treatment plans, handle ontology labels, and manage rule evaluation.

---

## Requirements

- Python 3.10+
- pip (Python package manager)
- (Optional but recommended) [virtualenv](https://virtualenv.pypa.io/)

---

## Setup

### 1. Create and activate a virtual environment

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Linux / macOS
.\venv\Scripts\activate       # Windows PowerShell
 ```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Run the backend

```bash
uvicorn main:app --reload --port 8000
```
This will start the backend server at: http://127.0.0.1:8000
