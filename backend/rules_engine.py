# rules_engine.py
from __future__ import annotations
from typing import Any, Dict, List, Tuple, Optional, Callable

# ---- Internal deps (your existing files) ----
from rules_validation import validate_case_payload
from rules_utils import build_abutment_health_map, kennedy_class_for_arch
from rules_cards import prepare_cards_for_scoring
from rules_scoring import (
    sort_options,
    RELATIVE_RULES,
    SCORING_POLICY_ID,
    OptionCard,
)
from rules_evaluators import (
    eval_fdp,
    eval_rpd,
    eval_implant_single,
    eval_implant_fdp,
    eval_rbb,
    eval_cantilever,
)

# --------------------------
# Engine / ruleset versions
# --------------------------
ENGINE_VERSION = "0.2.3"
RULESET_VERSION = "mvp-2025-09-06"

# --------------------------
# Capabilities (E1) policy
# --------------------------
def compute_implant_capabilities(patient_risk: Dict[str, Any]) -> Dict[str, Any]:
    flags = set(patient_risk.get("systemic_flags", []))
    hard_stops = {
        "uncontrolled_diabetes",
        "recent_head_neck_radiation",
        "high_risk_antiresorptives",
    }
    blocked = bool(flags & hard_stops)
    return {
        "implants_allowed": not blocked,
        "why": (["E1_ImplantContraindication"] if blocked else []),
    }

# --------------------------
# SpanContext builder
# --------------------------
def build_span_context(span: Dict[str, Any]) -> Dict[str, Any]:
    required = [
        "span_id",
        "arch",
        "span_type",
        "length",
        "missing_teeth",
        "abutments",
        "cross_midline",
        "pier_abutments",
        "pontic_tooth",
    ]
    for k in required:
        if k not in span:
            raise KeyError(f"NormalizedSpan missing '{k}'")

    return {
        "span_id": span["span_id"],
        "arch": span["arch"],
        "span_type": span["span_type"],
        "length": int(span["length"]),
        "missing_teeth": list(span["missing_teeth"]),
        "abutments": dict(span["abutments"]),
        "cross_midline": bool(span["cross_midline"]),
        "pier_abutments": list(span.get("pier_abutments", [])),
        "pontic_tooth": span.get("pontic_tooth"),
        "outside_abutments": dict(span.get("outside_abutments", {})),
    }

# --------------------------
# Case plan composition
# --------------------------
def _select_top(
    cards: List[OptionCard],
    predicate: Optional[Callable[[OptionCard], bool]] = None,
) -> Optional[OptionCard]:
    if predicate is None:
        return cards[0] if cards else None
    for c in cards:
        if predicate(c):
            return c
    return None

def compose_case_plans(
    span_options: Dict[str, List[OptionCard]],
    capabilities: Dict[str, Any],
    normalized_payload: Dict[str, Any],
) -> List[Dict[str, Any]]:
    plans: List[Dict[str, Any]] = []
    spans_linear: List[Dict[str, Any]] = normalized_payload["spans"]["maxilla"] + normalized_payload["spans"]["mandible"]
    span_map = {s["span_id"]: s for s in spans_linear}

    def plan_total_and_selected(
        chooser: Callable[[str, List[OptionCard], Dict[str, Any]], Optional[OptionCard]]
    ) -> Tuple[int, Dict[str, str], List[str]]:
        total = 0
        selected_map: Dict[str, str] = {}
        rule_ids: List[str] = []
        for sid, cards in span_options.items():
            choice = chooser(sid, cards, span_map[sid])
            if choice is None:
                return -1, {}, []
            total += int(choice.get("rank_score", 0))
            selected_map[sid] = choice["option_id"]
        return total, selected_map, rule_ids

    # --- Plan: UnifiedRPD ---
    def chooser_unified_rpd(span_id: str, cards: List[OptionCard], span: Dict[str, Any]) -> Optional[OptionCard]:
        return _select_top(cards, lambda c: c["family"] == "removable" and c["kind"] == "rpd")

    total, selected, rules = plan_total_and_selected(chooser_unified_rpd)
    if total >= 0:
        plans.append({
            "plan_id": "Plan_UnifiedRPD",
            "selected": selected,
            "total_score": total,
            "plan_rule_hits": {"absolute": [], "relative": []},
        })

        # --- Plan: UnifiedFDP ---
    def chooser_unified_fdp(span_id: str, cards: List[OptionCard], span: Dict[str, Any]) -> Optional[OptionCard]:
    # Require conventional fixed bridges on *all* spans
        return _select_top(cards, lambda c: c["family"] == "fixed" and c["kind"] == "fdp")

    total, selected, rules = plan_total_and_selected(chooser_unified_fdp)
    if total >= 0:
         plans.append({
        "plan_id": "Plan_UnifiedFDP",
        "selected": selected,
        "total_score": total,
        "plan_rule_hits": {"absolute": [], "relative": []},
         })


    # --- Plan: ImplantConversionThenFixed (DE only) ---
    has_distal_extension = any(span_map[sid]["span_type"] == "DISTAL_EXTENSION" for sid in span_options)

    def chooser_implant_conversion(span_id: str, cards: List[OptionCard], span: Dict[str, Any]) -> Optional[OptionCard]:
        if span["span_type"] == "DISTAL_EXTENSION":
            return _select_top(cards, lambda c: c["family"] == "implant")
        pick = _select_top(cards, lambda c: c["family"] == "fixed")
        if pick:
            return pick
        return _select_top(cards, lambda c: c["family"] == "implant")

    if capabilities.get("implants_allowed", False) and has_distal_extension:
        ok = True
        for sid, cards in span_options.items():
            if span_map[sid]["span_type"] == "DISTAL_EXTENSION":
                if _select_top(cards, lambda c: c["family"] == "implant") is None:
                    ok = False
                    break
        if ok:
            total, selected, rules = plan_total_and_selected(chooser_implant_conversion)
            if total >= 0:
                plans.append({
                    "plan_id": "Plan_ImplantConversionThenFixed",
                    "selected": selected,
                    "total_score": total,
                    "plan_rule_hits": {"absolute": [], "relative": []},
                })

    # --- Plan: Mixed_FDP_RPD ---
