"use client";

import { useState } from "react";
import type { TrackingMode } from "@/lib/strength";

interface SeriesPoint {
  date: string;
  score: number;
}

interface Best {
  name: string;
  tracking: TrackingMode;
  topWeight: number;
  e1rm: number;
  bestReps: number;
  bestHold: number;
}

function formatScore(score: number, tracking: TrackingMode) {
  if (tracking === "weight") return Number(score.toFixed(1));
  return Math.round(score);
}

function unitLabel(tracking: TrackingMode) {
  if (tracking === "weight") return "e1RM";
  if (tracking === "reps") return "reps";
  return "sec";
}

function Sparkline({ points }: { points: SeriesPoint[] }) {
  const width = 260;
  const height = 80;
  const pad = 8;
  if (points.length === 0) return null;
  const scores = points.map((point) => point.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const span = max - min || 1;
  const step = points.length === 1 ? 0 : (width - pad * 2) / (points.length - 1);
  const coords = points.map((point, idx) => {
    const x = pad + idx * step;
    const y = height - pad - ((point.score - min) / span) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20" role="img" aria-label="Voortgangsgrafiek">
      <polyline points={coords.join(" ")} fill="none" stroke="#baa3d0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((pair, idx) => {
        const [x, y] = pair.split(",");
        return <circle key={idx} cx={x} cy={y} r="3" fill="#baa3d0" />;
      })}
    </svg>
  );
}

export default function ExerciseProgressChart({
  series,
  bests,
}: {
  series: Record<string, { tracking: TrackingMode; points: SeriesPoint[] }>;
  bests: Best[];
}) {
  const names = Object.keys(series).sort((a, b) => a.localeCompare(b, "nl"));
  const [selected, setSelected] = useState(names[0] ?? "");
  const current = selected ? series[selected] : undefined;
  const best = bests.find((row) => row.name === selected);

  if (names.length === 0) {
    return (
      <div className="bg-[#1b1b1e] rounded-2xl px-4 py-3 border border-white/[0.04]">
        <span className="text-[14px] font-medium text-[#71717a]">Nog geen voortgang</span>
      </div>
    );
  }

  return (
    <div className="space-y-2 pt-1">
      <select
        aria-label="Oefening voor voortgangsgrafiek"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="w-full bg-[#1b1b1e] border border-white/[0.04] rounded-2xl px-4 py-3 text-[14px] text-white outline-none focus:border-[#baa3d0]"
      >
        {names.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>

      {current && (
        <div className="bg-[#1b1b1e] rounded-2xl px-4 py-3 border border-white/[0.04] space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-semibold tracking-[0.18em] text-[#baa3d0] uppercase">
              {unitLabel(current.tracking)}
            </span>
            <span className="font-editorial text-[26px] text-white tracking-wider leading-none">
              {formatScore(current.points.at(-1)?.score ?? 0, current.tracking)}
            </span>
          </div>
          <Sparkline points={current.points.slice(-20)} />
          <p className="text-[11px] text-[#71717a]">
            {current.points[0]?.date} → {current.points.at(-1)?.date} · {current.points.length}{" "}
            {current.points.length === 1 ? "sessie" : "sessies"}
          </p>
        </div>
      )}

      {best && (
        <div className="grid grid-cols-2 gap-2">
          {best.tracking === "weight" ? (
            <>
              <div className="bg-[#1b1b1e] rounded-2xl px-4 py-3 border border-white/[0.04] text-center">
                <p className="text-[10px] font-semibold tracking-[0.18em] text-[#71717a] uppercase">Top</p>
                <p className="font-editorial text-[22px] text-[#baa3d0] leading-none mt-1">
                  {Number(best.topWeight.toFixed(1))}
                  <span className="text-[11px] text-[#71717a] font-sans font-medium"> kg</span>
                </p>
              </div>
              <div className="bg-[#1b1b1e] rounded-2xl px-4 py-3 border border-white/[0.04] text-center">
                <p className="text-[10px] font-semibold tracking-[0.18em] text-[#71717a] uppercase">e1RM</p>
                <p className="font-editorial text-[22px] text-[#baa3d0] leading-none mt-1">
                  {Number(best.e1rm.toFixed(1))}
                  <span className="text-[11px] text-[#71717a] font-sans font-medium"> kg</span>
                </p>
              </div>
            </>
          ) : (
            <div className="col-span-2 bg-[#1b1b1e] rounded-2xl px-4 py-3 border border-white/[0.04] text-center">
              <p className="text-[10px] font-semibold tracking-[0.18em] text-[#71717a] uppercase">
                {best.tracking === "reps" ? "Beste reps" : "Beste hold"}
              </p>
              <p className="font-editorial text-[22px] text-[#baa3d0] leading-none mt-1">
                {best.tracking === "reps" ? best.bestReps : best.bestHold}
                <span className="text-[11px] text-[#71717a] font-sans font-medium">
                  {" "}
                  {best.tracking === "reps" ? "reps" : "sec"}
                </span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
