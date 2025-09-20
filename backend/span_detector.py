# span_detector.py
from dataclasses import dataclass, asdict
from typing import List, Dict, Optional, Set, Tuple

# ---------------------------------------------------------------------
# Canonical FDI order (right→left for each arch, patient perspective)
#   Maxilla  : 18..11 21..28
#   Mandible : 48..41 31..38
# ---------------------------------------------------------------------
UPPER: List[str] = [str(n) for n in range(18, 10, -1)] + [str(n) for n in range(21, 29)]
LOWER: List[str] = [str(n) for n in range(48, 40, -1)] + [str(n) for n in range(31, 39)]

VALID_TEETH: Set[str] = set(UPPER + LOWER)

ARCH_INDEX: Dict[str, List[str]] = {
    "maxilla": UPPER,
    "mandible": LOWER,
}

# ---------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------
@dataclass(frozen=True)
class SpanRecord:
    span_id: str
    arch: str                                 # "maxilla" | "mandible"
    missing_teeth: List[str]                  # consecutive in arch order
    abutments: Dict[str, Optional[str]]       # {"mesial": tooth|None, "distal": tooth|None}
    outside_abutments: Dict[str, Optional[str]]  # {"left": tooth|None, "right": tooth|None} (viewer L/R)
    span_type: str                            # "BOUNDED" | "DISTAL_EXTENSION"
    cross_midline: bool                       # True if run includes both centrals
    pier_abutments: List[str]                 # 0–2 teeth adjacent to this span that are true pier teeth

# ---------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------
def detect_spans_and_abutments(missing_teeth: List[str]) -> Dict[str, List[Dict]]:
    """
    Validate input, compute spans (consecutive runs), infer abutments, classify span types,
    detect pier abutments adjacent to each span, and return:
        {"maxilla":[SpanRecord-as-dict...], "mandible":[...]}
    """
    clean_missing = _normalize_and_validate(missing_teeth)

    by_arch_missing = {
        "maxilla": sorted([t for t in clean_missing if t in UPPER], key=_order_key("maxilla")),
        "mandible": sorted([t for t in clean_missing if t in LOWER], key=_order_key("mandible")),
    }

    results: Dict[str, List[Dict]] = {"maxilla": [], "mandible": []}

    for arch in ("maxilla", "mandible"):
        arch_order = ARCH_INDEX[arch]
        missing_in_arch = by_arch_missing[arch]
        present: Set[str] = set(arch_order) - set(missing_in_arch)
        runs = _find_consecutive_runs(missing_in_arch, arch_order)

        for idx, run in enumerate(runs, start=1):
            (
                mesial_abut,
                distal_abut,
                outside_left,
                outside_right,
                cross_midline,
            ) = _infer_abutments_for_run(run, arch)

            # Keep only abutments that are actually present teeth
            mesial_abut = mesial_abut if (mesial_abut and mesial_abut in present) else None
            distal_abut = distal_abut if (distal_abut and distal_abut in present) else None
            outside_left = outside_left if (outside_left and outside_left in present) else None
            outside_right = outside_right if (outside_right and outside_right in present) else None

            span_type = _classify_span_type(
                mesial_abut, distal_abut, outside_left, outside_right, cross_midline
            )

            pier_abutments = _find_piers_touching_run(run, arch, missing_in_arch, present)

            rec = SpanRecord(
                span_id=f"{'Mx' if arch == 'maxilla' else 'Md'}-{idx}",
                arch=arch,
                missing_teeth=run,
                abutments={"mesial": mesial_abut, "distal": distal_abut},
                outside_abutments={"left": outside_left, "right": outside_right},
                span_type=span_type,
                cross_midline=cross_midline,
                pier_abutments=pier_abutments,
            )
            results[arch].append(asdict(rec))

    return results

# ---------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------
def _normalize_and_validate(missing_teeth: List[str]) -> List[str]:
    if not isinstance(missing_teeth, list):
        raise TypeError("missing_teeth must be a list of tooth codes (strings).")
    norm = [str(t).strip() for t in missing_teeth if str(t).strip()]
    seen = set()
    unique: List[str] = []
    for t in norm:
        if t not in seen:
            seen.add(t)
            unique.append(t)
    invalid = [t for t in unique if t not in VALID_TEETH]
    if invalid:
        raise ValueError(f"Invalid tooth codes: {invalid}")
    return unique

def _order_key(arch: str):
    order = ARCH_INDEX[arch]
    pos = {t: i for i, t in enumerate(order)}
    return lambda tooth: pos[tooth]

def _find_consecutive_runs(sorted_missing: List[str], arch_order: List[str]) -> List[List[str]]:
    if not sorted_missing:
        return []
    pos = {t: i for i, t in enumerate(arch_order)}
    runs: List[List[str]] = []
    current: List[str] = [sorted_missing[0]]
    for prev, curr in zip(sorted_missing, sorted_missing[1:]):
        if pos[curr] == pos[prev] + 1:
            current.append(curr)
        else:
            runs.append(current)
            current = [curr]
    runs.append(current)
    return runs

def _central_codes(arch: str) -> Tuple[str, str]:
    # c_left is the last tooth on the right side (index pivot). (11 or 41)
    return ("11", "21") if arch == "maxilla" else ("41", "31")

