"use client";

import { Minus, Plus } from "lucide-react";
import { TRACKING_OPTIONS, type ExerciseTracking } from "@/lib/exercise-library";

export const fieldLabelClass =
  "px-1 text-[10px] font-semibold tracking-[0.14em] text-[#71717a] uppercase";

export const darkFieldClass =
  "w-full bg-[#141416] border border-white/[0.08] rounded-2xl px-4 py-3 text-[14px] text-white outline-none focus:border-[#baa3d0]";

export function Stepper({
  label,
  unit,
  value,
  placeholder,
  min,
  max,
  onChange,
}: {
  label: string;
  unit: string;
  value: string;
  placeholder?: string;
  min: number;
  max: number;
  onChange: (value: string) => void;
}) {
  const current = value.trim() ? Number(value) : null;
  function step(delta: number) {
    if (current == null || !Number.isInteger(current)) {
      onChange(String(delta > 0 ? min : max));
      return;
    }
    const next = current + delta;
    if (next < min) {
      onChange("");
      return;
    }
    if (next > max) return;
    onChange(String(next));
  }
  return (
    <div className="space-y-1">
      <span className={fieldLabelClass}>{label}</span>
      <div className="flex items-stretch gap-1.5">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label={`Decrease ${label}`}
          className="w-11 shrink-0 bg-[#1b1b1e] border border-white/[0.04] rounded-2xl flex items-center justify-center text-[#a1a1aa] apple-press"
        >
          <Minus className="w-4 h-4" />
        </button>
        <div className="relative flex-1">
          <input
            type="text"
            inputMode="numeric"
            aria-label={label}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
            className="w-full bg-[#1b1b1e] border border-white/[0.04] rounded-2xl pl-4 pr-10 py-3 text-center text-[17px] font-semibold text-white placeholder-[#71717a] placeholder:text-[14px] placeholder:font-normal outline-none focus:border-[#baa3d0]"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#71717a] pointer-events-none">
            {unit}
          </span>
        </div>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label={`Increase ${label}`}
          className="w-11 shrink-0 bg-[#1b1b1e] border border-white/[0.04] rounded-2xl flex items-center justify-center text-[#a1a1aa] apple-press"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function TypeSegmented({
  value,
  onChange,
}: {
  value: ExerciseTracking;
  onChange: (tracking: ExerciseTracking) => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className={fieldLabelClass}>Type</span>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Exercise type">
        {TRACKING_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={value === option.id}
            onClick={() => onChange(option.id)}
            className={`py-2.5 rounded-2xl text-[11px] uppercase tracking-wider font-semibold apple-press ${
              value === option.id
                ? "bg-[#baa3d0] text-[#141416]"
                : "bg-[#1b1b1e] border border-white/[0.04] text-[#a1a1aa]"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="px-1 text-[12px] leading-snug text-[#71717a]">{trackingHint(value)}</p>
    </div>
  );
}

export function trackingHint(tracking: ExerciseTracking) {
  if (tracking === "weight") return "Log the lifted weight in kg plus reps per set.";
  if (tracking === "reps") return "Log reps per set using your own body weight.";
  return "Log the held seconds per set.";
}

export function SaveButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="flex-1 bg-[#baa3d0] text-[#141416] font-semibold py-3 rounded-2xl text-[12px] uppercase tracking-wider apple-press"
    >
      {children}
    </button>
  );
}

export function CancelButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-4 bg-[#141416] border border-white/[0.08] text-[#a1a1aa] py-3 rounded-2xl text-[12px] uppercase tracking-wider"
    >
      Cancel
    </button>
  );
}
