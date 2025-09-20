// src/pages/IntakeScreen.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ToothChartFDI from "../components/ToothChartFDI";
import { fetchSpans, fetchEnums } from "../api";
import type { SpansResponse, EnumsResponse } from "../api";
import { useAppStore, type AbutHealth } from "../store";

export default function IntakeScreen() {
  const navigate = useNavigate();

  // ---- global store ----
  const missing = useAppStore((s) => s.missing);
  const preview = useAppStore((s) => s.preview);
  const setMissing = useAppStore((s) => s.setMissing);
  const setPreview = useAppStore((s) => s.setPreview);
  const enums = useAppStore((s) => s.enums);
  const setEnums = useAppStore((s) => s.setEnums);
  const abutmentHealth = useAppStore((s) => s.abutmentHealth);
  const ensureAbutmentDefaults = useAppStore((s) => s.ensureAbutmentDefaults);
  const patchAbutment = useAppStore((s) => s.patchAbutment);

  // ---- local ui state ----
  const [previewOpen, setPreviewOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTooth, setDrawerTooth] = useState<string | null>(null);
  const [drawerIsAbutment, setDrawerIsAbutment] = useState(false);

  // fetch enums once (for drawer fields)
  useEffect(() => {
    if (!enums) fetchEnums().then(setEnums).catch(() => setEnums(null));
  }, [enums, setEnums]);

  // debounce spans preview when missing changes
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchSpans(missing);
        setPreview(data);
        // keep drawer badge in sync
        if (drawerOpen && drawerTooth) {
          setDrawerIsAbutment((data.abutments ?? []).includes(drawerTooth));
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to update spans.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [missing, setPreview, drawerOpen, drawerTooth]);

  const abutmentsSet = useMemo(
    () => new Set<string>(preview?.abutments ?? []),
    [preview]
  );

  const canNext =
    !!preview &&
    (preview.spans?.maxilla?.length > 0 || preview.spans?.mandible?.length > 0) &&
    (preview.abutments?.length ?? 0) > 0;

  function onUpdateMissing(next: Set<string>) {
    setMissing(new Set(next));
  }

  // defaults for a new abutment record
  const defaultAbut = (): AbutHealth => ({
    status: enums?.status_options?.[0]?.[0] ?? "present_sound",
    mobility_miller: enums?.mobility_options?.[0]?.[0] ?? "0",
    crown_root_ratio: enums?.crr_options?.[0]?.[0] ?? ">=1:1",
    enamel_ok_for_rbb: true,
  });

  // >>> Restore drawer behavior on right-click <<<
  function onOpenAbutmentDrawer(tooth: string, isAbutment: boolean) {
    setDrawerTooth(tooth);
    setDrawerIsAbutment(isAbutment);
    if (isAbutment) {
      ensureAbutmentDefaults(tooth, defaultAbut());
    }
    setDrawerOpen(true);
  }

  const currentAbut =
    drawerTooth && abutmentHealth[drawerTooth]
      ? abutmentHealth[drawerTooth]
      : undefined;

  return (
    <div style={{ color: "#e4e4e7", background: "#0a0a0a", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
        <h1 style={{ marginBottom: 8 }}>Dental Input – Intake (Step 1 of 4)</h1>
        <p style={{ marginTop: 0, opacity: 0.75 }}>
          Click teeth to mark <b>missing</b>. Right-click a tooth to open the abutment drawer.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: previewOpen ? "1fr 340px" : "1fr",
            gap: 16,
          }}
        >
          {/* LEFT: Tooth chart */}
          <div
            style={{
              border: "1px solid #27272a",
              borderRadius: 8,
              padding: 16,
              background: "#111113",
            }}
          >
            <ToothChartFDI
              missing={missing}
              abutments={abutmentsSet}
              onUpdateMissing={onUpdateMissing}
              onOpenAbutmentDrawer={onOpenAbutmentDrawer}
            />
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button
                onClick={() => setMissing(new Set())}
                style={{
                  padding: "8px 12px",
                  background: "#27272a",
                  border: "1px solid #3f3f46",
                  borderRadius: 6,
                  color: "#e4e4e7",
                }}
              >
                Reset selection
              </button>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button
                  onClick={() => canNext && navigate("/abutments")}
                  disabled={!canNext}
                  title={canNext ? "" : "Select spans and abutments first"}
                  style={{
                    padding: "8px 12px",
                    background: canNext ? "#22c55e" : "#1f2937",
                    color: canNext ? "#0a0a0a" : "#64748b",
                    border: "none",
                    borderRadius: 6,
                    cursor: canNext ? "pointer" : "not-allowed",
                  }}
                >
                  Next →
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: Collapsible preview */}
          {previewOpen && (
            <div
              style={{
                border: "1px solid #27272a",
                borderRadius: 8,
                padding: 12,
                background: "#111113",
                position: "relative",
              }}
            >
              <button
                onClick={() => setPreviewOpen(false)}
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  background: "transparent",
                  color: "#a1a1aa",
                  border: "none",
                  cursor: "pointer",
                }}
                aria-label="Collapse preview"
              >
                ⮜
              </button>
              <h3 style={{ marginTop: 8 }}>Detected Spans &amp; Abutments</h3>
              {loading && <p style={{ opacity: 0.7 }}>Updating…</p>}
              {error && (
                <p style={{ color: "#fca5a5" }}>
                  Couldn’t update spans. {error}
                </p>
              )}

              {preview && (
                <>
                  <ArchPreview title="Maxilla" spans={preview.spans?.maxilla ?? []} />
                  <div style={{ height: 8 }} />
                  <ArchPreview title="Mandible" spans={preview.spans?.mandible ?? []} />
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 13, opacity: 0.8 }}>
                      Abutments:&nbsp;
                      {(preview.abutments ?? []).length > 0
                        ? preview.abutments.join(", ")
                        : "—"}
                    </div>
                  </div>
                </>
              )}

              {!preview && !loading && (
                <p style={{ opacity: 0.7, marginTop: 8 }}>
                  Select missing teeth to detect spans.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT-SIDE DRAWER (restored) */}
      {drawerOpen && (
        <>
          <div
            onClick={() => setDrawerOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)" }}
          />
          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: 380,
              background: "#0f0f10",
              borderLeft: "1px solid #27272a",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center" }}>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close drawer"
                style={{
                  background: "transparent",
                  color: "#a1a1aa",
                  border: "none",
                  fontSize: 18,
                  marginRight: 8,
                  cursor: "pointer",
                }}
                title="Close"
              >
                ❮
              </button>
              <h3 style={{ margin: 0 }}>
                Tooth {drawerTooth ?? ""}
                {drawerIsAbutment ? " • Abutment" : ""}
              </h3>
            </div>

            {!drawerIsAbutment && (
              <div style={{ opacity: 0.85 }}>Not currently an abutment.</div>
            )}

            {drawerIsAbutment && (
              <>
                {!enums ? (
                  <div style={{ opacity: 0.8 }}>Loading options…</div>
                ) : (
                  <>
                    {/* Status */}
                    <FieldSelect
                      label="Status"
                      value={currentAbut?.status ?? defaultAbut().status}
                      onChange={(v) =>
                        drawerTooth &&
                        patchAbutment(drawerTooth, { status: v }, defaultAbut())
                      }
                      options={enums.status_options}
                    />

                    {/* Mobility */}
                    <FieldSelect
                      label="Mobility (Miller)"
                      value={
                        currentAbut?.mobility_miller ??
                        defaultAbut().mobility_miller
                      }
                      onChange={(v) =>
                        drawerTooth &&
                        patchAbutment(
                          drawerTooth,
                          { mobility_miller: v },
                          defaultAbut()
                        )
                      }
                      options={enums.mobility_options}
                    />

                    {/* CRR */}
                    <FieldSelect
                      label="Crown–Root Ratio"
                      value={
                        currentAbut?.crown_root_ratio ??
                        defaultAbut().crown_root_ratio
                      }
                      onChange={(v) =>
                        drawerTooth &&
                        patchAbutment(
                          drawerTooth,
                          { crown_root_ratio: v },
                          defaultAbut()
                        )
                      }
                      options={enums.crr_options}
                    />

                    {/* Enamel OK */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        id="enamel_ok"
                        type="checkbox"
                        checked={currentAbut?.enamel_ok_for_rbb ?? true}
                        onChange={(e) =>
                          drawerTooth &&
                          patchAbutment(
                            drawerTooth,
                            { enamel_ok_for_rbb: e.target.checked },
                            defaultAbut()
                          )
                        }
                      />
                      <label htmlFor="enamel_ok">Enamel OK for RBB</label>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// small subcomponents
function ArchPreview({ title, spans }: { title: string; spans: any[] }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 600 }}>{title}</div>
      {spans.length === 0 ? (
        <div style={{ opacity: 0.7, fontSize: 13 }}>No spans</div>
      ) : (
        spans.map((s, idx) => (
          <div
            key={`${title}-${idx}`}
            style={{
              padding: "6px 8px",
              border: "1px solid #3f3f46",
              borderRadius: 6,
              marginTop: 6,
            }}
          >
            <div style={{ fontSize: 13 }}>
              Missing: <b>{(s.missing_teeth ?? []).join("–")}</b>
            </div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              Abutments: {s.abutments?.mesial ?? "—"} | {s.abutments?.distal ?? "—"} • Type:{" "}
              {s.span_type}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div>
      <label
        style={{ display: "block", fontSize: 12, opacity: 0.8, marginBottom: 4 }}
      >
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: 8,
          background: "#111113",
          color: "#e4e4e7",
          border: "1px solid #3f3f46",
          borderRadius: 6,
        }}
      >
        {options.map(([val, lab]) => (
          <option key={val} value={val}>
            {lab}
          </option>
        ))}
      </select>
    </div>
  );
}
