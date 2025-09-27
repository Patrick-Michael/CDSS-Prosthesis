// src/store.ts
import { create } from "zustand";
import type { EnumsResponse, SpansResponse, Ontology } from "./api";

/* ---------------- Types ---------------- */

export type AbutHealth = {
  status: string;
  mobility_miller: string;
  crown_root_ratio: string;
  enamel_ok_for_rbb: boolean;
};

export type PatientRisk = {
  caries_risk: string;
  occlusal_scheme: string;
  parafunction: string;
  opposing_dentition: string;
  systemic_flags: string[];
};

type AppState = {
  // Data
  missing: Set<string>;
  preview: SpansResponse | null;
  enums: EnumsResponse | null;
  abutmentHealth: Record<string, AbutHealth>;
  patientRisk: PatientRisk;

  // Actions
  setMissing: (next: Set<string>) => void;
  setPreview: (p: SpansResponse | null) => void;

  /** Set enums from backend and, if this is the first time or after a reset, initialize patient risk from enums */
  setEnums: (e: EnumsResponse | null) => void;

  ensureAbutmentDefaults: (tooth: string, defaults: AbutHealth) => void;
  patchAbutment: (tooth: string, patch: Partial<AbutHealth>, defaults: AbutHealth) => void;

  /** Update patient risk fields (never auto-correct values silently) */
  setPatientRisk: (partial: Partial<PatientRisk>) => void;

  toggleSystemicFlag: (flag: string) => void;

  /** Clear in-session case and re-initialize patient risk FROM CURRENT enums */
  resetCase: () => void;

  // Ontology
  ontology: Ontology | null;
  setOntology: (o: Ontology | null) => void;

  // Internal flag: have we already initialized patientRisk from enums at least once?
  _riskInitialized: boolean;
};

/* ----------- Helpers (enum-derived defaults) ----------- */

function firstVal(pairs?: [string, string][], fallback = ""): string {
  return pairs && pairs.length ? pairs[0][0] : fallback;
}

function buildPatientRiskFromEnums(enums: EnumsResponse | null): PatientRisk {
  return {
    caries_risk: firstVal(enums?.caries_options, "low"),
    occlusal_scheme: firstVal(enums?.occlusion_options, "Favorable"),
    parafunction: firstVal(enums?.parafunction_options, "none"),
    opposing_dentition: firstVal(enums?.opposing_options, "natural"),
    systemic_flags: [],
  };
}

/* ---------------- Store ---------------- */

export const useAppStore = create<AppState>()((set) => ({
  // Data
  missing: new Set<string>(),
  preview: null,
  enums: null,
  abutmentHealth: {},

  // Start with neutral, but valid-looking placeholders; we’ll overwrite on first /enums load
  patientRisk: {
    caries_risk: "low",
    occlusal_scheme: "Favorable",
    parafunction: "none",
    opposing_dentition: "natural",
    systemic_flags: [],
  },

  // Actions
  setMissing: (next) => set({ missing: new Set(next) }),
  setPreview: (p) => set({ preview: p }),

  setEnums: (e) =>
    set((s) => {
      // Set enums
      const next: Partial<AppState> = { enums: e };

      // Initialize patientRisk from enums ONLY if not yet initialized in this session.
      if (!s._riskInitialized && e) {
        next.patientRisk = buildPatientRiskFromEnums(e);
        next._riskInitialized = true;
      }
      return next as AppState;
    }),

  ensureAbutmentDefaults: (tooth, defaults) =>
    set((s) => {
      if (s.abutmentHealth[tooth]) return s;
      return {
        abutmentHealth: { ...s.abutmentHealth, [tooth]: { ...defaults } },
      };
    }),

  patchAbutment: (tooth, patch, defaults) =>
    set((s) => {
      const base = s.abutmentHealth[tooth] ?? { ...defaults };
      return {
        abutmentHealth: {
          ...s.abutmentHealth,
          [tooth]: { ...base, ...patch },
        },
      };
    }),

  setPatientRisk: (partial) =>
    set((s) => ({ patientRisk: { ...s.patientRisk, ...partial } })),

  toggleSystemicFlag: (flag) =>
    set((s) => {
      const cur = new Set(s.patientRisk.systemic_flags);
      cur.has(flag) ? cur.delete(flag) : cur.add(flag);
      return { patientRisk: { ...s.patientRisk, systemic_flags: Array.from(cur) } };
    }),

  resetCase: () =>
    set((s) => {
      // Rebuild risk strictly from the CURRENT enums (single source of truth), no hard-coded strings.
      const rebuiltRisk = buildPatientRiskFromEnums(s.enums);
      return {
        missing: new Set<string>(),
        preview: null,
        abutmentHealth: {},
        patientRisk: rebuiltRisk,
        // do NOT reset enums/ontology
        _riskInitialized: true, // we just re-initialized from enums
      };
    }),

  // Ontology
  ontology: null,
  setOntology: (o) => set({ ontology: o }),

  // Internal
  _riskInitialized: false,
}));

