# main.py
from typing import List, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import logging
from ontology_layer import get_ontology
from rules_engine import ENGINE_VERSION, RULESET_VERSION  # (already present via ontology_layer but ok to import)


# ---- Import your existing logic (same directory) ----
from span_detector import detect_spans_and_abutments
from enrichment_layer import (
    gather_abutment_teeth,
    STATUS_OPTIONS, MOBILITY_OPTIONS, CRR_OPTIONS,
    CARIES_OPTIONS, OCCLUSION_OPTIONS, PARA_OPTIONS,
    OPPOSING_OPTIONS, SYSTEMIC_OPTIONS,
)
from rules_engine import run_engine

class SpansRequest(BaseModel):
    missing: List[str] = Field(default_factory=list)

class AbutmentHealth(BaseModel):
    tooth: str
    status: str
    mobility_miller: str
    crown_root_ratio: str
    enamel_ok_for_rbb: bool

class PatientRisk(BaseModel):
    caries_risk: str
    occlusal_scheme: str
    parafunction: str
    opposing_dentition: str
    systemic_flags: List[str] = Field(default_factory=list)

class PlanRequest(BaseModel):
    missing: List[str]
    abutment_health: List[AbutmentHealth] = Field(default_factory=list)
    patient_risk: PatientRisk

app = FastAPI(title="Prostho CDSS API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

log = logging.getLogger("cdss")
logging.basicConfig(level=logging.INFO)

@app.get("/health")
def health() -> Dict[str, Any]:
    return {"ok": True}

@app.get("/enums")
def get_enums() -> Dict[str, Any]:
    return {
        "status_options": STATUS_OPTIONS,
        "mobility_options": MOBILITY_OPTIONS,
        "crr_options": CRR_OPTIONS,
        "caries_options": CARIES_OPTIONS,
        "occlusion_options": OCCLUSION_OPTIONS,
        "parafunction_options": PARA_OPTIONS,
        "opposing_options": OPPOSING_OPTIONS,
        "systemic_options": SYSTEMIC_OPTIONS,
    }

@app.post("/api/spans")
def api_spans(req: SpansRequest) -> Dict[str, Any]:
    try:
        # Use missing exactly as provided (third molars included)
        missing = [str(t) for t in req.missing]
        spans = detect_spans_and_abutments(missing)
        abuts = gather_abutment_teeth(spans)
        return {"spans": spans, "abutments": abuts}
    except Exception as e:
        log.exception("Span detection failed")
        raise HTTPException(status_code=400, detail=f"Span detection failed: {e}")

@app.post("/api/plan")
def api_plan(req: PlanRequest) -> Dict[str, Any]:
    try:
        # Include 8s; restoration rules handle any clinical exclusions
        missing = [str(t) for t in req.missing]
        spans = detect_spans_and_abutments(missing)

        abut_health = [a.model_dump() for a in req.abutment_health]
        patient_risk = req.patient_risk.model_dump()

        payload = {
            "missing": missing,
            "spans": spans,
            "patient_risk": patient_risk,
            "abutment_health": abut_health,
        }
        return run_engine(payload)
    except Exception as e:
        log.exception("Engine failed")
        raise HTTPException(status_code=400, detail=f"Engine failed: {e}")
    
@app.get("/api/ontology")
def get_ontology_api():
    return get_ontology()
