# rules_scoring.py
from typing import Dict, List, Set, TypedDict, Literal, Any

# ---------------- Typing ----------------
Family = Literal["fixed", "removable", "implant"]
Kind = Literal["fdp", "cantilever", "rbb", "implant_single", "implant_fdp", "rpd"]
SpanType = Literal["BOUNDED", "DISTAL_EXTENSION"]
Arch = Literal["maxilla", "mandible"]

class OptionCard(TypedDict):
    option_id: str
    family: Family
    kind: Kind
    span_id: str
    arch: Arch
    span_type: SpanType
    length: int                        # units spanned/restored; 1 for single-tooth options
    rule_hits: Dict[str, List[str]]    # {"absolute": [...], "relative": [...]}
    meta: Dict[str, Any]
    # Added by scorer:
    # rank_score: int

# --------------- Policy IDs ---------------
SCORING_POLICY_ID = "MVP_relative_only_v1"

# --------------- Relative rules catalog (MVP, trimmed) ---------------
# Each recognized ID contributes +1 to rank_score when present in `rule_hits["relative"]`.
RELATIVE_RULES: Set[str] = {
    # FDP-related soft factors
    "B1_CompromisedAbutment",     # abutment mobility ≥ 2
    "B4_UnfavorableCrownRoot",    # CRR < 1:1

    # Global functional/systemic soft factors
    "C2_OcclusionRisk",           # Heavy occlusion
    "E3_CariesOrHygieneRisk",     # moderate/high caries OR poor hygiene flag
    "E4_Parafunction",            # moderate/severe parafunction

    # RPD complexity
    "RPD_ComplexDesign",          # Kennedy I/II with modifications
}

__all__ = [
    "OptionCard",
    "RELATIVE_RULES",
    "SCORING_POLICY_ID",
    "apply_relative_penalties",
    "sort_options",
]

# --------------- Core scoring ---------------
def apply_relative_penalties(rule_ids: List[str]) -> int:
    """
    Count distinct, recognized relative rule IDs (+1 each).
    Strict: requires `rule_ids` to be a list of strings; otherwise raises.
    """
    if not isinstance(rule_ids, list):
        raise TypeError("rule_ids must be a list of strings")
    uniq: Set[str] = set()
    for r in rule_ids:
        if not isinstance(r, str):
            raise TypeError("rule_ids must contain only strings")
        uniq.add(r)
    # Only count rules that are part of the centralized catalog
    return sum(1 for r in uniq if r in RELATIVE_RULES)

# --------------- Tie-breaker helpers ---------------
def _family_bias(span_type: SpanType, family: Family) -> int:
    """
    Tie-breaker bias for family when NOT distal-extension:
      fixed -> 0 (preferred), implant -> 1 (neutral), removable -> 2 (least)
    If span is distal-extension, no bias is applied (all -> 1).
    """
    if span_type == "DISTAL_EXTENSION":
        return 1
    if family == "fixed":
        return 0
    if family == "implant":
        return 1
    # family == "removable"
    return 2

def _length_key(length: int) -> int:
    """
    Shorter first. Strict: `length` must be an int >= 0.
    """
    if not isinstance(length, int):
        raise TypeError("OptionCard.length must be an int")
    if length < 0:
        raise ValueError("OptionCard.length must be >= 0")
    return length

# --------------- Public API ---------------
def sort_options(options: List[OptionCard], span_context: Dict[str, Any]) -> List[OptionCard]:
    """
    Attach `rank_score` to each card and return a NEW list sorted by:
      1) rank_score asc (lower is better)
      2) family bias: prefer fixed > removable when span_type != DISTAL_EXTENSION (implant neutral)
      3) shorter length first
      4) stable alphabetical option_id

    Strictness:
      - Requires `span_context["span_type"]` present.
      - Each OptionCard must include: option_id, family, kind, span_id, arch, span_type, length, rule_hits, meta.
      - `rule_hits["relative"]` must be a list[str]; absolute cards must be filtered upstream.
      - Raises on missing/invalid fields (fail-fast).
    """
    # Require span_type explicitly (no defaults)
    if "span_type" not in span_context:
        raise KeyError("span_context missing 'span_type'")
    st: SpanType = span_context["span_type"]  # type: ignore[assignment]

    scored: List[OptionCard] = []
    for card in options:
        # Mandatory fields check (strict)
        for field in ("option_id", "family", "kind", "span_id", "arch", "span_type", "length", "rule_hits", "meta"):
            if field not in card:
                raise KeyError(f"OptionCard missing '{field}'")
        # Ensure card span_type matches context span_type (consistency guard)
        if card["span_type"] != st:
            raise ValueError(f"OptionCard.span_type '{card['span_type']}' does not match span_context '{st}'")
        # Relative rules extraction (strict)
        rh = card["rule_hits"]
        if not isinstance(rh, dict):
            raise TypeError("OptionCard.rule_hits must be a dict")
        relative = rh.get("relative", [])
        # Absolute cards are expected to be dropped upstream; warn strictly if present
        if rh.get("absolute"):
            raise ValueError("Absolute-hit OptionCard passed to sort_options; filter absolutes upstream")
        score = apply_relative_penalties(relative)

        # Shallow copy + attach score (do not mutate input)
        c2: OptionCard = dict(card)  # type: ignore[assignment]
        c2["rank_score"] = score  # type: ignore[index]
        scored.append(c2)

    # Sorting key: score, family bias (conditional), length, option_id
    def key_fn(c: OptionCard):
        family: Family = c["family"]
        length_key = _length_key(c["length"])
        option_id = c["option_id"]
        return (
            c["rank_score"],                 # primary: fewer penalties first
            _family_bias(st, family),        # fixed > removable when not distal-extension (implant neutral)
            length_key,                      # shorter first
            option_id,                       # stable alphabetical
        )

    return sorted(scored, key=key_fn)
