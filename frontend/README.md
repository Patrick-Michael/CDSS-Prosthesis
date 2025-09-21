# Frontend – CDSS-Prosthesis

This folder contains the **frontend application** for the Prosthodontic Clinical Decision Support System (CDSS).  
It is a React + TypeScript + Vite app that provides the user interface for case input, risk assessment, and plan visualization.

---

## Requirements

- Node.js 18+  
- npm 9+ (comes with Node.js)

---

## Setup

### 1. Install dependencies

```bash
cd frontend
npm install
```

### 2. Run the development server

```bash
npm run dev
```
This will start the frontend at: http://localhost:5173

---

## Project Structure

* `src/pages/` → Screens for Intake, Abutment, Risk, Plan, and Report

* `src/store.ts` → Global state (Zustand)

* `src/api.ts` → API calls to the backend

* `src/App.tsx` → Router and entry point

---

## Development Notes

* The frontend consumes the backend API (`/api/ontology`, `/api/plan`) for data.

* Use `ReportPage` to generate and print case reports (PDF-ready via browser print).

* Styling and print formatting are handled directly in `ReportPage.tsx`.