# Intention: explicitly propose an RPD + FDP combination even when implants
# are available (e.g., DE spans). We bias RPD on distal-extensions and FDP
# on bounded spans. We never select implants in this plan.
    def chooser_mixed_fdp_rpd(span_id: str, cards: List[OptionCard], span: Dict[str, Any]) -> Optional[OptionCard]:
        if span["span_type"] == "DISTAL_EXTENSION":
        # Prefer removable (RPD) for DE spans; if no RPD exists, try fixed bridge.
            pick = _select_top(cards, lambda c: c["family"] == "removable" and c.get("kind") == "rpd")
            if pick:
                return pick
            return _select_top(cards, lambda c: c["family"] == "fixed")
    # Non-DE spans: prefer fixed bridges (FDP). If none, fall back to RPD.
        pick = _select_top(cards, lambda c: c["family"] == "fixed")
        if pick:
             return pick
        return _select_top(cards, lambda c: c["family"] == "removable" and c.get("kind") == "rpd")

    total, selected, _ = plan_total_and_selected(chooser_mixed_fdp_rpd)
    if total >= 0:
        families: List[str] = []
        for sid, oid in selected.items():
            chosen = next(c for c in span_options[sid] if c["option_id"] == oid)
            families.append(chosen["family"])
    # Only emit when it is truly "Mixed RPD + FDP"
        if ("removable" in families) and ("fixed" in families):
            plans.append({
            "plan_id": "Plan_Mixed_FDP_RPD",
            "selected": selected,
            "total_score": total,
            "plan_rule_hits": {"absolute": [], "relative": []},
            })


    # --- Plan: PierResolution_ImplantPlusFixed ---
    def has_implantable_pier_short_span() -> bool:
        for sid, cards in span_options.items():
            span = span_map[sid]
            if span.get("pier_abutments") and span["span_type"] == "BOUNDED" and int(span["length"]) == 1:
                if _select_top(cards, lambda c: c["family"] == "implant") is not None:
                    return True
        return False

    def chooser_pier_resolution(span_id: str, cards: List[OptionCard], span: Dict[str, Any]) -> Optional[OptionCard]:
        is_pier = bool(span.get("pier_abutments"))
        if is_pier and span["span_type"] == "BOUNDED" and int(span["length"]) == 1:
            pick = _select_top(cards, lambda c: c["family"] == "implant")
            if pick:
                return pick
        pick = _select_top(cards, lambda c: c["family"] == "fixed")
        if pick:
            return pick
        pick = _select_top(cards, lambda c: c["family"] == "implant")
        if pick:
            return pick
        return _select_top(cards)

    has_pier = any(span_map[sid].get("pier_abutments") for sid in span_options)
    if capabilities.get("implants_allowed", False) and has_pier and has_implantable_pier_short_span():
        total, selected, rules = plan_total_and_selected(chooser_pier_resolution)
        if total >= 0:
            plans.append({
                "plan_id": "Plan_PierResolution_ImplantPlusFixed",
                "selected": selected,
                "total_score": total,
                "plan_rule_hits": {"absolute": [], "relative": []},
            })

    # --- Plan_ImplantOnEligibleSingles ---
    # Prefer implants on all single-tooth spans (length==1) where an implant option exists.
    def has_implantable_single_span() -> bool:
        if not capabilities.get("implants_allowed", False):
            return False
        for sid, cards in span_options.items():
            span = span_map[sid]
            if int(span["length"]) == 1 and _select_top(cards, lambda c: c["family"] == "implant"):
                return True
        return False

    def chooser_implant_singles(span_id: str, cards: List[OptionCard], span: Dict[str, Any]) -> Optional[OptionCard]:
        # If this span is single-tooth and an implant option exists, choose it
        if capabilities.get("implants_allowed", False) and int(span["length"]) == 1:
            pick = _select_top(cards, lambda c: c["family"] == "implant")
            if pick:
                return pick
        # Otherwise: prefer fixed; then implant; then best available (keeps plan broadly feasible)
        pick = _select_top(cards, lambda c: c["family"] == "fixed")
        if pick:
            return pick
        pick = _select_top(cards, lambda c: c["family"] == "implant")
        if pick:
            return pick
        return _select_top(cards)

    if has_implantable_single_span():
        total, selected, rules = plan_total_and_selected(chooser_implant_singles)
        if total >= 0:
            plans.append({
                "plan_id": "Plan_ImplantOnEligibleSingles",
                "selected": selected,
                "total_score": total,
                "plan_rule_hits": {"absolute": [], "relative": []},
            })

    # Sort plans by total_score, then plan_id for stability
    plans = sorted(plans, key=lambda p: (p["total_score"], p["plan_id"]))
    return plans

