// src/api.ts

// -----------------------------
// Types shared across the app
// -----------------------------

// Enums coming from /enums (see backend main.py -> get_enums)
export type EnumsResponse = {
  status_options: [string, string][];
  mobility_options: [string, string][];
  crr_options: [string, string][];
  caries_options: [string, string][];
  occlusion_options: [string, string][];
  parafunction_options: [string, string][];
  opposing_options: [string, string][];
  systemic_options: [string, string][];
};

// Span record shape (from span_detector.py)
export type SpanRecord = {
  span_id: string;
  arch: "maxilla" | "mandible";
  missing_teeth: string[]; // consecutive
  abutments: { mesial: string | null; distal: string | null };
  outside_abutments: { left: string | null; right: string | null };
  span_type: "BOUNDED" | "DISTAL_EXTENSION";
  cross_midline: boolean;
  pier_abutments: string[];
  // derived on the engine side (not required here): length, pontic_tooth
};

// /api/spans response
export type SpansResponse = {
  spans: {
    maxilla: SpanRecord[];
    mandible: SpanRecord[];
  };
  abutments: string[]; // unique list of abutment-related teeth
};

// Plan API types (match backend main.py PlanRequest + rules_engine output)
export type PlanRequest = {
  missing: string[];
  abutment_health: Array<{
    tooth: string;
    status: string;
    mobility_miller: string;         // "0" | "1" | "2" | "3"
    crown_root_ratio: string;        // ">=1:1" | "≈1:1" | "<1:1"
    enamel_ok_for_rbb: boolean;
  }>;
  patient_risk: {
    caries_risk: string;             // "low" | "moderate" | "high"
    occlusal_scheme: string;         // "Favorable" | "Heavy" | "Parafunction"
    parafunction: string;            // "none" | "mild" | "moderate" | "severe"
    opposing_dentition: string;      // "natural" | "complete_denture" | "implant_supported" | "mixed"
    systemic_flags: string[];
  };
};

export type OptionCard = {
  option_id: string;
  family: "fixed" | "removable" | "implant";
  kind: "fdp" | "cantilever" | "rbb" | "implant_single" | "implant_fdp" | "rpd";
  span_id: string;
  arch: "maxilla" | "mandible";
  span_type: "BOUNDED" | "DISTAL_EXTENSION";
  length: number;
  rule_hits: { absolute: string[]; relative: string[] };
  meta: Record<string, any>;
  rank_score?: number; // added by scorer
};

export type PlanResponse = {
  arch_summaries: Record<string, { kennedy_class: string; modifications: number }>;
  span_options: Record<string, OptionCard[]>;
  case_plans: Array<{
    plan_id: string;
    selected: Record<string, string>; // span_id -> option_id
    total_score: number;
    plan_rule_hits: { absolute: string[]; relative: string[] };
  }>;
  provenance: any;
  scoring_policy: string;
  relative_rules_snapshot: string[];
};

// Ontology type (from ontology_layer.py get_ontology)
export type Ontology = {
  meta: { version: string; locale: string; engine_version: string; ruleset_version: string };
  labels: {
    arch: Record<"maxilla" | "mandible", string>;
    span_type: Record<"BOUNDED" | "DISTAL_EXTENSION", string>;
    families: Record<string, { label: string; short: string; description: string }>;
    kinds: Record<string, { label: string; short: string; description: string }>;
  };
  rules: Record<string, { short?: string; label: string; explanation: string; severity: string }>;
  options: Record<string, { label: string; short: string; description: string; nameTemplate: string }>;
  plans: Record<string, { label: string; description: string }>;
  ui?: {
    severityTokens?: Record<string, string>;
    legend?: { score_hint?: string };
  };
};

// -----------------------------
// Minimal fetch helpers
// -----------------------------

// Use a single base for all API calls (works with Vite proxy or absolute backend origin)
const API_BASE = import.meta.env.VITE_API_BASE ?? "";

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let message = res.statusText;
    try {
      const txt = await res.text();
      if (txt) message = txt;
    } catch { /* ignore */ }
    throw new Error(`${init?.method || "GET"} ${url} failed (${res.status}): ${message}`);
  }
  return res.json() as Promise<T>;
}

const ENDPOINTS = {
  spans: `${API_BASE}/api/spans`,
  plan: `${API_BASE}/api/plan`,
  enums: `${API_BASE}/enums`,
  ontology: `${API_BASE}/api/ontology`, // <-- key change: keep under /api so proxy hits backend
};

// -----------------------------
// Public API
// -----------------------------

/** Fetch enums for selects (status, mobility, CRR, caries, occlusion, parafunction, opposing, systemic). */
export function fetchEnums(): Promise<EnumsResponse> {
  return http<EnumsResponse>(ENDPOINTS.enums);
}

/** Fetch spans/abutments preview for the current set of missing teeth. */
export function fetchSpans(missing: Iterable<string> | string[]): Promise<SpansResponse> {
  const body = Array.isArray(missing) ? missing : Array.from(missing);
  return http<SpansResponse>(ENDPOINTS.spans, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ missing: body }),
  });
}

/** Compute treatment plan(s) from missing, abutment health, and patient risk. */
export function fetchPlan(payload: PlanRequest): Promise<PlanResponse> {
  return http<PlanResponse>(ENDPOINTS.plan, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/** Fetch ontology (labels, tooltips, name templates). */
export async function fetchOntology(): Promise<Ontology> {
  return http<Ontology>(ENDPOINTS.ontology);
}
