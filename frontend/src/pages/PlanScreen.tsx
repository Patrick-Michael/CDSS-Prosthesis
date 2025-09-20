// src/pages/PlanScreen.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store";
import { fetchPlan, type PlanResponse, type OptionCard } from "../api";

type SpanId = string;

/* ---------------- Helpers ---------------- */

function templateName(tpl: string, fields: Record<string, string | number | undefined>) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(fields[k] ?? ""));
}

function toothLabelFDI(code?: string | null) {
  if (!code) return "—";
  const quadName: Record<string, string> = {
    "1": "Maxillary Right",
    "2": "Maxillary Left",
    "3": "Mandibular Left",
    "4": "Mandibular Right",
  };
  const posName: Record<string, string> = {
    "1": "Central Incisor",
    "2": "Lateral Incisor",
    "3": "Canine",
    "4": "1st Premolar",
    "5": "2nd Premolar",
    "6": "1st Molar",
    "7": "2nd Molar",
    "8": "3rd Molar",
  };
  return `${code} — ${quadName[code[0]]} ${posName[code[1]] ?? ""}`.trim();
}

/* ---------------- Component ---------------- */

export default function PlanScreen() {
  const navigate = useNavigate();

  // ---- app state to compose request body ----
  const missing = useAppStore((s) => s.missing);
  const abutmentHealth = useAppStore((s) => s.abutmentHealth);
  const patientRisk = useAppStore((s) => s.patientRisk);
  const resetCase = useAppStore((s) => s.resetCase);

  // ---- ontology for humanization ----
  const ontology = useAppStore((s) => s.ontology);

  // ---- local UI state ----
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PlanResponse | null>(null);

  const [openSpan, setOpenSpan] = useState<SpanId | null>(null);
  const [openPlan, setOpenPlan] = useState<string | null>(null);

  // ---- request body (server recomputes spans) ----
  const planBody = useMemo(() => {
    const abut_list = Object.entries(abutmentHealth).map(([tooth, rec]) => ({
      tooth,
      status: rec.status,
      mobility_miller: rec.mobility_miller,
      crown_root_ratio: rec.crown_root_ratio,
      enamel_ok_for_rbb: !!rec.enamel_ok_for_rbb,
    }));
    return {
      missing: Array.from(missing),
      abutment_health: abut_list,
      patient_risk: patientRisk,
    };
  }, [missing, abutmentHealth, patientRisk]);

  // ---- fetch on mount / change ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await fetchPlan(planBody);
        if (!cancelled) {
          setData(resp);
          const firstSpan = Object.keys(resp.span_options)[0] ?? null;
          setOpenSpan(firstSpan);
          const lastPlan = resp.case_plans[resp.case_plans.length - 1];
          setOpenPlan(lastPlan?.plan_id ?? null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to fetch plan.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [planBody]);

  const spanOptions = data?.span_options ?? {};
  const plans = data?.case_plans ?? [];

  const orderedSpanIds = useMemo(
    () => Object.keys(spanOptions).sort((a, b) => a.localeCompare(b)),
    [spanOptions]
  );

  /* ---- humanizers from ontology ---- */

  const scoreHint = ontology?.ui?.legend?.score_hint;

  const archLabel = (arch: string) =>
    ontology?.labels.arch[arch as "maxilla" | "mandible"] ?? arch;

  const spanTypeLabel = (st: string) =>
    ontology?.labels.span_type[st as "BOUNDED" | "DISTAL_EXTENSION"] ?? st;

  const familyLabel = (fam: string) =>
    ontology?.labels.families[fam]?.label ?? fam;

  const kindLabel = (kind: string) =>
    ontology?.labels.kinds[kind]?.label ?? kind;

  const kindShort = (kind: string) =>
    ontology?.labels.kinds[kind]?.short ?? kind;

  const kindTemplate = (kind: string) =>
    ontology?.options[kind]?.nameTemplate;

  /* ---------------- Render ---------------- */

  return (
    <div style={{ color: "#e4e4e7", background: "#0a0a0a", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
        <h1 style={{ marginBottom: 4 }}>Plan &amp; Results (Step 4 of 4)</h1>
        <p style={{ marginTop: 0, opacity: 0.75 }}>
          Review all options per span first, then scroll down for unified case plans selected by the rules engine.
        </p>
        {scoreHint && (
          <p style={{ marginTop: 0, opacity: 0.65, fontSize: 12 }}>
            {scoreHint}
          </p>
        )}
        {!ontology && (
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Ontology not loaded — showing raw IDs
          </div>
        )}

        {/* Top controls */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
            onClick={() => navigate("/risk")}
            style={{ padding: "8px 12px", background: "#27272a", border: "1px solid #3f3f46", borderRadius: 6, color: "#e4e4e7" }}
          >
            ← Back
          </button>
          <div style={{ marginLeft: "auto" }} />
          <button
            type="button"
            onClick={() => {
              resetCase();
              navigate("/");
            }}
            style={{ padding: "8px 12px", background: "#111113", border: "1px solid #3f3f46", borderRadius: 6, color: "#e4e4e7", cursor: "pointer" }}
          >
            Back to start
          </button>
        </div>

        {loading && <div style={{ opacity: 0.8 }}>Computing plan…</div>}
        {error && <div style={{ color: "#fca5a5", marginBottom: 8 }}>Error: {error}</div>}

        {/* Arch summaries */}
        {data?.arch_summaries && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            {Object.entries(data.arch_summaries).map(([arch, s]) => (
              <div key={arch} style={{ border: "1px solid #27272a", borderRadius: 8, padding: 10, background: "#111113" }}>

                <div style={{ fontWeight: 600, marginBottom: 4 }}>{archLabel(arch)}</div>
                <div style={{ fontSize: 13 }}>
                  Kennedy: <b>{(s as any).kennedy_class}</b> • Mods: <b>{(s as any).modifications}</b>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* =================== SECTION 1: Per-Span Options =================== */}
        <h2 style={{ marginTop: 8, marginBottom: 8 }}>Span Options (per span)</h2>
        {orderedSpanIds.length === 0 && !loading && !error && (
          <div style={{ opacity: 0.8 }}>No spans detected for current inputs.</div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
          {orderedSpanIds.map((spanId) => {
            const options = spanOptions[spanId] as OptionCard[];
            const pickedKinds = new Set(options.map((o) => o.kind));
            return (
              <div key={spanId} style={{ border: "1px solid #27272a", borderRadius: 10, padding: 12, background: "#111113" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontWeight: 700 }}>{spanId}</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    kinds: {[...pickedKinds]
                      .map((k) => kindShort(k))
                      .sort()
                      .join(", ") || "—"}
                  </div>
                  <div style={{ marginLeft: "auto" }} />
                  <button
                    onClick={() => setOpenSpan((id) => (id === spanId ? null : spanId))}
                    style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid #3f3f46", background: "#0f0f10", color: "#e4e4e7", cursor: "pointer" }}
                  >
                    {openSpan === spanId ? "Hide" : "Show"} options
                  </button>
                </div>

                {openSpan === spanId && (
                  <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 10 }}>
                    {options.map((opt) => {
                      const tpl = kindTemplate(opt.kind);
                      const readableName = tpl
                        ? templateName(tpl, {
                            span_id: opt.span_id,
                            length: opt.length,

                            // single-site aliases (implant_single uses meta.site)
                            site: opt.meta?.site,
                            pontic_tooth: opt.meta?.site ?? opt.meta?.pontic,
                            pontic: opt.meta?.site ?? opt.meta?.pontic,
                            tooth: opt.meta?.site ?? opt.meta?.pontic,

                            // cantilever / abutments
                            required_abutment: opt.meta?.required_abutment,
                            abutment: opt.meta?.required_abutment,
                            mesial_abutment: opt.meta?.abutments?.mesial,
                            distal_abutment: opt.meta?.abutments?.distal,
                          })
                        : opt.option_id;

                      return (
                        <div key={opt.option_id} style={{ border: "1px solid #3f3f46", borderRadius: 8, padding: 10, background: "#18181b" }}>
                          <div style={{ fontWeight: 600 }}>{readableName}</div>
                          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
                            {archLabel(opt.arch)} • {spanTypeLabel(opt.span_type)} • Span length: {opt.length} tooth{opt.length === 1 ? "" : "s"}
                          </div>
                          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
                            {familyLabel(opt.family)} • {kindLabel(opt.kind)}
                          </div>

                          {opt.meta?.abutments && (
                            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
                              Abutments:{" "}
                              <span title={toothLabelFDI(opt.meta.abutments.mesial)}>
                                {opt.meta.abutments.mesial ?? "—"}
                              </span>{" "}
                              |{" "}
                              <span title={toothLabelFDI(opt.meta.abutments.distal)}>
                                {opt.meta.abutments.distal ?? "—"}
                              </span>
                            </div>
                          )}
                          {opt.meta?.site && (
                            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
                              Site: <span title={toothLabelFDI(opt.meta.site)}>{opt.meta.site}</span>
                            </div>
                          )}
                          {opt.meta?.pontic && !opt.meta?.site && (
                            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
                              Pontic: <span title={toothLabelFDI(opt.meta.pontic)}>{opt.meta.pontic}</span>
                            </div>
                          )}
                          {opt.meta?.required_abutment && (
                            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
                              Required Abutment:{" "}
                              <span title={toothLabelFDI(opt.meta.required_abutment)}>
                                {opt.meta.required_abutment}
                              </span>
                            </div>
                          )}

                          {opt.rule_hits?.relative?.length ? (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                              {opt.rule_hits.relative.map((rid) => {
                                const r = ontology?.rules[rid];
                                const text = r?.short ?? r?.label ?? rid;
                                return (
                                  <span
                                    key={rid}
                                    title={r?.explanation ?? rid}
                                    style={{
                                      fontSize: 11,
                                      padding: "2px 6px",
                                      borderRadius: 999,
                                      border: "1px solid #3f3f46",
                                      background: "#0f0f10",
                                      opacity: 0.95,
                                    }}
                                  >
                                    {text}
                                  </span>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <hr style={{ border: "none", borderTop: "1px solid #27272a", margin: "18px 0" }} />

        {/* =================== SECTION 2: Unified Case Plans =================== */}
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>Unified Case Plans</h2>
        {!loading && !error && plans.length === 0 && (
          <div style={{ opacity: 0.8 }}>No feasible unified plans for the current inputs.</div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
          {plans.map((p) => (
            <div key={p.plan_id} style={{ border: "1px solid #27272a", borderRadius: 10, padding: 12, background: "#111113" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>Plan</span>
                <h3 style={{ margin: 0 }}>
                  {ontology?.plans[p.plan_id]?.label ?? p.plan_id}
                </h3>
                <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.9 }}>
                  Penalty Score: <b>{p.total_score}</b>
                </div>
              </div>

              {ontology?.plans[p.plan_id]?.description && (
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                  {ontology.plans[p.plan_id].description}
                </div>
              )}

              <div style={{ marginTop: 8 }}>
                <button
                  onClick={() => setOpenPlan((id) => (id === p.plan_id ? null : p.plan_id))}
                  style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid #3f3f46", background: "#0f0f10", color: "#e4e4e7", cursor: "pointer" }}
                >
                  {openPlan === p.plan_id ? "Hide details" : "Show details"}
                </button>
              </div>

              {openPlan === p.plan_id && (
                <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 10 }}>
                  {Object.entries(p.selected).map(([spanId, optionId]) => {
                    const cards = (spanOptions[spanId] ?? []) as OptionCard[];
                    const picked = cards.find((c) => c.option_id === optionId);

                    const templatedName = (() => {
                      const kd = picked && kindTemplate(picked.kind);
                      if (picked && kd) {
                        return templateName(kd, {
                          span_id: picked.span_id,
                          length: picked.length,

                          // single-site aliases (implant_single uses meta.site)
                          site: picked.meta?.site,
                          pontic_tooth: picked.meta?.site ?? picked.meta?.pontic,
                          pontic: picked.meta?.site ?? picked.meta?.pontic,
                          tooth: picked.meta?.site ?? picked.meta?.pontic,

                          // cantilever / abutments
                          required_abutment: picked.meta?.required_abutment,
                          abutment: picked.meta?.required_abutment,
                          mesial_abutment: picked.meta?.abutments?.mesial,
                          distal_abutment: picked.meta?.abutments?.distal,
                        });
                      }
                      return optionId;
                    })();

                    return (
                      <div key={spanId} style={{ border: "1px solid #3f3f46", borderRadius: 8, padding: 10 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{spanId}</div>
                        {picked ? (
                          <>
                            <div>Option: <b>{templatedName}</b></div>
                            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
                              {familyLabel(picked.family)} • {kindLabel(picked.kind)} • Length: {picked.length}
                            </div>
                            {picked.meta?.abutments && (
                              <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
                                Abutments:{" "}
                                <span title={toothLabelFDI(picked.meta.abutments.mesial)}>
                                  {picked.meta.abutments.mesial ?? "—"}
                                </span>{" "}
                                |{" "}
                                <span title={toothLabelFDI(picked.meta.abutments.distal)}>
                                  {picked.meta.abutments.distal ?? "—"}
                                </span>
                              </div>
                            )}
                            {picked.meta?.site && (
                              <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
                                Site: <span title={toothLabelFDI(picked.meta.site)}>{picked.meta.site}</span>
                              </div>
                            )}
                            {picked.meta?.pontic && !picked.meta?.site && (
                              <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
                                Pontic: <span title={toothLabelFDI(picked.meta.pontic)}>{picked.meta.pontic}</span>
                              </div>
                            )}
                            {picked.meta?.required_abutment && (
                              <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
                                Required Abutment:{" "}
                                <span title={toothLabelFDI(picked.meta.required_abutment)}>
                                  {picked.meta.required_abutment}
                                </span>
                              </div>
                            )}
                            {picked.rule_hits?.relative?.length ? (
                              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
                                {/* Could render labeled badges here as well, mirroring the per-span cards */}
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <div style={{ opacity: 0.75 }}>Selected option not found in span options.</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Debug / Provenance */}
        {data && (
          <details style={{ marginTop: 16 }}>
            <summary style={{ cursor: "pointer", opacity: 0.85 }}>Debug / Provenance</summary>
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>
              <div>Scoring Policy: <code>{data.scoring_policy}</code></div>
              {/* @ts-ignore */}
              <div>Capabilities: <code>{JSON.stringify(data.provenance?.capabilities)}</code></div>
              {/* @ts-ignore */}
              <div>Discarded (absolute gates): <code>{JSON.stringify(data.provenance?.discarded_absolute)}</code></div>
            </div>
          </details>
        )}

        {/* Footer actions (report) */}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <div style={{ marginLeft: "auto" }} />
          <button
            onClick={() => {
              if (!data) return;
              const report = assembleReportViewModel({
                planBody,
                response: data,
                ontology: ontology as any,
              });
              navigate("/report", {
                state: { response: data, planBody, ontology },
                });
            }}
            style={{ padding: "8px 12px", background: "#22c55e", border: "none", borderRadius: 6, color: "#0a0a0a", cursor: "pointer" }}
          >
            Generate Report
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Report assembly helpers (client-only) ---------------- */

function assembleReportViewModel({
  planBody,
  response,
  ontology,
}: {
  planBody: any;               // { missing, abutment_health, patient_risk }
  response: PlanResponse;      // from fetchPlan()
  ontology: any | null;        // from store (may be null)
}) {
  const archLabel = (a: string) => ontology?.labels?.arch?.[a] ?? a;
  const spanTypeLabel = (st: string) => ontology?.labels?.span_type?.[st] ?? st;
  const familyLabel = (fam: string) => ontology?.labels?.families?.[fam]?.label ?? fam;
  const kindLabel = (kind: string) => ontology?.labels?.kinds?.[kind]?.label ?? kind;
  const kindTemplate = (kind: string) => ontology?.options?.[kind]?.nameTemplate ?? null;
  const ruleLabelShort = (rid: string) => ontology?.rules?.[rid]?.short ?? ontology?.rules?.[rid]?.label ?? rid;

  // Case Overview
  const case_overview = {
    missing_teeth: planBody.missing ?? [],
    arch_summaries: response.arch_summaries ?? {},
    patient_conditions: humanizePatientConditions(planBody.patient_risk, ontology),
  };

  // Spans + options
  const spanIds = Object.keys(response.span_options ?? {}).sort((a, b) => a.localeCompare(b));
  const spans = spanIds.map((span_id) => {
    const cards = (response.span_options as any)[span_id] as OptionCard[];
    const arch = cards[0]?.arch ?? "";         // same for all options in a span
    const st = cards[0]?.span_type ?? "";      // same for all options in a span
    const length = cards[0]?.length ?? 0;

    const options = cards.map((opt) => {
      const tpl = kindTemplate(opt.kind);
      const display_name = tpl
        ? tpl.replace(/\{(\w+)\}/g, (_: any, k: string) => {
            const m = opt.meta || {};
            const dict: Record<string, any> = {
              span_id: opt.span_id,
              length: opt.length,
              site: m.site,
              pontic_tooth: m.site ?? m.pontic,
              pontic: m.site ?? m.pontic,
              tooth: m.site ?? m.pontic,
              required_abutment: m.required_abutment,
              abutment: m.required_abutment,
              mesial_abutment: m.abutments?.mesial,
              distal_abutment: m.abutments?.distal,
            };
            return String(dict[k] ?? "");
          })
        : opt.option_id;

      const context = `${archLabel(opt.arch)} • ${spanTypeLabel(opt.span_type)} • Span length: ${opt.length} tooth${opt.length === 1 ? "" : "s"}`;
      const rule_badges = (opt.rule_hits?.relative ?? []).map((rid) => ruleLabelShort(rid));

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

    // Excluded (absolute-gated) — best-effort if provenance is present
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

    return {
      span_id,
      arch_label: archLabel(arch),
      span_type_label: spanTypeLabel(st),
      length,
      options,
      excluded,
    };
  });

  // Unified plan (best = last)
  const plans = response.case_plans ?? [];
  const top = plans.length ? plans[plans.length - 1] : null;
  const unified_plan = top
    ? {
        plan_label: ontology?.plans?.[top.plan_id]?.label ?? top.plan_id,
        total_score: top.total_score,
        components: Object.entries(top.selected).map(([sid, oid]) => {
          const chosen = ((response.span_options as any)[sid] as OptionCard[]).find((c) => c.option_id === oid);
          const tpl = chosen ? kindTemplate(chosen.kind) : null;
          const display_name = chosen && tpl
            ? tpl.replace(/\{(\w+)\}/g, (_: any, k: string) => {
                const m = chosen!.meta || {};
                const dict: Record<string, any> = {
                  span_id: chosen!.span_id,
                  length: chosen!.length,
                  site: m.site,
                  pontic_tooth: m.site ?? m.pontic,
                  pontic: m.site ?? m.pontic,
                  tooth: m.site ?? m.pontic,
                  required_abutment: m.required_abutment,
                  abutment: m.required_abutment,
                  mesial_abutment: m.abutments?.mesial,
                  distal_abutment: m.abutments?.distal,
                };
                return String(dict[k] ?? "");
              })
            : (chosen?.option_id ?? String(oid));
          return { span_id: sid, display_name };
        }),
      }
    : null;

  // Provenance/footer
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
      } catch {
        return undefined;
      }
    })(),
  };

  return { case_overview, spans, unified_plan, provenance };
}

function humanizePatientConditions(pr: any, ontology: any | null): string[] {
  if (!pr) return [];
  const labs = ontology?.labels;
  const m: string[] = [];
  const car = pr.caries_risk ? (labs?.caries?.[pr.caries_risk]?.label ?? pr.caries_risk) : null;
  const occ = pr.occlusal_scheme ? (labs?.occlusion?.[pr.occlusal_scheme]?.label ?? pr.occlusal_scheme) : null;
  const pf  = pr.parafunction ? (labs?.parafunction?.[pr.parafunction]?.label ?? pr.parafunction) : null;
  const opp = pr.opposing_dentition ? (labs?.opposing?.[pr.opposing_dentition]?.label ?? pr.opposing_dentition) : null;
  if (car) m.push(`Caries: ${car}`);
  if (occ) m.push(`Occlusion: ${occ}`);
  if (pf)  m.push(`Parafunction: ${pf}`);
  if (opp) m.push(`Opposition: ${opp}`);
  if (Array.isArray(pr.systemic_flags) && pr.systemic_flags.length) {
    const flags = pr.systemic_flags.map((f: string) => labs?.systemic?.[f]?.label ?? f);
    m.push(`Systemic: ${flags.join(", ")}`);
  }
  return m;
}
