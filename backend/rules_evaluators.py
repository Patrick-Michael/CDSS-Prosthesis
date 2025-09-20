# rules_evaluators.py
from typing import List, Dict, Any, Tuple, Optional
from rules_scoring import OptionCard
from rules_utils import (
    build_abutment_health_map,
    abutment_ok_for_cantilever,
    is_anterior,
)

# ---------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------

def _health_for(health_map: Dict[str, Dict[str, Any]], tooth: Optional[str]) -> Optional[Dict[str, Any]]:
    if not tooth:
        return None
    return health_map.get(str(tooth))

def _abutment_mob_ge2(health: Optional[Dict[str, Any]]) -> bool:
    if not health:
        return False
    mob = str(health.get("mobility_miller"))
    return mob in {"2", "3"}

def _abutment_crr_bad(health: Optional[Dict[str, Any]]) -> bool:
    if not health:
        return False
    crr = str(health.get("crown_root_ratio"))
    return crr == "<1:1"

def _parafunction_is_mod_or_severe(patient_risk: Dict[str, Any]) -> bool:
    pf = str(patient_risk.get("parafunction"))
    return pf in {"moderate", "severe"}

def _occlusion_is_heavy(patient_risk: Dict[str, Any]) -> bool:
    return str(patient_risk.get("occlusal_scheme")) == "Heavy"

def _caries_or_hygiene_risky(patient_risk: Dict[str, Any]) -> bool:
    # caries: moderate/high OR systemic poor_hygiene flag
    cr = str(patient_risk.get("caries_risk"))
    if cr in {"moderate", "high"}:
        return True
    sys_flags = set(patient_risk.get("systemic_flags", []))
    return "poor_hygiene" in sys_flags

def _require(ctx: Dict[str, Any], key: str):
    if key not in ctx:
        raise KeyError(f"SpanContext missing '{key}'")

def _mk_card_base(ctx: Dict[str, Any], *, option_id: str, family: str, kind: str, length: int) -> OptionCard:
    # Strict required fields for OptionCard
    for k in ("span_id", "arch", "span_type"):
        _require(ctx, k)
    if not isinstance(length, int) or length < 0:
        raise ValueError("length must be int >= 0")

    return {
        "option_id": option_id,
        "family": family,             # "fixed" | "removable" | "implant"
        "kind": kind,                 # "fdp" | "cantilever" | "rbb" | "implant_single" | "implant_fdp" | "rpd"
        "span_id": ctx["span_id"],
        "arch": ctx["arch"],
        "span_type": ctx["span_type"],
        "length": length,
        "rule_hits": {"absolute": [], "relative": []},
        "meta": {},
    }

def _abs(card: OptionCard, rule_id: str):
    card["rule_hits"]["absolute"].append(rule_id)

def _rel(card: OptionCard, rule_id: str):
    card["rule_hits"]["relative"].append(rule_id)

# Cantilever: allowed pontic→abutment pairs (single-tooth spans only)
REQUIRED_CL_ABUTMENT: Dict[str, str] = {
    # Lateral ⇐ Canine
    "12": "13", "22": "23", "32": "33", "42": "43",
    # Central ⇐ Central (paired within same arch)
    "11": "21", "21": "11", "31": "41", "41": "31",
}

# ---------------------------------------------------------------------
# Evaluators
#   Each returns a list[OptionCard] (possibly empty).
#   Absolute gates: add rule_ids to card.rule_hits.absolute (or omit the card).
#   Relative penalties: add rule_ids to card.rule_hits.relative.
# ---------------------------------------------------------------------

def eval_fdp(ctx: Dict[str, Any], patient_risk: Dict[str, Any], capabilities: Dict[str, Any],
             health_map: Dict[str, Dict[str, Any]]) -> List[OptionCard]:
    """
    FDP (conventional, requires mesial+distal abutments).
    Relative penalties (MVP):
      - B1_CompromisedAbutment (either abutment mobility ≥2)
      - B4_UnfavorableCrownRoot (either abutment CRR <1:1)
      - C2_OcclusionRisk (Heavy)
      - E3_CariesOrHygieneRisk (caries moderate/high OR poor hygiene flag)
      - E4_Parafunction (moderate/severe)
    Hard gate:
      - D1_NoPosteriorAbutment if mesial or distal abutment missing
    """
    _require(ctx, "abutments")
    mesial = ctx["abutments"].get("mesial")
    distal = ctx["abutments"].get("distal")

    card = _mk_card_base(ctx,
                         option_id=f"FIX_FDP_{ctx['span_id']}",
                         family="fixed",
                         kind="fdp",
                         length=int(ctx["length"]))
    card["meta"]["abutments"] = {"mesial": mesial, "distal": distal}

    # Hard gate: need both abutments
    if not mesial or not distal:
        _abs(card, "D1_NoPosteriorAbutment")
        return [card]

    # Relative penalties based on abutment health
    hm = _health_for(health_map, mesial)
    hd = _health_for(health_map, distal)
    if _abutment_mob_ge2(hm) or _abutment_mob_ge2(hd):
        _rel(card, "B1_CompromisedAbutment")
    if _abutment_crr_bad(hm) or _abutment_crr_bad(hd):
        _rel(card, "B4_UnfavorableCrownRoot")

    # Global functional/systemic soft factors
    if _occlusion_is_heavy(patient_risk):
        _rel(card, "C2_OcclusionRisk")
    if _caries_or_hygiene_risky(patient_risk):
        _rel(card, "E3_CariesOrHygieneRisk")
    if _parafunction_is_mod_or_severe(patient_risk):
        _rel(card, "E4_Parafunction")

    # Pier handling (design modifier) — if ctx provides it
    if ctx.get("pier_abutments"):
        # Not a penalty in MVP; record design note for downstream UI/report.
        card["meta"].setdefault("modifiers", []).append("NonRigidConnector")

    return [card]


