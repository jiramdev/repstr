// app/schedule/ScheduleManager.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import Prefetch from "@/components/Prefetch";
import { popTransition } from "@/lib/motion";
import { Plus, ChevronRight, Calendar } from "lucide-react";
import { assignPlanToDay, createWorkoutPlan } from "./actions";

interface Plan {
  id: string;
  name: string;
  exercisesCount: number;
}

interface ScheduleManagerProps {
  plans: Plan[];
  initialDays: Record<number, string>; // dayOfWeek -> planId
}

const DAYS_OF_WEEK = [
  { day: 1, name: "Monday", short: "MO" },
  { day: 2, name: "Tuesday", short: "TU" },
  { day: 3, name: "Wednesday", short: "WE" },
  { day: 4, name: "Thursday", short: "TH" },
  { day: 5, name: "Friday", short: "FR" },
  { day: 6, name: "Saturday", short: "SA" },
  { day: 0, name: "Sunday", short: "SU" },
];

export default function ScheduleManager({ plans, initialDays }: ScheduleManagerProps) {
  const [dayAssignments, setDayAssignments] = useState(initialDays);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");

  const handleSelectPlanForDay = async (day: number, planId: string | null) => {
    setDayAssignments((prev) => {
      const copy = { ...prev };
      if (planId) copy[day] = planId;
      else delete copy[day];
      return copy;
    });
    await assignPlanToDay(day, planId);
  };

  // Create a new plan
  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanName.trim()) return;
    await createWorkoutPlan(newPlanName);
    setNewPlanName("");
    setIsCreatingPlan(false);
  };

  return (
    <div className="space-y-4">
      <Prefetch hrefs={plans.map((plan) => `/plans/${plan.id}`)} />
      {/* 1. Week schedule overview (Mon through Sun) */}
      <section className="bg-[#141416] border border-white/[0.08] rounded-[30px] px-2 py-3 shadow-[0_12px_28px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-between px-3 pb-1">
          <span className="text-[11px] font-semibold tracking-[0.18em] text-[#baa3d0] uppercase">
            Week schedule
          </span>
          <Calendar className="w-3.5 h-3.5 text-[#baa3d0]" />
        </div>

        <div className="grid grid-cols-4 gap-2 px-2 pt-2">
          {DAYS_OF_WEEK.map(({ day, name, short }) => {
            const currentPlan = plans.find((p) => p.id === dayAssignments[day]);

            return (
              <div
                key={day}
                className="relative aspect-square rounded-2xl border border-white/[0.04] bg-[#1b1b1e] flex flex-col items-center justify-center gap-1 px-1"
              >
                <span className="font-editorial text-[20px] tracking-wider leading-none text-white">
                  {short}
                </span>
                <span
                  className={`w-full text-center text-[9px] font-semibold tracking-[0.08em] uppercase leading-none truncate ${
                    currentPlan ? "text-[#baa3d0]" : "text-[#71717a]"
                  }`}
                >
                  {currentPlan ? currentPlan.name : "Rest"}
                </span>
                <select
                  aria-label={name}
                  data-no-swipe
                  value={currentPlan ? currentPlan.id : ""}
                  onChange={(event) => handleSelectPlanForDay(day, event.target.value || null)}
                  className="absolute inset-0 h-full w-full cursor-pointer select-auto text-base opacity-0"
                >
                  <option value="">Rest day</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. Manage and create training plans */}
      <section className="bg-[#141416] border border-white/[0.08] rounded-[30px] p-5 space-y-3 shadow-[0_12px_28px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold tracking-[0.18em] text-[#baa3d0] uppercase">
            {"My plans"}
          </span>
          <button
            type="button"
            onClick={() => setIsCreatingPlan(!isCreatingPlan)}
            aria-label="New plan"
            className="flex items-center gap-1 text-[11px] font-semibold tracking-[0.18em] text-[#baa3d0] uppercase"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            New
          </button>
        </div>

        <AnimatePresence>
        {isCreatingPlan && (
          <motion.form
            onSubmit={handleCreatePlan}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={popTransition}
            className="flex gap-2"
          >
            <input
              type="text"
              placeholder="E.g. Push A"
              value={newPlanName}
              onChange={(e) => setNewPlanName(e.target.value)}
              autoFocus
              className="flex-1 bg-[#1b1b1e] border border-white/[0.04] rounded-2xl px-4 py-3 text-[14px] text-white placeholder-[#71717a] outline-none focus:border-[#baa3d0]"
            />
            <button
              type="submit"
              className="bg-[#baa3d0] text-[#141416] font-semibold px-4 rounded-2xl text-[12px] uppercase tracking-wider apple-press"
            >
              Save
            </button>
          </motion.form>
        )}
        </AnimatePresence>

        <div className="space-y-2 pt-1">
          {plans.length === 0 ? (
            <div className="bg-[#1b1b1e] rounded-2xl px-4 py-3 flex items-center justify-between border border-white/[0.04]">
              <span className="text-[14px] font-medium text-[#71717a]">{"No plans yet"}</span>
            </div>
          ) : (
            plans.map((p) => (
              <Link
                key={p.id}
                href={`/plans/${p.id}`}
                prefetch={true}
                className="bg-[#1b1b1e] rounded-2xl px-4 py-3 flex items-center justify-between gap-3 border border-white/[0.04] apple-press"
              >
                <span className="text-[14px] font-medium text-white truncate">{p.name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-editorial text-[22px] text-[#baa3d0] tracking-wider leading-none">
                    {p.exercisesCount}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#52525b]" />
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      {/* 3. Exercise library, below the schedules and plans */}
      <Link
        href="/exercises"
        prefetch={true}
        className="bg-[#141416] border border-white/[0.08] rounded-[30px] px-5 py-4 flex items-center justify-between gap-3 shadow-[0_12px_28px_rgba(0,0,0,0.2)] apple-press"
      >
        <span className="text-[11px] font-semibold tracking-[0.18em] text-[#baa3d0] uppercase">
          Manage exercises
        </span>
        <ChevronRight className="w-4 h-4 text-[#52525b]" />
      </Link>
    </div>
  );
}