# --------------------------
# Public entry point
# --------------------------
def run_engine(case_payload: Dict[str, Any]) -> Dict[str, Any]:
    normalized = validate_case_payload(case_payload)
    health_map = build_abutment_health_map(normalized["abutment_health"])
    capabilities = compute_implant_capabilities(normalized["patient_risk"])

    arch_summaries: Dict[str, Dict[str, Any]] = {}
    arch_kennedy_map: Dict[str, Tuple[str, int]] = {}
    for arch in ("maxilla", "mandible"):
        arch_spans = normalized["spans"].get(arch, [])
        if arch_spans:
            klass, mods = kennedy_class_for_arch(arch_spans)
            arch_summaries[arch] = {"kennedy_class": klass, "modifications": mods}
            arch_kennedy_map[arch] = (klass, mods)

    span_options: Dict[str, List[OptionCard]] = {}
    discarded_absolute: List[Dict[str, Any]] = []

    all_spans_linear: List[Dict[str, Any]] = normalized["spans"]["maxilla"] + normalized["spans"]["mandible"]
    for span in all_spans_linear:
        ctx = build_span_context(span)

        raw_cards: List[OptionCard] = []
        raw_cards += eval_fdp(ctx, normalized["patient_risk"], capabilities, health_map)
        raw_cards += eval_rpd(ctx, normalized["patient_risk"], capabilities, arch_kennedy=arch_kennedy_map.get(ctx["arch"]))
        raw_cards += eval_implant_single(ctx, normalized["patient_risk"], capabilities)
        raw_cards += eval_implant_fdp(ctx, normalized["patient_risk"], capabilities)
        raw_cards += eval_rbb(ctx, normalized["patient_risk"], capabilities, health_map)
        raw_cards += eval_cantilever(ctx, normalized["patient_risk"], capabilities, health_map)

        kept_cards, dropped = prepare_cards_for_scoring(raw_cards, ctx)
        discarded_absolute.extend(dropped)

        ordered = sort_options(kept_cards, ctx)
        span_options[ctx["span_id"]] = ordered

    case_plans = compose_case_plans(span_options, capabilities, normalized)

    out = {
        "arch_summaries": arch_summaries,
        "span_options": span_options,
        "case_plans": case_plans,
        "provenance": {
            "engine_version": ENGINE_VERSION,
            "ruleset_version": RULESET_VERSION,
            "capabilities": capabilities,
            "discarded_absolute": discarded_absolute,
        },
        "scoring_policy": SCORING_POLICY_ID,
        "relative_rules_snapshot": sorted(list(RELATIVE_RULES)),
    }
    return out
