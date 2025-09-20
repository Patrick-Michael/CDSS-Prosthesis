// src/pages/ReportPage.tsx
import type { CSSProperties } from "react";
import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppStore } from "../store";

/** Router state we expect from PlanScreen’s navigate("/report", { state }) */
type RouterState = {
  response?: any;   // PlanResponse
  planBody?: any;   // { missing, abutment_health, patient_risk }
  ontology?: any;   // labels/templates/rules/plans (optional)
};

/** View-model built locally from router state */
type ReportVM = {
  case_overview: {
    missing_teeth: string[];
    arch_summaries: Record<string, { kennedy_class: string; modifications: number }>;
    patient_conditions: string[];
  };
  spans: Array<{
    span_id: string;
    arch_label: string;
    span_type_label: string;
    length: number;
    options: Array<{
      display_name: string;
      family_label: string;
      kind_label: string;
      context: string;
      penalty_score: number;
      rule_badges: string[];
      site?: string;
      mesial_abutment?: string | null;
      distal_abutment?: string | null;
    }>;
    excluded?: Array<{ option_name: string; absolute_rules: string[] }>;
  }>;
  unified_plans: Array<{
    plan_label: string;
    total_score: number;
    components: Array<{ span_id: string; display_name: string }>;
  }>;
  provenance: {
    engine_version?: string;
    ruleset_version?: string;
    scoring_policy?: string;
    discarded_count?: number;
    data_warnings?: string[];
  };
};

/* ============================= STRICT HELPERS ============================= */

type WarnFn = (msg: string) => void;

function strictLabel(table: any, key: string, path: string, warn: WarnFn): string {
  if (!table) {
    warn(`Missing table: ${path}`);
    return `[[MISSING:${path}]]`;
  }
  const raw = table[key];
  const label = raw?.label ?? raw;
  if (label === undefined || label === null || label === "") {
    warn(`Missing label for ${path}.${key}`);
    return `[[MISSING:${path}.${key}]]`;
  }
  return String(label);
}

function strictRuleLabel(ontology: any | null, rid: string, warn: WarnFn): string {
  const info = ontology?.rules?.[rid];
  const label = info?.short ?? info?.label;
  if (!label) {
    warn(`Missing rule label for rules.${rid}`);
    return `[[MISSING:rules.${rid}]]`;
  }
  return String(label);
}

function strictTemplate(ontology: any | null, kind: string, warn: WarnFn): string | null {
  const tpl = ontology?.options?.[kind]?.nameTemplate ?? null;
  if (!tpl) warn(`Missing nameTemplate for options.${kind}`);
  return tpl;
}

function applyTemplate(
  tpl: string,
  dict: Record<string, any>,
  warn: WarnFn,
  ctx: string
): string {
  return tpl.replace(/\{(\w+)\}/g, (_m, k: string) => {
    const v = dict[k];
    if (v === undefined || v === null || v === "") {
      warn(`Missing template var "${k}" in ${ctx}`);
      return `[[MISSING:${ctx}.${k}]]`;
    }
    return String(v);
  });
}

/* ============================ PAGE COMPONENT ============================= */

