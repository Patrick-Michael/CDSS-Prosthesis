# Backend – CDSS-Prosthesis

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

---

## API Endpoints

The backend exposes the following REST API endpoints:

+ `GET /api/health`  
 Health check. Returns a simple JSON message if the backend is running.  

+ `GET /api/ontology`  
 Retrieve ontology labels, templates, and rule metadata.  
 Used by the frontend to display human-readable names.  

+ `POST /api/plan`  
 Generate a treatment plan from the given case input JSON.  
  * Input: JSON object containing missing teeth, abutments, and patient conditions.  
  * Output: JSON object with span-level options, unified plans, rules triggered, and provenance.
 
 ---
 
## Development Notes

The rules engine logic is located in `rules_engine.py` and related `rules_*` files.

Ontology mappings and human-readable labels are handled in `ontology_layer.py`.

Input enrichment (abutments, patient risks) is handled by `enrichment_layer.py`.
