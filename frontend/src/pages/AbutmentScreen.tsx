// src/pages/AbutmentScreen.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchEnums } from "../api";
import { useAppStore, type AbutHealth } from "../store";

function useDefaults() {
  const enums = useAppStore((s) => s.enums);
  return (): AbutHealth => ({
    status: enums?.status_options?.[0]?.[0] ?? "present_sound",
    mobility_miller: enums?.mobility_options?.[0]?.[0] ?? "0",
    crown_root_ratio: enums?.crr_options?.[0]?.[0] ?? ">=1:1",
    enamel_ok_for_rbb: true,
  });
}

export default function AbutmentScreen() {
  const navigate = useNavigate();
  const preview = useAppStore((s) => s.preview);
  const enums = useAppStore((s) => s.enums);
  const setEnums = useAppStore((s) => s.setEnums);
  const abutmentHealth = useAppStore((s) => s.abutmentHealth);
  const ensureAbutmentDefaults = useAppStore((s) => s.ensureAbutmentDefaults);
  const patchAbutment = useAppStore((s) => s.patchAbutment);
  const defaultAbut = useDefaults();

  // fetch enums once if not present
  useEffect(() => {
    if (!enums) fetchEnums().then(setEnums).catch(() => setEnums(null));
  }, [enums, setEnums]);

  // abutment list from preview (we only allow arriving here if we have some)
  const abutments = useMemo(() => preview?.abutments ?? [], [preview]);

  // selected chip
  const [selected, setSelected] = useState<string | null>(abutments[0] ?? null);
  useEffect(() => {
    if (!selected && abutments.length > 0) setSelected(abutments[0]);
    if (selected && !abutments.includes(selected)) setSelected(abutments[0] ?? null);
  }, [abutments, selected]);

  // guard: if no abutments or no spans, bounce back to step 1
  useEffect(() => {
    const hasSpans =
      !!preview &&
      ((preview.spans?.maxilla?.length ?? 0) > 0 ||
        (preview.spans?.mandible?.length ?? 0) > 0);
    if (!hasSpans || abutments.length === 0) {
      navigate("/", { replace: true });
    }
  }, [preview, abutments, navigate]);

  // ensure defaults for the selected abutment
  useEffect(() => {
    if (selected) ensureAbutmentDefaults(selected, defaultAbut());
  }, [selected, ensureAbutmentDefaults]); // defaultAbut intentionally omitted (stable enough)

  const current = selected ? abutmentHealth[selected] ?? defaultAbut() : undefined;

  return (
    <div style={{ color: "#e4e4e7", background: "#0a0a0a", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: 16 }}>
        <h1 style={{ marginBottom: 8 }}>Abutment Health (Step 2 of 4)</h1>
        <p style={{ marginTop: 0, opacity: 0.75 }}>
          Review abutments and set Status, Mobility, CRR, and Enamel suitability.
        </p>

        {/* Top nav chips */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {abutments.map((t) => {
            const isActive = t === selected;
            return (
              <button
                key={t}
                onClick={() => setSelected(t)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid #3f3f46",
                  background: isActive ? "#2563eb" : "#111113",
                  color: isActive ? "#0a0a0a" : "#e4e4e7",
                  cursor: "pointer",
                }}
              >
                {t}
              </button>
            );
          })}
        </div>

        {/* Main panel */}
        <div style={{ border: "1px solid #27272a", borderRadius: 8, padding: 16, background: "#111113" }}>
          {!selected && <div style={{ opacity: 0.8 }}>No abutments.</div>}
          {selected && (
            <>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>Tooth {selected}</h3>

              {!enums ? (
                <div style={{ opacity: 0.8 }}>Loading options…</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                  {/* Status */}
                  <div>
                    <label style={{ display: "block", fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Status</label>
                    <select
                      value={current?.status ?? defaultAbut().status}
                      onChange={(e) => patchAbutment(selected, { status: e.target.value }, defaultAbut())}
                      style={{ width: "100%", padding: 8, background: "#111113", color: "#e4e4e7", border: "1px solid #3f3f46", borderRadius: 6 }}
                    >
                      {enums.status_options.map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Mobility */}
                  <div>
                    <label style={{ display: "block", fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Mobility (Miller)</label>
                    <select
                      value={current?.mobility_miller ?? defaultAbut().mobility_miller}
                      onChange={(e) => patchAbutment(selected, { mobility_miller: e.target.value }, defaultAbut())}
                      style={{ width: "100%", padding: 8, background: "#111113", color: "#e4e4e7", border: "1px solid #3f3f46", borderRadius: 6 }}
                    >
                      {enums.mobility_options.map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>

                  {/* CRR */}
                  <div>
                    <label style={{ display: "block", fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Crown–Root Ratio</label>
                    <select
                      value={current?.crown_root_ratio ?? defaultAbut().crown_root_ratio}
                      onChange={(e) => patchAbutment(selected, { crown_root_ratio: e.target.value }, defaultAbut())}
                      style={{ width: "100%", padding: 8, background: "#111113", color: "#e4e4e7", border: "1px solid #3f3f46", borderRadius: 6 }}
                    >
                      {enums.crr_options.map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Enamel checkbox */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      id="enamel_ok"
                      type="checkbox"
                      checked={current?.enamel_ok_for_rbb ?? true}
                      onChange={(e) => patchAbutment(selected, { enamel_ok_for_rbb: e.target.checked }, defaultAbut())}
                    />
                    <label htmlFor="enamel_ok">Enamel OK for RBB</label>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom nav */}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            onClick={() => navigate("/")}
            style={{ padding: "8px 12px", background: "#27272a", border: "1px solid #3f3f46", borderRadius: 6, color: "#e4e4e7" }}
          >
            ← Back
          </button>
          <div style={{ marginLeft: "auto" }} />
          <button
            onClick={() => navigate("/risk")}
            style={{ padding: "8px 12px", background: "#22c55e", border: "none", borderRadius: 6, color: "#0a0a0a", cursor: "pointer" }}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
