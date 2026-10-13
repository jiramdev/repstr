"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Minus, Pencil, Plus } from "lucide-react";
import { TRACKING_OPTIONS, type ExerciseTracking } from "@/lib/exercise-library";
import { createExercise, setExerciseArchived, updateExerciseDetails } from "./actions";

export interface LibraryItem {
  id: string;
  name: string;
  tracking: ExerciseTracking;
  defaultSets: number;
  repGoal: number | null;
  restSeconds: number;
  archived: boolean;
}

function trackingLabel(tracking: ExerciseTracking) {
  return TRACKING_OPTIONS.find((option) => option.id === tracking)?.label ?? tracking;
}

function trackingHint(tracking: ExerciseTracking) {
  if (tracking === "weight") return "Log the lifted weight in kg plus reps per set.";
  if (tracking === "reps") return "Log reps per set using your own body weight.";
  return "Log the held seconds per set.";
}

const fieldClass =
  "w-full bg-[#1b1b1e] border border-white/[0.04] rounded-2xl px-4 py-3 text-[14px] text-white placeholder-[#71717a] outline-none focus:border-[#baa3d0]";

const labelClass =
  "px-1 text-[10px] font-semibold tracking-[0.14em] text-[#71717a] uppercase";

function parseOptionalInt(value: string, min: number, max: number): number | null | undefined {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return undefined;
  return parsed;
}

function parseInt(value: string, min: number, max: number): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

