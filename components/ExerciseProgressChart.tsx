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
  bestReps: number;
  bestHold: number;
}

function formatScore(score: number, tracking: TrackingMode) {
  if (tracking === "weight") return Number(score.toFixed(1));
  return Math.round(score);
}

function unitLabel(tracking: TrackingMode) {
  if (tracking === "weight") return "kg";
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
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20" role="img" aria-label="Progress chart">
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
  const names = Object.keys(series).sort((a, b) => a.localeCompare(b, "en"));
  const [selected, setSelected] = useState(names[0] ?? "");
  const current = selected ? series[selected] : undefined;
  const best = bests.find((row) => row.name === selected);

  if (names.length === 0) {
    return (
      <div className="bg-[#1b1b1e] rounded-2xl px-4 py-3 border border-white/[0.04]">
        <span className="text-[14px] font-medium text-[#71717a]">No progress yet</span>
      </div>
    );
  }

  return (
    <div className="space-y-2 pt-1">
      <select
        aria-label="Exercise for progress chart"
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
            {current.points.length === 1 ? "session" : "sessions"}
          </p>
        </div>
      )}

      {best && (
        <div className="bg-[#1b1b1e] rounded-2xl px-4 py-3 border border-white/[0.04] text-center">
          <p className="text-[10px] font-semibold tracking-[0.18em] text-[#71717a] uppercase">
            {best.tracking === "weight" ? "Top weight" : best.tracking === "reps" ? "Best reps" : "Best hold"}
          </p>
          <p className="font-editorial text-[22px] text-[#baa3d0] leading-none mt-1">
            {best.tracking === "weight"
              ? Number(best.topWeight.toFixed(1))
              : best.tracking === "reps"
                ? best.bestReps
                : best.bestHold}
            <span className="text-[11px] text-[#71717a] font-sans font-medium">
              {" "}
              {best.tracking === "weight" ? "kg" : best.tracking === "reps" ? "reps" : "sec"}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