def _infer_abutments_for_run(
    run: List[str],
    arch: str,
) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[str], bool]:
    """
    Compute outside neighbors, then assign mesial/distal relative to midline pivot.
    Returns: (mesial, distal, outside_left, outside_right, cross_midline)
      - 'left'  = neighbor BEFORE the first missing tooth in arch order (viewer left)
      - 'right' = neighbor AFTER  the last  missing tooth in arch order (viewer right)
    If run includes BOTH centrals, mesial/distal are None (still return outside neighbors).
    """
    arch_order = ARCH_INDEX[arch]
    pos = {t: i for i, t in enumerate(arch_order)}
    first_i, last_i = pos[run[0]], pos[run[-1]]

    left_idx = first_i - 1
    right_idx = last_i + 1
    outside_right = arch_order[left_idx] if 0 <= left_idx < len(arch_order) else None
    outside_left = arch_order[right_idx] if 0 <= right_idx < len(arch_order) else None

    c_left, c_right = _central_codes(arch)
    pivot = pos[c_left]  # seam is between pivot and pivot+1
    cross_midline = (c_left in run and c_right in run)
    if cross_midline:
        return None, None, outside_left, outside_right, True

    run_indices = [pos[t] for t in run]
    entirely_right = max(run_indices) <= pivot       # Q1 (upper) / Q4 (lower)
    entirely_left  = min(run_indices) >= pivot + 1   # Q2 (upper) / Q3 (lower)

    if entirely_right:
        mesial = outside_left   # toward midline
        distal = outside_right
    elif entirely_left:
        mesial = outside_right
        distal = outside_left
    else:
        # Near-midline (touches a central but not both) — keep outward neighbors and
        # treat the one nearer the seam as mesial.
        def dist_to_seam(idx: Optional[int]) -> float:
            if idx is None:
                return float("inf")
            return abs((pivot + 0.5) - idx)

        mesial, distal = outside_left, outside_right
        if dist_to_seam(right_idx) < dist_to_seam(left_idx):
            mesial, distal = outside_right, outside_left

    return mesial, distal, outside_left, outside_right, False

def _classify_span_type(
    mesial_abut: Optional[str],
    distal_abut: Optional[str],
    outside_left: Optional[str],
    outside_right: Optional[str],
    cross_midline: bool,
) -> str:
    if mesial_abut and distal_abut:
        return "BOUNDED"
    if cross_midline and outside_left and outside_right:
        return "BOUNDED"
    return "DISTAL_EXTENSION"

def _find_piers_touching_run(
    run: List[str],
    arch: str,
    missing_in_arch: List[str],
    present_in_arch: Set[str],
) -> List[str]:
    """
    Detect pier abutments that directly 'touch' this run.
    A tooth is a pier abutment if it is present AND it has missing neighbors on BOTH sides.
    We only return those pier teeth that are immediately adjacent to this run (left or right outside neighbors).
    """
    arch_order = ARCH_INDEX[arch]
    pos = {t: i for i, t in enumerate(arch_order)}
    missing_set = set(missing_in_arch)
    piers: List[str] = []

    # candidates: the immediate outside neighbors of the run
    first_i, last_i = pos[run[0]], pos[run[-1]]
    left_idx = first_i - 1
    right_idx = last_i + 1
    candidates = []
    if 0 <= left_idx < len(arch_order):
        candidates.append(arch_order[left_idx])
    if 0 <= right_idx < len(arch_order):
        candidates.append(arch_order[right_idx])

    for tooth in candidates:
        if tooth not in present_in_arch:
            continue
        i = pos[tooth]
        q = int(tooth[0])
        # Mesial direction: +1 step for Q1/Q4, -1 for Q2/Q3 (toward midline)
        mesial_step = +1 if q in (1, 4) else -1
        distal_step = -mesial_step
        mi, di = i + mesial_step, i + distal_step
        has_mesial_gap = (0 <= mi < len(arch_order)) and (arch_order[mi] in missing_set)
        has_distal_gap = (0 <= di < len(arch_order)) and (arch_order[di] in missing_set)
        if has_mesial_gap and has_distal_gap:
            piers.append(tooth)

    # Return unique (at most two by construction)
    return list(dict.fromkeys(piers))

# ---------------------------------------------------------------------
# CLI test
# ---------------------------------------------------------------------
if __name__ == "__main__":
    tests = [
        ["16", "15", "24", "34"],                 # two bounded spans (Q1+Q2; Q3)
        ["18", "17", "16"],                       # distal extension in Q1
        ["22", "21", "11", "12"],                 # cross-midline span
        ["37", "38"],                             # distal extension in Q3
        ["11", "21", "22", "23"],                 # cross-midline extended to Q2
        ["14", "12", "11", "21", "22", "24"],     # gaps on both sides of 13 and 23 -> pier detection at edges
    ]
    for i, missing in enumerate(tests, start=1):
        print(f"\nTest {i}  missing={missing}")
        spans = detect_spans_and_abutments(missing)
        for arch, recs in spans.items():
            print(arch.upper() + ":")
            for r in recs:
                print(" ", r)
