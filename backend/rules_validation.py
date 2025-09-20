# rules_validation.py
from typing import Dict, Any, List, Literal, TypedDict

# ----- enums for quick checks -----
Caries = Literal["low", "moderate", "high"]
Occlusion = Literal["Favorable", "Heavy", "Parafunction"]
Parafunction = Literal["none", "mild", "moderate", "severe"]
Opposing = Literal["natural", "complete_denture", "implant_supported", "mixed"]

class NormalizedSpan(TypedDict):
    span_id: str
    arch: Literal["maxilla", "mandible"]
    missing_teeth: List[str]
    abutments: Dict[str, str | None]
    outside_abutments: Dict[str, str | None]
    span_type: Literal["BOUNDED", "DISTAL_EXTENSION"]
    cross_midline: bool
    pier_abutments: List[str]
    # derived
    length: int
    pontic_tooth: str | None  # set when length == 1

class NormalizedPayload(TypedDict):
    missing: List[str]
    spans: Dict[str, List[NormalizedSpan]]
    patient_risk: Dict[str, Any]
    abutment_health: List[Dict[str, Any]]

VALID_CARIES = {"low", "moderate", "high"}
VALID_OCCLUSION = {"Favorable", "Heavy", "Parafunction"}
VALID_PARAFUNCTION = {"none", "mild", "moderate", "severe"}
VALID_OPPOSING = {"natural", "complete_denture", "implant_supported", "mixed"}


def _require(condition: bool, msg: str):
    if not condition:
        raise ValueError(msg)

def validate_case_payload(payload: Dict[str, Any]) -> NormalizedPayload:
    _require(isinstance(payload, dict), "Payload must be a dict")
    _require("spans" in payload and isinstance(payload["spans"], dict), "Missing 'spans' dict")
    _require("patient_risk" in payload and isinstance(payload["patient_risk"], dict), "Missing 'patient_risk'")
    _require("abutment_health" in payload and isinstance(payload["abutment_health"], list), "Missing 'abutment_health'")

    pr = payload["patient_risk"]
    _require(pr.get("caries_risk") in VALID_CARIES, "Invalid caries_risk")
    _require(pr.get("occlusal_scheme") in VALID_OCCLUSION, "Invalid occlusal_scheme")
    _require(pr.get("parafunction") in VALID_PARAFUNCTION, "Invalid parafunction")
    _require(pr.get("opposing_dentition") in VALID_OPPOSING, "Invalid opposing_dentition")

    spans_by_arch: Dict[str, List[NormalizedSpan]] = {"maxilla": [], "mandible": []}
    for arch in ("maxilla", "mandible"):
        for rec in payload["spans"].get(arch, []):
            # basic shape checks (from your SpanRecord in span_detector.py)
            _require(isinstance(rec.get("missing_teeth"), list) and rec["missing_teeth"], f"{arch}: span missing_teeth required")
            _require(rec.get("span_type") in ("BOUNDED", "DISTAL_EXTENSION"), f"{arch}: invalid span_type")
            _require(isinstance(rec.get("abutments"), dict), f"{arch}: abutments required")
            _require(isinstance(rec.get("outside_abutments"), dict), f"{arch}: outside_abutments required")
            _require(isinstance(rec.get("cross_midline"), bool), f"{arch}: cross_midline required")

            length = len(rec["missing_teeth"])
            pontic_tooth = rec["missing_teeth"][0] if length == 1 else None

            spans_by_arch[arch].append({
                "span_id": rec["span_id"],
                "arch": arch,
                "missing_teeth": rec["missing_teeth"],
                "abutments": rec["abutments"],
                "outside_abutments": rec["outside_abutments"],
                "span_type": rec["span_type"],
                "cross_midline": rec["cross_midline"],
                "pier_abutments": rec.get("pier_abutments", []),
                "length": length,
                "pontic_tooth": pontic_tooth,
            })

    return {
        "missing": list(payload.get("missing", [])),
        "spans": spans_by_arch,
        "patient_risk": pr,
        "abutment_health": payload["abutment_health"],
    }  # type: ignore[return-value]
