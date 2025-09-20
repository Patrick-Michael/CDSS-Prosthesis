// src/components/ToothChartFDI.tsx
import { useMemo, useState } from "react";
import type { MouseEvent } from "react";

const UPPER: string[] = [
  ...Array.from({ length: 8 }, (_, i) => String(18 - i)),
  ...Array.from({ length: 8 }, (_, i) => String(21 + i)),
];
const LOWER: string[] = [
  ...Array.from({ length: 8 }, (_, i) => String(48 - i)),
  ...Array.from({ length: 8 }, (_, i) => String(31 + i)),
];

type Arch = "maxilla" | "mandible";
const getArch = (code: string): Arch =>
  code[0] === "1" || code[0] === "2" ? "maxilla" : "mandible";
const getArchArray = (arch: Arch) => (arch === "maxilla" ? UPPER : LOWER);

function toothLabel(code: string) {
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
  return `${code} • ${quadName[code[0]]} ${posName[code[1]] ?? ""}`.trim();
}

export type ToothChartFDIProps = {
  missing: Set<string>;
  abutments: Set<string>;
  onUpdateMissing: (next: Set<string>) => void;
  onOpenAbutmentDrawer: (tooth: string, isAbutment: boolean) => void;
  toothSize?: number;
  gap?: number;     // regular gap between adjacent teeth
  midGap?: number;  // extra gap added at the midline (between index 7 and 8)
};

export default function ToothChartFDI({
  missing,
  abutments,
  onUpdateMissing,
  onOpenAbutmentDrawer,
  toothSize = 34,
  gap = 10,
  midGap = 18,
}: ToothChartFDIProps) {
  const [anchor, setAnchor] = useState<string | null>(null);

  const positions = useMemo(() => {
    // Teeth positions with a normal gap and an extra midline gap after index 7
    const xForIndex = (i: number) =>
      i * (toothSize + gap) + (i >= 8 ? midGap : 0);
    const rowWidth = xForIndex(16) + toothSize;
    return { xForIndex, rowWidth };
  }, [toothSize, gap, midGap]);

  const svgWidth = positions.rowWidth;
  const svgHeight = toothSize * 2 + gap * 3 + 50;

  const toggleOne = (code: string) => {
    const next = new Set(missing);
    next.has(code) ? next.delete(code) : next.add(code);
    onUpdateMissing(next);
  };

  const setRange = (a: string, b: string) => {
    const arch = getArch(a);
    if (getArch(b) !== arch) return toggleOne(b);
    const arr = getArchArray(arch);
    const i1 = arr.indexOf(a);
    const i2 = arr.indexOf(b);
    if (i1 < 0 || i2 < 0) return toggleOne(b);
    const [s, e] = i1 <= i2 ? [i1, i2] : [i2, i1];
    const range = arr.slice(s, e + 1);
    const anyPresent = range.some((t) => !missing.has(t));
    const next = new Set(missing);
    if (anyPresent) range.forEach((t) => next.add(t));
    else range.forEach((t) => next.delete(t));
    onUpdateMissing(next);
  };

  const onClick = (code: string, ev: MouseEvent) => {
    if (ev.shiftKey && anchor) setRange(anchor, code);
    else toggleOne(code);
    setAnchor(code);
  };

  const onContext = (code: string, ev: MouseEvent) => {
    ev.preventDefault();
    onOpenAbutmentDrawer(code, abutments.has(code));
  };

  const renderRow = (arch: Arch, yTop: number, teeth: string[]) => {
    // True center between 11 and 21 (or 41 and 31) is half of (gap + midGap)
    const seamX = positions.xForIndex(8) - (gap + midGap) / 2;

    return (
      <g key={arch}>
        <text x={0} y={yTop - 8} fill="#9ca3af" fontSize="11">
          {arch === "maxilla" ? "Maxilla" : "Mandible"}
        </text>

        {teeth.map((code, i) => {
          const x = positions.xForIndex(i);
          const isMissing = missing.has(code);
          const isAbut = abutments.has(code);
          return (
            <g key={code} transform={`translate(${x}, ${yTop})`}>
              <rect
                width={toothSize}
                height={toothSize}
                rx={6}
                ry={6}
                fill={isMissing ? "#3f3f46" : "transparent"}
                stroke={isMissing ? "#a1a1aa" : "#71717a"}
                strokeWidth={1}
                style={{
                  cursor: "pointer",
                  outline: isAbut ? "2px solid rgba(59,130,246,.5)" : "none",
                  transition: "all 120ms",
                }}
                onClick={(e) => onClick(code, e as unknown as MouseEvent)}
                onContextMenu={(e) => onContext(code, e as unknown as MouseEvent)}
              />
              <text
                x={toothSize / 2}
                y={toothSize + 12}
                textAnchor="middle"
                fill="#d4d4d8"
                fontSize="10"
              >
                {code}
              </text>
              <title>{toothLabel(code)}</title>
            </g>
          );
        })}

        {/* dashed midline centered in the total mid-space (gap + midGap) */}
        <line
          x1={seamX}
          y1={yTop - 6}
          x2={seamX}
          y2={yTop + toothSize + 6}
          stroke="#52525b"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
      </g>
    );
  };

  return (
    <svg width="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} aria-label="FDI Tooth Chart">
      {renderRow("maxilla", 20, UPPER)}
      {renderRow("mandible", toothSize + 60, LOWER)}
    </svg>
  );
}
