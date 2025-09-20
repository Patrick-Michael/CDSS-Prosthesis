// src/pages/PatientRiskScreen.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store";
import { fetchEnums } from "../api";

export default function PatientRiskScreen() {
  const navigate = useNavigate();
  const enums = useAppStore((s) => s.enums);
  const setEnums = useAppStore((s) => s.setEnums);

  const patientRisk = useAppStore((s) => s.patientRisk);
  const setPatientRisk = useAppStore((s) => s.setPatientRisk);
  const toggleSystemicFlag = useAppStore((s) => s.toggleSystemicFlag);

  // fetch enums once
  useEffect(() => {
    if (!enums) fetchEnums().then(setEnums).catch(() => setEnums(null));
  }, [enums, setEnums]);

  // simple helper for radio/selects
  function onChange<K extends keyof typeof patientRisk>(key: K, val: string) {
    setPatientRisk({ [key]: val } as any);
  }

  return (
    <div style={{ color: "#e4e4e7", background: "#0a0a0a", minHeight: "100vh" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
        <h1 style={{ marginBottom: 8 }}>Patient Risk (Step 3 of 4)</h1>
        <p style={{ marginTop: 0, opacity: 0.75 }}>
          Select caries risk, occlusion, parafunction, opposing dentition, and systemic flags.
        </p>

        {!enums ? (
          <div style={{ opacity: 0.8 }}>Loading options…</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
            {/* Caries Risk */}
            <FieldGroup title="Caries Risk">
              <RadioRow
                name="caries"
                value={patientRisk.caries_risk}
                onChange={(v) => onChange("caries_risk", v)}
                options={enums.caries_options}
              />
            </FieldGroup>

            {/* Occlusal Scheme */}
            <FieldGroup title="Occlusal Scheme">
              <Select
                value={patientRisk.occlusal_scheme}
                onChange={(v) => onChange("occlusal_scheme", v)}
                options={enums.occlusion_options}
              />
            </FieldGroup>

            {/* Parafunction */}
            <FieldGroup title="Parafunction">
              <Select
                value={patientRisk.parafunction}
                onChange={(v) => onChange("parafunction", v)}
                options={enums.parafunction_options}
              />
            </FieldGroup>

            {/* Opposing Dentition */}
            <FieldGroup title="Opposing Dentition">
              <Select
                value={patientRisk.opposing_dentition}
                onChange={(v) => onChange("opposing_dentition", v)}
                options={enums.opposing_options}
              />
            </FieldGroup>

            {/* Systemic Flags */}
            <FieldGroup title="Systemic Flags">
              <ChipRow
                selected={new Set(patientRisk.systemic_flags)}
                onToggle={toggleSystemicFlag}
                options={enums.systemic_options} // [value,label][]
              />
            </FieldGroup>
          </div>
        )}

        {/* Bottom nav */}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button
            onClick={() => navigate("/abutments")}
            style={{ padding: "8px 12px", background: "#27272a", border: "1px solid #3f3f46", borderRadius: 6, color: "#e4e4e7" }}
          >
            ← Back
          </button>
          <div style={{ marginLeft: "auto" }} />
          <button
            onClick={() => navigate("/plan")}
            style={{ padding: "8px 12px", background: "#22c55e", border: "none", borderRadius: 6, color: "#0a0a0a", cursor: "pointer" }}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

/* --- small UI helpers --- */

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid #27272a", borderRadius: 8, padding: 12, background: "#111113" }}>
      <div style={{ fontWeight: 600, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function RadioRow({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      {options.map(([val, label]) => (
        <label key={val} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input
            type="radio"
            name={name}
            checked={value === val}
            onChange={() => onChange(val)}
          />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: "100%", maxWidth: 420, padding: 8, background: "#111113", color: "#e4e4e7", border: "1px solid #3f3f46", borderRadius: 6 }}
    >
      {options.map(([val, lab]) => (
        <option key={val} value={val}>{lab}</option>
      ))}
    </select>
  );
}

function ChipRow({
  selected,
  onToggle,
  options,
}: {
  selected: Set<string>;
  onToggle: (flag: string) => void;
  options: [string, string][];
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {options.map(([val, label]) => {
        const active = selected.has(val);
        return (
          <button
            key={val}
            onClick={() => onToggle(val)}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid #3f3f46",
              background: active ? "#2563eb" : "#111113",
              color: active ? "#0a0a0a" : "#e4e4e7",
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
