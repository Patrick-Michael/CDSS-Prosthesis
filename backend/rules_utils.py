# rules_utils.py
from typing import Dict, List, Set, Tuple, Optional

# ---------------------- FDI maps ----------------------
CENTRALS: Set[str] = {"11", "21", "31", "41"}
LATERALS: Set[str] = {"12", "22", "32", "42"}
CANINES:  Set[str] = {"13", "23", "33", "43"}
ANTERIOR: Set[str] = CENTRALS | LATERALS | CANINES

# ---------------------- Tooth helpers ----------------------
def arch_of_tooth(tooth: str) -> str:
    """Return 'maxilla' or 'mandible' based on FDI quadrant."""
    q = int(str(tooth)[0])
    return "maxilla" if q in (1, 2) else "mandible"

def side_of_quadrant(q: int) -> str:
    """
    Return 'R' or 'L' (patient perspective) from FDI quadrant.
      - 1 and 4 => 'R'
      - 2 and 3 => 'L'
    """
    if q in (1, 4):
        return "R"
    if q in (2, 3):
        return "L"
    raise ValueError(f"Invalid quadrant: {q}")

def side_of_tooth(tooth: str) -> str:
    """Return 'R' or 'L' for a single FDI tooth using its quadrant."""
    return side_of_quadrant(int(str(tooth)[0]))

def is_anterior(tooth: str) -> bool:
    """True for centrals, laterals, canines."""
    return str(tooth) in ANTERIOR

def paired_central(tooth: str) -> Optional[str]:
    """
    Return the other central in the SAME arch (no cross-arch).
    11<->21, 31<->41
    """
    pairs = {"11": "21", "21": "11", "31": "41", "41": "31"}
    return pairs.get(str(tooth))

def adjacent_canine_for_lateral(tooth: str) -> Optional[str]:
    """Map a lateral to its adjacent canine in the SAME arch."""
    m = {"12": "13", "22": "23", "32": "33", "42": "43"}
    return m.get(str(tooth))

# ---------------------- Abutment health ----------------------
def build_abutment_health_map(abutment_health_list: List[Dict]) -> Dict[str, Dict]:
    """
    Convert list of abutment health dicts into a lookup keyed by FDI tooth.
    Expects enrichment to have populated fields explicitly.
    Item example:
      {
        "tooth":"13",
        "status":"present_sound",
        "mobility_miller":"0" | "1" | "2" | "3",
        "crown_root_ratio":">=1:1" | "≈1:1" | "<1:1",
        "enamel_ok_for_rbb": true/false
      }
    """
    out: Dict[str, Dict] = {}
    for rec in abutment_health_list:
        t = str(rec.get("tooth") or "").strip()
        if t:
            out[t] = rec
    return out

def abutment_ok_for_cantilever(health_map: Dict[str, Dict], tooth: str) -> bool:
    """
    MVP thresholds for a cantilever abutment:
      mobility in {"0","1"}  AND  CRR in {">=1:1", "≈1:1"}.
    (No internal defaults; if data missing, returns False.)
    """
    h = health_map.get(str(tooth))
    if not h:
        return False
    mob = str(h.get("mobility_miller"))
    crr = str(h.get("crown_root_ratio"))
    return mob in ("0", "1") and crr in (">=1:1", "≈1:1")

# ---------------------- Kennedy classification ----------------------
def _sides_for_spans(spans_in_arch: List[Dict]) -> Set[str]:
    """
    Collect patient-side ('R'/'L') presence for given spans by
    inspecting all missing teeth within those spans.
    """
    sides: Set[str] = set()
    for s in spans_in_arch:
        for t in s.get("missing_teeth", []):
            if t:
                sides.add(side_of_tooth(str(t)))
    return sides

def kennedy_class_for_arch(spans_in_arch: List[Dict]) -> Tuple[str, int]:
    """
    Determine Kennedy class and modifications for a single arch.

    Assumes spans_in_arch is NON-EMPTY (callers must guard empty arches).

    Logic (MVP):
      1) If ANY DISTAL_EXTENSION spans exist:
           - If distal extensions occur on BOTH sides (R and L): Class I
           - Else (only one side): Class II
         Modifications = number of BOUNDED spans present.

      2) Else (no distal extensions):
           - If EXACTLY ONE bounded span AND it crosses the midline:
               Class IV, modifications = 0
           - Otherwise:
               Class III, modifications = max(0, count(bounded) - 1)
    """
    if not spans_in_arch:
        raise ValueError("kennedy_class_for_arch called with empty arch")

    bounded = [s for s in spans_in_arch if s.get("span_type") == "BOUNDED"]
    distal  = [s for s in spans_in_arch if s.get("span_type") == "DISTAL_EXTENSION"]

    # Distal extension cases: Class I / II
    if distal:
        distal_sides = _sides_for_spans(distal)  # uses quadrant → 'L'/'R'
        klass = "Class I" if distal_sides == {"R", "L"} else "Class II"
        mods = len(bounded)  # bounded spans act as modifications
        return klass, mods

    # No distal extension: strict Class IV or Class III with mods
    if len(bounded) == 1 and bool(bounded[0].get("cross_midline")):
        return "Class IV", 0

    mods = max(0, len(bounded) - 1)
    return "Class III", mods