function Stepper({
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
      <span className={labelClass}>{label}</span>
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

function TypeSegmented({
  value,
  onChange,
}: {
  value: ExerciseTracking;
  onChange: (tracking: ExerciseTracking) => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className={labelClass}>Type</span>
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

export default function ExerciseLibrary({ initial }: { initial: LibraryItem[] }) {
  const [items, setItems] = useState(initial);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [tracking, setTracking] = useState<ExerciseTracking>("weight");
  const [defaultSets, setDefaultSets] = useState("3");
  const [repGoal, setRepGoal] = useState("");
  const [restSeconds, setRestSeconds] = useState("90");
  const [formError, setFormError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTracking, setEditTracking] = useState<ExerciseTracking>("weight");
  const [editSets, setEditSets] = useState("");
  const [editRepGoal, setEditRepGoal] = useState("");
  const [editRest, setEditRest] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const visible = items.filter((item) => showArchived || !item.archived);
  const archivedCount = items.filter((item) => item.archived).length;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const sets = parseInt(defaultSets, 1, 20);
    const rest = parseInt(restSeconds, 0, 600);
    const goal = parseOptionalInt(repGoal, 1, 10000);
    if (!name.trim()) return setFormError("Enter a name.");
    if (sets === null) return setFormError("Default sets must be between 1 and 20.");
    if (rest === null) return setFormError("Rest must be between 0 and 600 seconds.");
    if (goal === undefined) return setFormError("Target must be between 1 and 10000.");
    setFormError(null);
    const result = await createExercise({
      name: name.trim(),
      tracking,
      defaultSets: sets,
      repGoal: goal,
      restSeconds: rest,
    });
    if (!("success" in result) || typeof result.id !== "string") {
      setFormError(!("success" in result) ? result.error : "Couldn't save.");
      return;
    }
    setItems((current) =>
      [...current, { id: result.id, name: name.trim(), tracking, defaultSets: sets, repGoal: goal, restSeconds: rest, archived: false }].sort((a, b) =>
        a.name.localeCompare(b.name, "en")
      )
    );
    setName("");
    setTracking("weight");
    setDefaultSets("3");
    setRepGoal("");
    setRestSeconds("90");
    setIsCreating(false);
  };

  function startEdit(item: LibraryItem) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditTracking(item.tracking);
    setEditSets(String(item.defaultSets));
    setEditRepGoal(item.repGoal != null ? String(item.repGoal) : "");
    setEditRest(String(item.restSeconds));
    setEditError(null);
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    const sets = parseInt(editSets, 1, 20);
    const rest = parseInt(editRest, 0, 600);
    const goal = parseOptionalInt(editRepGoal, 1, 10000);
    if (!editName.trim()) return setEditError("Enter a name.");
    if (sets === null) return setEditError("Default sets must be between 1 and 20.");
    if (rest === null) return setEditError("Rest must be between 0 and 600 seconds.");
    if (goal === undefined) return setEditError("Target must be between 1 and 10000.");
    setEditError(null);
    const result = await updateExerciseDetails(editingId, {
      name: editName.trim(),
      tracking: editTracking,
      defaultSets: sets,
      repGoal: goal,
      restSeconds: rest,
    });
    if (!("success" in result)) {
      setEditError(result.error);
      return;
    }
    setItems((current) =>
      current.map((item) =>
        item.id === editingId
          ? { ...item, name: editName.trim(), tracking: editTracking, defaultSets: sets, repGoal: goal, restSeconds: rest }
          : item
      )
    );
    setEditingId(null);
  };

  const handleArchive = async (item: LibraryItem) => {
    const next = !item.archived;
    if (next && !confirm(`Archive "${item.name}"? It will disappear from the pickers.`)) return;
    setItems((current) => current.map((row) => (row.id === item.id ? { ...row, archived: next } : row)));
    const result = await setExerciseArchived({ exerciseId: item.id, archived: next });
    if (!("success" in result)) {
      setItems((current) => current.map((row) => (row.id === item.id ? { ...row, archived: item.archived } : row)));
    }
  };

  return (
    <div className="space-y-3.5">
      <section className="bg-[#141416] border border-white/[0.08] rounded-[30px] p-5 space-y-3 shadow-[0_12px_28px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold tracking-[0.18em] text-[#baa3d0] uppercase">
            Exercises
          </span>
          <button
            type="button"
            onClick={() => setIsCreating(!isCreating)}
            aria-label="Add exercise"
            className="flex items-center gap-1 text-[11px] font-semibold tracking-[0.18em] text-[#baa3d0] uppercase"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            New
          </button>
        </div>

        {isCreating && (
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-1">
              <span className={labelClass}>Name</span>
              <input
                type="text"
                placeholder="E.g. Squat"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                maxLength={80}
                className={fieldClass}
              />
            </div>
            <TypeSegmented value={tracking} onChange={setTracking} />
            <Stepper
              label="Default sets"
              unit="sets"
              value={defaultSets}
              placeholder="3"
              min={1}
              max={20}
              onChange={setDefaultSets}
            />
            <Stepper
              label={tracking === "hold" ? "Target (seconds)" : "Target (reps)"}
              unit={tracking === "hold" ? "sec" : "reps"}
              value={repGoal}
              placeholder="None"
              min={1}
              max={10000}
              onChange={setRepGoal}
            />
            <Stepper
              label="Rest"
              unit="s"
              value={restSeconds}
              placeholder="90"
              min={0}
              max={600}
              onChange={setRestSeconds}
            />
            {formError && <p className="px-1 text-[12px] text-red-300">{formError}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-[#baa3d0] text-[#141416] font-semibold py-3 rounded-2xl text-[12px] uppercase tracking-wider apple-press"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 bg-[#1b1b1e] border border-white/[0.04] text-[#a1a1aa] py-3 rounded-2xl text-[12px] uppercase tracking-wider"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2 pt-1">
          {visible.length === 0 ? (
            <div className="bg-[#1b1b1e] rounded-2xl px-4 py-3 border border-white/[0.04]">
              <span className="text-[14px] font-medium text-[#71717a]">No exercises yet</span>
            </div>
          ) : (
            visible.map((item) => (
              <div
                key={item.id}
                className="bg-[#1b1b1e] border border-white/[0.04] rounded-2xl px-4 py-3"
              >
                {editingId === item.id ? (
                  <form onSubmit={handleSave} className="space-y-3">
                    <div className="space-y-1">
                      <span className={labelClass}>Name</span>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                        maxLength={80}
                        aria-label="Exercise name"
                        className="w-full bg-[#141416] border border-white/[0.08] rounded-2xl px-4 py-3 text-[14px] text-white outline-none focus:border-[#baa3d0]"
                      />
                    </div>
                    <TypeSegmented value={editTracking} onChange={setEditTracking} />
                    <Stepper
                      label="Default sets"
                      unit="sets"
                      value={editSets}
                      placeholder="3"
                      min={1}
                      max={20}
                      onChange={setEditSets}
                    />
                    <Stepper
                      label={editTracking === "hold" ? "Target (seconds)" : "Target (reps)"}
                      unit={editTracking === "hold" ? "sec" : "reps"}
                      value={editRepGoal}
                      placeholder="None"
                      min={1}
                      max={10000}
                      onChange={setEditRepGoal}
                    />
                    <Stepper
                      label="Rest"
                      unit="s"
                      value={editRest}
                      placeholder="90"
                      min={0}
                      max={600}
                      onChange={setEditRest}
                    />
                    {editError && <p className="text-[12px] text-red-300">{editError}</p>}
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="flex-1 bg-[#baa3d0] text-[#141416] font-semibold py-3 rounded-2xl text-[12px] uppercase tracking-wider apple-press"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-4 bg-[#141416] border border-white/[0.08] text-[#a1a1aa] py-3 rounded-2xl text-[12px] uppercase tracking-wider"
                      >
                        Cancel
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        handleArchive(item);
                      }}
                      className="w-full text-center text-[12px] font-semibold text-red-300/70 py-1 apple-press"
                    >
                      {item.archived ? "Restore from archive" : "Archive exercise"}
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium text-white truncate">{item.name}</p>
                      <p className="text-[11px] text-[#71717a]">
                        {trackingLabel(item.tracking)} · {item.defaultSets} sets
                        {item.repGoal != null
                          ? ` · target ${item.repGoal} ${item.tracking === "hold" ? "sec" : "reps"}`
                          : ""}
                        {` · rest ${item.restSeconds}s`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      aria-label={`Edit ${item.name}`}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[#a1a1aa] hover:text-white apple-press shrink-0"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleArchive(item)}
                      aria-label={item.archived ? `Restore ${item.name}` : `Archive ${item.name}`}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[#71717a] hover:text-white apple-press shrink-0"
                    >
                      {item.archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {archivedCount > 0 && (
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            className="w-full text-center text-[12px] font-semibold text-[#71717a] apple-press"
          >
            {showArchived ? "Hide archived" : `Show archived (${archivedCount})`}
          </button>
        )}
      </section>
    </div>
  );
}