def eval_rpd(ctx: Dict[str, Any], patient_risk: Dict[str, Any], capabilities: Dict[str, Any],
             arch_kennedy: Optional[Tuple[str, int]] = None) -> List[OptionCard]:
    """
    RPD is always available in MVP.
    Relative penalty:
      - RPD_ComplexDesign if Kennedy Class I or II AND modifications >= 1.
    The orchestrator should pass the arch-level (kennedy_class, modifications) tuple for this arch.
    """
    card = _mk_card_base(ctx,
                         option_id=f"RPD_{ctx['arch']}_{ctx['span_id']}",
                         family="removable",
                         kind="rpd",
                         length=int(ctx["length"]))

    if arch_kennedy is not None:
        klass, mods = arch_kennedy
        card["meta"]["kennedy_class"] = klass
        card["meta"]["modifications"] = int(mods)
        if klass in {"Class I", "Class II"} and mods >= 1:
            _rel(card, "RPD_ComplexDesign")
    else:
        # Still emit; meta can be filled later by the orchestrator if desired.
        card["meta"]["kennedy_class"] = None
        card["meta"]["modifications"] = None

    return [card]


def eval_implant_single(ctx: Dict[str, Any], patient_risk: Dict[str, Any], capabilities: Dict[str, Any]) -> List[OptionCard]:
    """
    Single implant (length == 1). Hard gate E1 via capabilities['implants_allowed'].
    Relative penalties:
      - C2_OcclusionRisk, E4_Parafunction, E3_CariesOrHygieneRisk
    """
    if "implants_allowed" not in capabilities:
        raise KeyError("capabilities missing 'implants_allowed'")
    if int(ctx["length"]) != 1:
        return []

    card = _mk_card_base(ctx,
                         option_id=f"IMP_SINGLE_{ctx['span_id']}_{ctx.get('pontic_tooth')}",
                         family="implant",
                         kind="implant_single",
                         length=1)
    card["meta"]["site"] = ctx.get("pontic_tooth")

    if not capabilities["implants_allowed"]:
        _abs(card, "E1_ImplantContraindication")
        return [card]

    if _occlusion_is_heavy(patient_risk):
        _rel(card, "C2_OcclusionRisk")
    if _parafunction_is_mod_or_severe(patient_risk):
        _rel(card, "E4_Parafunction")
    if _caries_or_hygiene_risky(patient_risk):
        _rel(card, "E3_CariesOrHygieneRisk")

    return [card]


def eval_implant_fdp(ctx: Dict[str, Any], patient_risk: Dict[str, Any], capabilities: Dict[str, Any]) -> List[OptionCard]:
    """
    Implant-supported FDP (length >= 2). Hard gate E1 via capabilities.
    Relative penalties:
      - C2_OcclusionRisk, E4_Parafunction, E3_CariesOrHygieneRisk
    """
    if "implants_allowed" not in capabilities:
        raise KeyError("capabilities missing 'implants_allowed'")
    if int(ctx["length"]) < 2:
        return []

    card = _mk_card_base(ctx,
                         option_id=f"IMP_FDP_{ctx['span_id']}_len{ctx['length']}",
                         family="implant",
                         kind="implant_fdp",
                         length=int(ctx["length"]))

    if not capabilities["implants_allowed"]:
        _abs(card, "E1_ImplantContraindication")
        return [card]

    if _occlusion_is_heavy(patient_risk):
        _rel(card, "C2_OcclusionRisk")
    if _parafunction_is_mod_or_severe(patient_risk):
        _rel(card, "E4_Parafunction")
    if _caries_or_hygiene_risky(patient_risk):
        _rel(card, "E3_CariesOrHygieneRisk")

    return [card]


