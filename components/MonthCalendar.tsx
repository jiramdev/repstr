"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export default function MonthCalendar({
  workoutDates,
  todayKey,
}: {
  workoutDates: string[];
  todayKey: string;
}) {
  const trained = new Set(workoutDates);
  const [todayYear, todayMonth] = todayKey.split("-").map(Number);
  const [cursor, setCursor] = useState({ year: todayYear, month: todayMonth });

  const firstWeekday = new Date(Date.UTC(cursor.year, cursor.month - 1, 1)).getUTCDay();
  const startPad = (firstWeekday + 6) % 7;
  const daysInMonth = new Date(Date.UTC(cursor.year, cursor.month, 0)).getUTCDate();
  const atCurrentMonth = cursor.year === todayYear && cursor.month === todayMonth;

  const label = new Date(Date.UTC(cursor.year, cursor.month - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const monthPrefix = `${cursor.year}-${pad(cursor.month)}-`;
  const sessions = workoutDates.filter((date) => date.startsWith(monthPrefix)).length;

  function shift(delta: number) {
    setCursor((current) => {
      const next = current.month + delta;
      const year = current.year + Math.floor((next - 1) / 12);
      const month = ((next - 1) % 12) + 1;
      if (year > todayYear || (year === todayYear && month > todayMonth)) return current;
      return { year, month };
    });
  }

  return (
    <section className="bg-[#141416] border border-white/[0.08] rounded-[30px] p-5 shadow-[0_12px_28px_rgba(0,0,0,0.2)]">
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => shift(-1)}
          className="w-8 h-8 rounded-full flex items-center justify-center text-[#baa3d0] active:bg-white/10"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-center">
          <p className="font-editorial text-[18px] tracking-wider text-white leading-none uppercase">
            {label}
          </p>
          <p className="mt-1.5 text-[11px] text-[#a1a1aa]">
            {sessions === 1 ? "1 workout" : `${sessions} workouts`}
          </p>
        </div>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => shift(1)}
          disabled={atCurrentMonth}
          className="w-8 h-8 rounded-full flex items-center justify-center text-[#baa3d0] active:bg-white/10 disabled:opacity-30"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1.5 mt-4">
        {WEEKDAYS.map((day) => (
          <span
            key={day}
            className="text-center text-[9px] font-semibold tracking-[0.12em] text-[#71717a]"
          >
            {day}
          </span>
        ))}
        {Array.from({ length: startPad }, (_, index) => (
          <span key={`pad-${index}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const key = `${cursor.year}-${pad(cursor.month)}-${pad(day)}`;
          const didTrain = trained.has(key);
          const isToday = key === todayKey;
          return (
            <div key={key} className="flex justify-center">
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-medium ${
                  didTrain
                    ? "bg-[#baa3d0] text-[#141416]"
                    : isToday
                      ? "text-white ring-1 ring-[#baa3d0]"
                      : "text-[#a1a1aa]"
                }`}
              >
                {day}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