export default function ReportPage() {
  const nav = useNavigate();
  const location = useLocation();
  const state = (location.state as RouterState | undefined) ?? {};

  // pull enums from store (source of truth for patient-risk labels)
  const enums = useAppStore((s) => s.enums);

  const vm = useMemo<ReportVM | null>(() => {
    if (!state.response || !state.planBody) return null;
    return assembleReportViewModel({
      response: state.response,
      planBody: state.planBody,
      ontology: state.ontology ?? null,
      enums,
    });
  }, [state.response, state.planBody, state.ontology, enums]);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  if (!vm) {
    return (
      <div style={{ minHeight: "100vh" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
          <h1>Report</h1>
          <p>This page needs data from the Plan screen.</p>
          <button onClick={() => nav("/plan")} style={btn()}>← Back to Plan</button>
        </div>
      </div>
    );
  }

  const { case_overview, spans, unified_plans, provenance } = vm;

  // Build unified-plan table columns from span ids (stable order from spans)
  const spanColumns = spans.map((s) => s.span_id);

  return (
    <div>
      {/* PRINT styles only — screen theme remains untouched */}
      <style>{printCSS}</style>

      <div className="page">
        {/* Screen-only controls */}
        <div className="screen-only" style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button onClick={() => nav("/plan")} style={btn()}>← Back</button>
          <div style={{ marginLeft: "auto" }} />
          <button onClick={() => window.print()} style={btnPrimary()}>Print / Save PDF</button>
        </div>

        {/* ===== Case Overview ===== */}
        <h1 style={{ margin: "0 0 8px 0" }}>Case Overview</h1>
        <div style={{ fontSize: 14, marginBottom: 10 }}>
          <div><b>Missing teeth:</b> {case_overview.missing_teeth.length ? case_overview.missing_teeth.join(", ") : "—"}</div>
          <div style={{ marginTop: 4, display: "flex", gap: 16, flexWrap: "wrap" }}>
            {Object.entries(case_overview.arch_summaries || {}).map(([arch, s]) => (
              <div key={arch}><b>{titleCase(arch)}:</b> Kennedy {s.kennedy_class} • Mods {s.modifications}</div>
            ))}
          </div>
          {case_overview.patient_conditions.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <b>Patient conditions:</b> {case_overview.patient_conditions.join(", ")}
            </div>
          )}
        </div>

        {/* ===== Per-Span Options (ranked) ===== */}
        <h2 style={{ marginTop: 12, marginBottom: 8 }}>Per-Span Options (ranked)</h2>
        {spans.map((sp) => (
          <div key={sp.span_id} className="card">
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <h3 style={{ margin: 0 }}>{sp.span_id}</h3>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                {sp.arch_label} • {sp.span_type_label} • Length {sp.length}
              </div>
            </div>

            <table className="table" style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th style={{ width: "36%" }}>Option</th>
                  <th style={{ width: "22%" }}>Type</th>
                  <th>Context</th>
                  <th style={{ width: "10%" }}>Penalty</th>
                  <th style={{ width: "22%" }}>Penalty Rules</th>
                </tr>
              </thead>
              <tbody>
                {sp.options.map((o, i) => (
                  <tr key={`${sp.span_id}-${i}`}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{o.display_name}</div>
                      {(o.site || o.mesial_abutment || o.distal_abutment) && (
                        <div className="muted">
                          {o.site && <>Site: {o.site}</>}
                          {o.site && (o.mesial_abutment || o.distal_abutment) && " • "}
                          {(o.mesial_abutment || o.distal_abutment) && <>Abutments: {o.mesial_abutment ?? "—"} | {o.distal_abutment ?? "—"}</>}
                        </div>
                      )}
                    </td>
                    <td>
                      <div>{o.family_label}</div>
                      <div className="muted">{o.kind_label}</div>
                    </td>
                    <td>{o.context}</td>
                    <td style={{ textAlign: "center" }}><b>{o.penalty_score}</b></td>
                    <td>
                      {o.rule_badges.length ? (
                        <div className="badges">
                          {o.rule_badges.slice(0, 3).map((b, idx) => <span key={idx} className="badge">{b}</span>)}
                          {o.rule_badges.length > 3 && <span className="badge muted">+{o.rule_badges.length - 3}</span>}
                        </div>
                      ) : <span className="muted">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {sp.excluded && sp.excluded.length > 0 && (
              <div className="muted" style={{ marginTop: 6 }}>
                <b>Contraindications:</b>{" "}
                {sp.excluded.map((ex, j) => (
                  <span key={j}>
                    {ex.option_name} ( {ex.absolute_rules.join(", ")} ){j < sp.excluded!.length - 1 ? "; " : ""}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* ===== Unified Plans (one consolidated table) ===== */}
        {unified_plans.length > 0 && (
          <>
            <h2 style={{ marginTop: 12, marginBottom: 8 }}>Unified Plan Suggestions</h2>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: "28%" }}>Plan</th>
                  {spanColumns.map((sid) => <th key={sid}>{sid}</th>)}
                  <th style={{ width: 110 }}>Penalty Score</th>
                </tr>
              </thead>
              <tbody>
                {unified_plans.map((p, idx) => (
                  <tr key={idx}>
                    <td><b>{p.plan_label}</b></td>
                    {spanColumns.map((sid) => {
                      const c = p.components.find((x) => x.span_id === sid);
                      return <td key={sid}>{c ? c.display_name : "—"}</td>;
                    })}
                    <td><b>{p.total_score}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Data warnings (strict mode) */}
        {provenance.data_warnings && provenance.data_warnings.length > 0 && (
          <div className="alert">
            <b>Data warnings:</b>
            <ul>{provenance.data_warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </div>
        )}

        {/* Footer / Provenance */}
        <footer className="muted" style={{ marginTop: 10, fontSize: 11 }}>
          {provenance.engine_version && <>Engine: {provenance.engine_version} • </>}
          {provenance.ruleset_version && <>Ruleset: {provenance.ruleset_version} • </>}
          {provenance.scoring_policy && <>Scoring: {provenance.scoring_policy}</>}
          {typeof provenance.discarded_count === "number" && <> • Excluded options: {provenance.discarded_count}</>}
        </footer>
      </div>
    </div>
  );
}

/* ========================== view-model assembly ========================== */

function assembleReportViewModel({
  planBody,
  response,
  ontology,
  enums,
}: {
  planBody: any;
  response: any;
  ontology: any | null;
  enums: any | null;
}): ReportVM {
  const warnings: string[] = [];
  const warn: WarnFn = (m) => warnings.push(m);

  const archLabel = (a: string) => strictLabel(ontology?.labels?.arch, a, "labels.arch", warn);
  const spanTypeLabel = (st: string) => strictLabel(ontology?.labels?.span_type, st, "labels.span_type", warn);
  const familyLabel = (fam: string) => strictLabel(ontology?.labels?.families, fam, "labels.families", warn);
  const kindLabel = (kind: string) => strictLabel(ontology?.labels?.kinds, kind, "labels.kinds", warn);
  const kindTemplate = (kind: string) => strictTemplate(ontology, kind, warn);
  const ruleLabelShort = (rid: string) => strictRuleLabel(ontology, rid, warn);

  // ---- Case overview
  const case_overview = {
    missing_teeth: planBody.missing ?? [],
    arch_summaries: response.arch_summaries ?? {},
    // Use enums for patient risk labels (source of truth)
    patient_conditions: humanizePatientConditionsFromEnums(planBody.patient_risk, enums, warn),
  };

  // ---- Spans + options (ranked)
  const spanIds = Object.keys(response.span_options ?? {}).sort((a: string, b: string) => a.localeCompare(b));
  const spans = spanIds.map((span_id: string) => {
    const cards = (response.span_options as any)[span_id] as any[];
    const arch = cards[0]?.arch ?? "";
    const st = cards[0]?.span_type ?? "";
    const length = cards[0]?.length ?? 0;

    const options = cards.map((opt) => {
      const tpl = kindTemplate(opt.kind);
      const dict: Record<string, any> = {
        span_id: opt.span_id,
        length: opt.length,
        site: opt.meta?.site,
        pontic_tooth: opt.meta?.site ?? opt.meta?.pontic,
        pontic: opt.meta?.site ?? opt.meta?.pontic,
        tooth: opt.meta?.site ?? opt.meta?.pontic,
        required_abutment: opt.meta?.required_abutment,
        abutment: opt.meta?.required_abutment,
        mesial_abutment: opt.meta?.abutments?.mesial,
        distal_abutment: opt.meta?.abutments?.distal,
      };
      const display_name =
        tpl ? applyTemplate(tpl, dict, warn, `options.${opt.kind}`)
            : `[[MISSING:options.${opt.kind}.nameTemplate]]: ${opt.option_id}`;

      const context = `${archLabel(opt.arch)} • ${spanTypeLabel(opt.span_type)} • Span length: ${opt.length} tooth${opt.length === 1 ? "" : "s"}`;
      const rule_badges = (opt.rule_hits?.relative ?? []).map((rid: string) => ruleLabelShort(rid));

      return {
        display_name,
        family_label: familyLabel(opt.family),
        kind_label: kindLabel(opt.kind),
        context,
        penalty_score: (opt as any).rank_score ?? 0,
        site: opt.meta?.site,
        mesial_abutment: opt.meta?.abutments?.mesial ?? null,
        distal_abutment: opt.meta?.abutments?.distal ?? null,
        rule_badges,
      };
    });

    // ---- Excluded options (absolute-gated), best-effort
    let excluded: Array<{ option_name: string; absolute_rules: string[] }> | undefined = undefined;
    const prov = (response as any).provenance?.discarded_absolute;
    if (prov) {
      const spanList = Array.isArray(prov) ? prov : prov[span_id];
      const items = Array.isArray(spanList) ? spanList : [];
      excluded = items.map((it: any) => {
        const ridList = (it?.rule_ids ?? it?.absolute ?? it?.rules ?? it?.rule_hits?.absolute ?? []) as string[];
        const labelList = (ridList || []).map((rid) => ruleLabelShort(rid));
        const name = it?.option_name || it?.option_id || "Option";
        return { option_name: String(name), absolute_rules: labelList };
      });
      if (excluded.length === 0) excluded = undefined;
    }

    return { span_id, arch_label: archLabel(arch), span_type_label: spanTypeLabel(st), length, options, excluded };
  });

  // ---- Unified plans (ALL, ranked; best is last)
  const plans = response.case_plans ?? [];
  const unified_plans = plans.map((p: any) => ({
    plan_label: (ontology?.plans?.[p.plan_id]?.label as string) ?? `[[MISSING:plans.${p.plan_id}.label]]`,
    total_score: p.total_score,
    components: Object.entries(p.selected).map(([sid, oid]) => {
      const chosen = ((response.span_options as any)[sid] as any[]).find((c: any) => c.option_id === oid);
      const tpl = chosen ? kindTemplate(chosen.kind) : null;
      const dict: Record<string, any> = chosen
        ? {
            span_id: chosen.span_id,
            length: chosen.length,
            site: chosen.meta?.site,
            pontic_tooth: chosen.meta?.site ?? chosen.meta?.pontic,
            pontic: chosen.meta?.site ?? chosen.meta?.pontic,
            tooth: chosen.meta?.site ?? chosen.meta?.pontic,
            required_abutment: chosen.meta?.required_abutment,
            abutment: chosen.meta?.required_abutment,
            mesial_abutment: chosen.meta?.abutments?.mesial,
            distal_abutment: chosen.meta?.abutments?.distal,
          }
        : {};
      const display_name =
        chosen && tpl
          ? applyTemplate(tpl, dict, warn, `options.${chosen.kind}`)
          : chosen
            ? `[[MISSING:options.${chosen.kind}.nameTemplate]]: ${chosen.option_id}`
            : String(oid);
      return { span_id: sid as string, display_name };
    }),
  }));

  const provenance = {
    engine_version: (response as any).provenance?.engine_version,
    ruleset_version: (response as any).provenance?.ruleset_version,
    scoring_policy: response.scoring_policy,
    discarded_count: (() => {
      const p = (response as any).provenance?.discarded_absolute;
      if (!p) return undefined;
      if (Array.isArray(p)) return p.length;
      try {
        return Object.values(p).reduce((acc: number, v: any) => acc + (Array.isArray(v) ? v.length : 0), 0);
      } catch { return undefined; }
    })(),
    data_warnings: warnings,
  };

  return { case_overview, spans, unified_plans, provenance };
}

/* =============================== helpers =============================== */

// Use enums (from /enums) to humanize patient risk — not ontology.
function humanizePatientConditionsFromEnums(pr: any, enums: any | null, warn: WarnFn): string[] {
  if (!pr) return [];
  const out: string[] = [];
  const get = (pairs: [string, string][], key: string, path: string) => {
    if (!pairs) { warn(`Missing table: ${path}`); return `[[MISSING:${path}]]`; }
    const hit = pairs.find(([v]) => v === key);
    if (!hit) { warn(`Missing label for ${path}.${key}`); return `[[MISSING:${path}.${key}]]`; }
    return hit[1];
  };

  if (pr.caries_risk) out.push(`Caries: ${get(enums?.caries_options, pr.caries_risk, "enums.caries_options")}`);
  if (pr.occlusal_scheme) out.push(`Occlusion: ${get(enums?.occlusion_options, pr.occlusal_scheme, "enums.occlusion_options")}`);
  if (pr.parafunction) out.push(`Parafunction: ${get(enums?.parafunction_options, pr.parafunction, "enums.parafunction_options")}`);
  if (pr.opposing_dentition) out.push(`Opposition: ${get(enums?.opposing_options, pr.opposing_dentition, "enums.opposing_options")}`);
  if (Array.isArray(pr.systemic_flags) && pr.systemic_flags.length) {
    const labels = pr.systemic_flags.map((f: string) => get(enums?.systemic_options, f, "enums.systemic_options"));
    out.push(`Systemic: ${labels.join(", ")}`);
  }
  return out;
}

function titleCase(s: string) { return s.slice(0, 1).toUpperCase() + s.slice(1); }

function btn(): CSSProperties {
  return { padding: "8px 12px", background: "var(--btn-bg, #efefef)", border: "1px solid var(--btn-border, #ddd)", borderRadius: 6, color: "var(--btn-fg, #111)", cursor: "pointer" };
}
function btnPrimary(): CSSProperties {
  return { padding: "8px 12px", background: "var(--btnp-bg, #111)", border: "1px solid var(--btnp-border, #111)", borderRadius: 6, color: "var(--btnp-fg, #fff)", cursor: "pointer" };
}

/* ---------- print CSS (applies only during printing) ---------- */
const printCSS = `
  @media screen { .screen-only { display: flex; } }
  @media print  { .screen-only { display: none !important; } }

  @page { size: A4; margin: 16mm 14mm; }

  @media print {
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
  }

  .page { max-width: 900px; margin: 0 auto; padding: 16px; }
  h1, h2, h3 { margin: 0 0 6px 0; }
  .muted { opacity: 0.72; }

  .card {
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    padding: 10px;
    margin-bottom: 10px;
    break-inside: auto;
    page-break-inside: auto;
  }

  .table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    break-inside: auto;
    page-break-inside: auto;
  }
  .table th, .table td { border: 1px solid #e5e5e5; padding: 6px 8px; vertical-align: top; }
  .table tr { break-inside: avoid; page-break-inside: avoid; }

  .badges { display: inline-flex; flex-wrap: wrap; gap: 6px; }
  .badge  { display: inline-block; padding: 2px 6px; border-radius: 999px; border: 1px solid #e0e0e0; font-size: 11px; }
  .badge.muted { opacity: 0.7; }

  .alert {
    border: 1px solid #eab308;
    background: rgba(234, 179, 8, 0.12);
    padding: 8px;
    border-radius: 6px;
    margin-top: 10px;
    font-size: 12px;
  }
`;