def eval_rbb(ctx: Dict[str, Any], patient_risk: Dict[str, Any], capabilities: Dict[str, Any],
             health_map: Dict[str, Dict[str, Any]]) -> List[OptionCard]:
    """
    Resin-bonded bridge (RBB) — strict C5 gate in MVP:
      - Single tooth span (length == 1)
      - Anterior tooth only (central or lateral)
      - Both adjacent teeth present
      - Enamel OK for RBB bonding on BOTH neighbors
      - Occlusion not 'Heavy'
      - Parafunction not moderate/severe
      - Caries risk not 'high'
    Relative penalties: none (binary eligibility in MVP).
    """
    if int(ctx["length"]) != 1:
        return []

    pontic = ctx.get("pontic_tooth")
    if not pontic or not is_anterior(str(pontic)):
        return []

    # Neighbors: use mesial/distal abutments from ctx (span length 1)
    _require(ctx, "abutments")
    mesial = ctx["abutments"].get("mesial")
    distal = ctx["abutments"].get("distal")

    card = _mk_card_base(ctx,
                         option_id=f"FIX_RBB_{ctx['span_id']}_{pontic}",
                         family="fixed",
                         kind="rbb",
                         length=1)
    card["meta"]["pontic"] = pontic
    card["meta"]["abutments"] = {"mesial": mesial, "distal": distal}

    # Hard gates (C5)
    if not mesial or not distal:
        _abs(card, "C5_RBBPrereqMissing_AdjacentToothMissing")
        return [card]

    hm = _health_for(health_map, mesial)
    hd = _health_for(health_map, distal)
    if not (hm and hd and bool(hm.get("enamel_ok_for_rbb")) and bool(hd.get("enamel_ok_for_rbb"))):
        _abs(card, "C5_RBBPrereqMissing_EnamelNotOK")
        return [card]

    if _occlusion_is_heavy(patient_risk):
        _abs(card, "C5_RBBPrereqMissing_HeavyOcclusion")
        return [card]
    if _parafunction_is_mod_or_severe(patient_risk):
        _abs(card, "C5_RBBPrereqMissing_Parafunction")
        return [card]
    if str(patient_risk.get("caries_risk")) == "high":
        _abs(card, "C5_RBBPrereqMissing_HighCaries")
        return [card]

    # Eligible → no relative penalties in MVP
    return [card]


def eval_cantilever(ctx: Dict[str, Any], patient_risk: Dict[str, Any], capabilities: Dict[str, Any],
                    health_map: Dict[str, Dict[str, Any]]) -> List[OptionCard]:
    """
    Cantilever (CL) — *anterior-only* patterns allowed in MVP:
      - Lateral ⇐ Canine (12⇐13, 22⇐23, 32⇐33, 42⇐43)
      - Central ⇐ Central (11⇐21, 21⇐11, 31⇐41, 41⇐31)
    Hard gates (C4a):
      - Single tooth span
      - Allowed pontic (in REQUIRED_CL_ABUTMENT)
      - Required abutment present
      - Abutment health OK for cantilever (mob in {0,1} AND CRR in {≥1:1, ≈1:1})
      - Span not cross-midline (i.e., the gap does not include both centrals)
    Relative penalties (C4b in spirit, merged per MVP):
      - C2_OcclusionRisk if Heavy
      - E4_Parafunction if moderate/severe
    """
    if int(ctx["length"]) != 1:
        return []

    pontic = ctx.get("pontic_tooth")
    if not pontic:
        return []

    required_abut = REQUIRED_CL_ABUTMENT.get(str(pontic))
    # Build card now to attach absolute reasons if we reject
    card = _mk_card_base(ctx,
                         option_id=f"FIX_CL_{ctx['span_id']}_{pontic}",
                         family="fixed",
                         kind="cantilever",
                         length=1)
    card["meta"]["pontic"] = pontic
    card["meta"]["required_abutment"] = required_abut

    # Hard gates
    if required_abut is None:
        _abs(card, "C4a_CL_NotAllowedPontic")
        return [card]

    if bool(ctx.get("cross_midline", False)):
        _abs(card, "C4a_CL_CrossMidline")
        return [card]

    # Check presence of the required abutment tooth
    # We consider it present if it is not in the current span's missing_teeth
    # and (ideally) appears as a current tooth in arch. Span detector already
    # sets abutments for generic spans; here we require the specific tooth.
    missing_set = set(str(t) for t in ctx.get("missing_teeth", []))
    if required_abut in missing_set:
        _abs(card, "C4a_CL_RequiredAbutmentMissing")
        return [card]

    # Health check for the required abutment
    if not abutment_ok_for_cantilever(health_map, required_abut):
        _abs(card, "C4a_CL_AbutmentHealthFail")
        return [card]

    # Relative penalties (soft)
    if _occlusion_is_heavy(patient_risk):
        _rel(card, "C2_OcclusionRisk")
    if _parafunction_is_mod_or_severe(patient_risk):
        _rel(card, "E4_Parafunction")

    # Eligible
    card["meta"]["abutment"] = required_abut
    return [card]
