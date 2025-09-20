# rules_cards.py
from typing import Dict, List, Any, Literal, TypedDict, Optional
from rules_scoring import OptionCard, Family, Kind, SpanType, Arch

VALID_FAMILIES: set[Family] = {"fixed", "removable", "implant"}
VALID_KINDS: set[Kind] = {"fdp", "cantilever", "rbb", "implant_single", "implant_fdp", "rpd"}
VALID_SPANTYPES: set[SpanType] = {"BOUNDED", "DISTAL_EXTENSION"}
VALID_ARCHES: set[Arch] = {"maxilla", "mandible"}

def validate_option_card(card: Dict[str, Any], span_context: Dict[str, Any]) -> OptionCard:
    """Normalize/validate a single evaluator-produced card against the SpanContext."""
    out: Dict[str, Any] = dict(card)  # shallow copy

    # Required string fields
    for field in ("option_id", "span_id"):
        val = out.get(field)
        if not isinstance(val, str) or not val.strip():
            raise ValueError(f"OptionCard missing/invalid '{field}'")

    # Enums
    fam = out.get("family")
    if fam not in VALID_FAMILIES:
        raise ValueError(f"OptionCard invalid family: {fam}")

    kind = out.get("kind")
    if kind not in VALID_KINDS:
        raise ValueError(f"OptionCard invalid kind: {kind}")

    # Span identity must match context
    out["arch"] = span_context["arch"]
    out["span_type"] = span_context["span_type"]

    # Length
    length = out.get("length", span_context.get("length"))
    if not isinstance(length, int) or length < 0:
        raise ValueError("OptionCard missing/invalid 'length'")
    out["length"] = length

    # rule_hits normalization
    rh = out.get("rule_hits") or {}
    abs_hits = rh.get("absolute") or []
    rel_hits = rh.get("relative") or []
    if not isinstance(abs_hits, list) or not all(isinstance(x, str) for x in abs_hits):
        abs_hits = []
    if not isinstance(rel_hits, list) or not all(isinstance(x, str) for x in rel_hits):
        rel_hits = []
    # de-dup relative (absolute kept as-is)
    rel_hits = list(dict.fromkeys(rel_hits))
    out["rule_hits"] = {"absolute": abs_hits, "relative": rel_hits}

    # meta dict
    meta = out.get("meta") or {}
    if not isinstance(meta, dict):
        meta = {}
    out["meta"] = meta

    # Guard: evaluators must not pre-fill rank_score
    out.pop("rank_score", None)

    return out  # type: ignore[return-value]

def prepare_cards_for_scoring(cards: List[Dict[str, Any]], span_context: Dict[str, Any]):
    """
    Validate/normalize all cards for a span and FILTER OUT absolute-hit cards.
    Returns (kept_cards, discarded_cards).
    """
    kept: List[OptionCard] = []
    discarded: List[Dict[str, Any]] = []

    for c in cards:
        oc = validate_option_card(c, span_context)
        if oc["rule_hits"]["absolute"]:
            discarded.append({
                "option_id": oc["option_id"],
                "span_id": oc["span_id"],
                "absolute": oc["rule_hits"]["absolute"],
            })
            continue
        kept.append(oc)

    return kept, discarded

