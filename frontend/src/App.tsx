// src/App.tsx
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import IntakeScreen from "./pages/IntakeScreen";
import AbutmentScreen from "./pages/AbutmentScreen";
import PatientRiskScreen from "./pages/PatientRiskScreen";
import PlanScreen from "./pages/PlanScreen";
import ReportPage from "./pages/ReportPage";

import { useAppStore } from "./store";
import { fetchOntology } from "./api";

export default function App() {
  const ontology = useAppStore((s) => s.ontology);
  const setOntology = useAppStore((s) => s.setOntology);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // If your backend route is `/api/ontology`, make sure fetchOntology() calls that.
        if (!ontology) {
          const o = await fetchOntology();
          if (!cancelled) setOntology(o);
        }
      } catch (err) {
        if (!cancelled) setOntology(null);
        // optional: console.error("fetchOntology failed:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ontology, setOntology]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<IntakeScreen />} />
        <Route path="/abutments" element={<AbutmentScreen />} />
        <Route path="/risk" element={<PatientRiskScreen />} />
        <Route path="/plan" element={<PlanScreen />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
