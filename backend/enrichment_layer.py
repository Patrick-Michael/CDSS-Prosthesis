# enrichment_model.py
from typing import Dict, List, Set, Any, Tuple

# --------- Options (spec-aligned) ----------
STATUS_OPTIONS = [
    ("present_sound", "Sound"),
    ("present_operated", "Heavily restored / Operated"),
    ("present_carious", "Carious"),
    ("present_implant", "Implant"),
]  # Spec TOOTH_STATUS  

MOBILITY_OPTIONS = [("0", "Mob. 0"), ("1", "Mob. 1"), ("2", "Mob. 2"), ("3", "Mob. 3")]      # B1  
CRR_OPTIONS      = [(">=1:1", "≥1:1"), ("≈1:1", "≈1:1"), ("<1:1", "<1:1")]                     # B1/B4 

CARIES_OPTIONS   = [("low","Low"), ("moderate","Moderate"), ("high","High")]                   # E3   
OCCLUSION_OPTIONS= [("Favorable","Favorable"), ("Heavy","Heavy"), ("Parafunction","Parafunction")] # G/E4 
PARA_OPTIONS     = [("none","None"), ("mild","Mild"), ("moderate","Moderate"), ("severe","Severe")] # E4   
OPPOSING_OPTIONS = [
    ("natural","Natural"),
    ("complete_denture","Complete denture"),
    ("implant_supported","Implant-supported"),
    ("mixed","Mixed"),
]  # G1/G2 

SYSTEMIC_OPTIONS = [
    ("uncontrolled_diabetes", "Uncontrolled diabetes"),
    ("recent_head_neck_radiation", "Recent head/neck radiation"),
    ("high_risk_antiresorptives", "High-risk antiresorptives"),
    ("poor_hygiene", "Poor hygiene"),
    ("smoker", "Smoker"),
    ("periodontal_disease", "Periodontal disease"),
]  # E1/E3 

# --------- Abutment collection (pure) ----------
def gather_abutment_teeth(spans: Dict[str, List[Dict]]) -> List[str]:
    """Collect unique abutment-related teeth from span detector output."""
    abuts: List[str] = []
    for _, recs in spans.items():
        for r in recs:
            a = r.get("abutments", {})
            o = r.get("outside_abutments", {})
            if a.get("mesial"): abuts.append(a["mesial"])
            if a.get("distal"): abuts.append(a["distal"])
            if o.get("left"):   abuts.append(o["left"])
            if o.get("right"):  abuts.append(o["right"])
            for p in r.get("pier_abutments", []):
                abuts.append(p)
    # de-duplicate preserve order
    seen: Set[str] = set()
    out: List[str] = []
    for t in abuts:
        if t and t not in seen:
            seen.add(t)
            out.append(t)
    return out

# --------- Key conventions (no UI) ----------
def abutment_keys(tooth: str) -> Dict[str, str]:
    """Return the Streamlit key names this tooth will use (but do not render)."""
    prefix = f"abut_{tooth}"
    return {
        "status": f"{prefix}_status",
        "mobility": f"{prefix}_mob",
        "crr": f"{prefix}_crr",
        "enamel": f"{prefix}_enamel",
    }

def risk_keys() -> Dict[str, str]:
    return {
        "caries": "risk_caries",
        "occlusion": "risk_occl",
        "parafunction": "risk_para",
        "opposing": "risk_opp",
        # systemic flags are multiple checkboxes; we’ll namespace them
        "systemic_prefix": "risk_systemic",
    }

# --------- Defaults you can use in main UI ----------
DEFAULTS = {
    "status": "present_sound",
    "mobility": "0",
    "crr": ">=1:1",
    "enamel": True,
    "caries": "low",
    "occlusion": "Favorable",
    "parafunction": "none",
    "opposing": "natural",
    "systemic": [],  # list of selected flags
}

# --------- Serialization from session_state (pure) ----------
def serialize_case_payload(
    missing: List[str],
    spans: Dict[str, List[Dict]],
    session_state: Dict[str, Any],
    abutment_teeth: List[str],
) -> Dict[str, Any]:
    """
    Read values (by keys) from Streamlit session_state to produce a case payload.
    This function is pure and UI-agnostic; it just looks up keys/namespaces.
    """
    # patient risk
    rk = risk_keys()
    systemic_selected: List[str] = []
    # collect all SYSTEMIC_OPTIONS toggles
    for val, _label in SYSTEMIC_OPTIONS:
        key = f"{rk['systemic_prefix']}_{val}"
        if session_state.get(key, False):
            systemic_selected.append(val)

    patient_risk = {
        "caries_risk": session_state.get(rk["caries"], DEFAULTS["caries"]),
        "occlusal_scheme": session_state.get(rk["occlusion"], DEFAULTS["occlusion"]),
        "parafunction": session_state.get(rk["parafunction"], DEFAULTS["parafunction"]),
        "opposing_dentition": session_state.get(rk["opposing"], DEFAULTS["opposing"]),
        "systemic_flags": systemic_selected,
    }

    # abutments
    abutment_health: List[Dict[str, Any]] = []
    for tooth in abutment_teeth:
        ak = abutment_keys(tooth)
        abutment_health.append({
            "tooth": tooth,
            "status": session_state.get(ak["status"], DEFAULTS["status"]),
            "mobility_miller": session_state.get(ak["mobility"], DEFAULTS["mobility"]),
            "crown_root_ratio": session_state.get(ak["crr"], DEFAULTS["crr"]),
            "enamel_ok_for_rbb": bool(session_state.get(ak["enamel"], DEFAULTS["enamel"])),
        })

    return {
        "missing": list(missing),
        "spans": spans,
        "patient_risk": patient_risk,
        "abutment_health": abutment_health,
    }
