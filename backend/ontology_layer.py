# ontology_layer.py
from datetime import datetime
from typing import Dict, Any
from rules_engine import ENGINE_VERSION, RULESET_VERSION

def get_ontology() -> Dict[str, Any]:
    """Static, human-readable labels/tooltips for families, kinds, rules, and plans."""
    return {
        "meta": {
            "version": "1.0.0",
            "updated_at": datetime.utcnow().isoformat() + "Z",
            "engine_version": ENGINE_VERSION,
            "ruleset_version": RULESET_VERSION,
            "locale": "en",
        },
        "labels": {
            "arch": {"maxilla": "Maxilla", "mandible": "Mandible"},
            "span_type": {"BOUNDED": "Bounded span", "DISTAL_EXTENSION": "Distal-extension span"},
            "families": {
                "fixed":   {"label": "Fixed Restorations", "short": "Fixed",   "description": "Tooth-supported restorations (e.g., bridges, cantilevers)."},
                "implant": {"label": "Implant Restorations", "short": "Implant","description": "Implant-supported single crowns or bridges."},
                "removable":{"label": "Removable Prosthesis", "short": "RPD",    "description": "Removable partial denture solutions."},
            },
            "kinds": {
                "fdp":            {"label": "Fixed Dental Prosthesis (Bridge)", "short": "FDP",        "description": "Bridge supported by mesial and distal abutments."},
                "rbb":            {"label": "Resin-Bonded Bridge",              "short": "RBB",        "description": "Adhesive bridge for select single anterior spans with sound enamel neighbors."},
                "cantilever":     {"label": "Cantilever FDP",                   "short": "CL",         "description": "Single-abutment anterior design in controlled occlusion."},
                "implant_single": {"label": "Single-Tooth Implant",             "short": "IMP-Single", "description": "One implant replacing a single missing tooth."},
                "implant_fdp":    {"label": "Implant-Supported Bridge",         "short": "IMP-FDP",    "description": "Multi-unit implant-supported restoration."},
                "rpd":            {"label": "Removable Partial Denture",        "short": "RPD",        "description": "Removable option; design depends on Kennedy Class."},
            },
        },
        "rules": {
            # Relative (penalties)
            "B1_CompromisedAbutment": {"short": "Abutment mobility", "label": "Abutment mobility ≥ 2", "explanation": "One or more abutments show mobility ≥ Miller Class 2, reducing prognosis.", "severity": "moderate"},
            "B4_UnfavorableCrownRoot": {"short": "Poor CRR", "label": "Crown–root ratio < 1:1", "explanation": "Abutment crown–root ratio below 1:1 lowers support.", "severity": "moderate"},
            "C2_OcclusionRisk": {"short": "Heavy occlusion", "label": "Heavy occlusal scheme", "explanation": "Heavy occlusal contacts increase mechanical load.", "severity": "mild-moderate"},
            "E3_CariesOrHygieneRisk": {"short": "Caries/hygiene risk", "label": "Caries or hygiene risk", "explanation": "Moderate/high caries risk or poor hygiene may shorten lifespan.", "severity": "moderate"},
            "E4_Parafunction": {"short": "Parafunction", "label": "Parafunction present", "explanation": "Moderate/severe parafunction (e.g., bruxism) increases stress.", "severity": "moderate-high"},
            "RPD_ComplexDesign": {"short": "Complex RPD", "label": "RPD complexity (Kennedy I/II + mods)", "explanation": "Kennedy I/II with modifications likely requires a more complex design.", "severity": "mild"},
            # Absolute (exclusions)
            "E1_ImplantContraindication": {"label": "Implant contraindicated", "explanation": "Systemic factors or patient risk prevent implant placement.", "severity": "contraindication"},
            "D1_NoPosteriorAbutment": {"label": "Posterior abutment missing", "explanation": "Required mesial/distal abutment absent for FDP.", "severity": "contraindication"},
            "C5_RBBPrereqMissing_AdjacentToothMissing": {"label": "RBB neighbor missing", "explanation": "Both adjacent teeth must be present for RBB.", "severity": "contraindication"},
            "C5_RBBPrereqMissing_EnamelNotOK": {"label": "Enamel unsuitable", "explanation": "Adjacent teeth must have intact enamel for bonding.", "severity": "contraindication"},
            "C5_RBBPrereqMissing_HeavyOcclusion": {"label": "Heavy occlusion", "explanation": "Heavy occlusion excludes RBB due to shear stress risk.", "severity": "contraindication"},
            "C5_RBBPrereqMissing_Parafunction": {"label": "Parafunction", "explanation": "Moderate/severe parafunction excludes RBB.", "severity": "contraindication"},
            "C5_RBBPrereqMissing_HighCaries": {"label": "High caries risk", "explanation": "High caries risk contraindicates RBB.", "severity": "contraindication"},
            "C4a_CL_NotAllowedPontic": {"label": "Pontic not allowed", "explanation": "Cantilever allowed only for specific anterior teeth.", "severity": "contraindication"},
            "C4a_CL_CrossMidline": {"label": "Crosses midline", "explanation": "Cantilever cannot cross the midline.", "severity": "contraindication"},
            "C4a_CL_RequiredAbutmentMissing": {"label": "Required abutment missing", "explanation": "The designated abutment tooth for this pontic is missing.", "severity": "contraindication"},
            "C4a_CL_AbutmentHealthFail": {"label": "Abutment health inadequate", "explanation": "Mobility/CRR thresholds not met for cantilever.", "severity": "contraindication"},
        },
        "options": {
            "fdp": {"label": "Fixed Dental Prosthesis (Bridge)", "short": "FDP", "description": "Bridge using adjacent abutments.", "nameTemplate": "FDP for {span_id} (length {length})"},
            "rbb": {"label": "Resin-Bonded Bridge", "short": "RBB", "description": "Adhesive bridge for selected anterior gaps.", "nameTemplate": "RBB at {pontic_tooth}"},
            "cantilever": {"label": "Cantilever FDP", "short": "CL", "description": "Single-abutment anterior FDP.", "nameTemplate": "Cantilever at {pontic_tooth} (abutment {required_abutment})"},
            "implant_single": {"label": "Single-Tooth Implant", "short": "IMP-Single", "description": "Implant replacing a single missing tooth.", "nameTemplate": "Single implant at {pontic_tooth}"},
            "implant_fdp": {"label": "Implant-Supported Bridge", "short": "IMP-FDP", "description": "Implant-supported multi-unit restoration.", "nameTemplate": "Implant FDP for {span_id} (length {length})"},
            "rpd": {"label": "Removable Partial Denture", "short": "RPD", "description": "Removable prosthesis per Kennedy Class.", "nameTemplate": "RPD for {span_id}"},
        },
        "plans": {
            "Plan_UnifiedRPD": {"label": "Unified RPD", "description": "One or more RPDs designed to restore all missing spans across the treated arch(es)."},
            "Plan_ImplantConversionThenFixed": {"label": "Implant Conversion → Fixed", "description": "Convert distal extensions with implants, then use fixed where feasible."},
            "Plan_Mixed_FDP_RPD": {"label": "Mixed Fixed + RPD", "description": "Combine fixed solutions for some spans with an RPD for remaining gaps."},
            "Plan_PierResolution_ImplantPlusFixed": {"label": "Pier Resolution (Implant + Fixed)", "description": "Use an implant near short bounded spans with piers, then fixed elsewhere."},
            "Plan_ImplantOnEligibleSingles": {"label": "Implants on Eligible Singles", "description": "Prefer implants for single-tooth spans where clinically allowed."},
            "Plan_UnifiedFDP": {"label": "Unified FDP", "description": "Conventional fixed bridges on all spans that permit FDP."},

        },
        "ui": {
            "severityTokens": {
                "info": "token-info",
                "mild": "token-mild",
                "mild-moderate": "token-mild",
                "moderate": "token-moderate",
                "moderate-high": "token-high",
                "high": "token-high",
                "contraindication": "token-critical"
            },
            "legend": {
                "score_hint": "Penalty score: fewer badges = better rank."
            }
        },
        "glossary": {
            "bounded_span": "Missing tooth/teeth with abutments on both sides.",
            "distal_extension": "Missing teeth with no distal abutment (Kennedy I/II).",
            "pier_abutment": "A lone tooth separating two bounded spans."
        },
    }
