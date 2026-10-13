"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
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

const fieldClass =
  "w-full bg-[#1b1b1e] border border-white/[0.04] rounded-2xl px-4 py-3 text-[14px] text-white placeholder-[#71717a] outline-none focus:border-[#baa3d0]";

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
    if (!name.trim()) return setFormError("Vul een naam in.");
    if (sets === null) return setFormError("Standaard sets moet tussen 1 en 20 liggen.");
    if (rest === null) return setFormError("Rusttijd moet tussen 0 en 600 seconden liggen.");
    if (goal === undefined) return setFormError("Doel moet tussen 1 en 10000 liggen.");
    setFormError(null);
    const result = await createExercise({
      name: name.trim(),
      tracking,
      defaultSets: sets,
      repGoal: goal,
      restSeconds: rest,
    });
    if (!("success" in result) || typeof result.id !== "string") {
      setFormError(!("success" in result) ? result.error : "Opslaan mislukt.");
      return;
    }
    setItems((current) =>
      [...current, { id: result.id, name: name.trim(), tracking, defaultSets: sets, repGoal: goal, restSeconds: rest, archived: false }].sort((a, b) =>
        a.name.localeCompare(b.name, "nl")
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
    if (!editName.trim()) return setEditError("Vul een naam in.");
    if (sets === null) return setEditError("Standaard sets moet tussen 1 en 20 liggen.");
    if (rest === null) return setEditError("Rusttijd moet tussen 0 en 600 seconden liggen.");
    if (goal === undefined) return setEditError("Doel moet tussen 1 en 10000 liggen.");
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
    if (next && !confirm(`“${item.name}” archiveren? Hij verdwijnt uit de keuzelijsten.`)) return;
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
            Oefeningen
          </span>
          <button
            type="button"
            onClick={() => setIsCreating(!isCreating)}
            aria-label="Oefening toevoegen"
            className="flex items-center gap-1 text-[11px] font-semibold tracking-[0.18em] text-[#baa3d0] uppercase"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            Nieuw
          </button>
        </div>

        {isCreating && (
          <form onSubmit={handleCreate} className="space-y-2">
            <input
              type="text"
              placeholder="Naam, bijv. Squat"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={80}
              className={fieldClass}
            />
            <div className="grid grid-cols-3 gap-2">
              {TRACKING_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTracking(option.id)}
                  className={`py-2.5 rounded-2xl text-[11px] uppercase tracking-wider font-semibold ${
                    tracking === option.id
                      ? "bg-[#baa3d0] text-[#141416]"
                      : "bg-[#1b1b1e] border border-white/[0.04] text-[#a1a1aa]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                inputMode="numeric"
                aria-label="Standaard sets"
                placeholder="Sets"
                value={defaultSets}
                onChange={(e) => setDefaultSets(e.target.value.replace(/[^\d]/g, ""))}
                className={`${fieldClass} text-center`}
              />
              <input
                type="text"
                inputMode="numeric"
                aria-label="Doel reps of seconden"
                placeholder="Doel"
                value={repGoal}
                onChange={(e) => setRepGoal(e.target.value.replace(/[^\d]/g, ""))}
                className={`${fieldClass} text-center`}
              />
              <input
                type="text"
                inputMode="numeric"
                aria-label="Rust in seconden"
                placeholder="Rust"
                value={restSeconds}
                onChange={(e) => setRestSeconds(e.target.value.replace(/[^\d]/g, ""))}
                className={`${fieldClass} text-center`}
              />
            </div>
            {formError && <p className="px-1 text-[12px] text-red-300">{formError}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-[#baa3d0] text-[#141416] font-semibold py-3 rounded-2xl text-[12px] uppercase tracking-wider apple-press"
              >
                Toevoegen
              </button>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 bg-[#1b1b1e] border border-white/[0.04] text-[#a1a1aa] py-3 rounded-2xl text-[12px] uppercase tracking-wider"
              >
                Annuleer
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2 pt-1">
          {visible.length === 0 ? (
            <div className="bg-[#1b1b1e] rounded-2xl px-4 py-3 border border-white/[0.04]">
              <span className="text-[14px] font-medium text-[#71717a]">Nog geen oefeningen</span>
            </div>
          ) : (
            visible.map((item) => (
              <div
                key={item.id}
                className="bg-[#1b1b1e] border border-white/[0.04] rounded-2xl px-4 py-3"
              >
                {editingId === item.id ? (
                  <form onSubmit={handleSave} className="space-y-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                      maxLength={80}
                      aria-label="Naam van de oefening"
                      className="w-full bg-[#141416] border border-white/[0.08] rounded-2xl px-4 py-3 text-[14px] text-white outline-none focus:border-[#baa3d0]"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      {TRACKING_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setEditTracking(option.id)}
                          className={`py-2.5 rounded-2xl text-[11px] uppercase tracking-wider font-semibold ${
                            editTracking === option.id
                              ? "bg-[#baa3d0] text-[#141416]"
                              : "bg-[#141416] border border-white/[0.08] text-[#a1a1aa]"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label="Standaard sets"
                        value={editSets}
                        onChange={(e) => setEditSets(e.target.value.replace(/[^\d]/g, ""))}
                        className="w-full bg-[#141416] border border-white/[0.08] rounded-2xl px-4 py-3 text-[14px] text-white text-center outline-none focus:border-[#baa3d0]"
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label="Doel reps of seconden"
                        value={editRepGoal}
                        onChange={(e) => setEditRepGoal(e.target.value.replace(/[^\d]/g, ""))}
                        className="w-full bg-[#141416] border border-white/[0.08] rounded-2xl px-4 py-3 text-[14px] text-white text-center outline-none focus:border-[#baa3d0]"
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label="Rust in seconden"
                        value={editRest}
                        onChange={(e) => setEditRest(e.target.value.replace(/[^\d]/g, ""))}
                        className="w-full bg-[#141416] border border-white/[0.08] rounded-2xl px-4 py-3 text-[14px] text-white text-center outline-none focus:border-[#baa3d0]"
                      />
                    </div>
                    {editError && <p className="text-[12px] text-red-300">{editError}</p>}
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="flex-1 bg-[#baa3d0] text-[#141416] font-semibold py-3 rounded-2xl text-[12px] uppercase tracking-wider apple-press"
                      >
                        Opslaan
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-4 bg-[#141416] border border-white/[0.08] text-[#a1a1aa] py-3 rounded-2xl text-[12px] uppercase tracking-wider"
                      >
                        Annuleer
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium text-white truncate">{item.name}</p>
                      <p className="text-[11px] text-[#71717a]">
                        {trackingLabel(item.tracking)} · {item.defaultSets} sets
                        {item.repGoal != null
                          ? ` · doel ${item.repGoal} ${item.tracking === "hold" ? "sec" : "reps"}`
                          : ""}
                        {` · rust ${item.restSeconds}s`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      aria-label={`${item.name} bewerken`}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[#a1a1aa] hover:text-white apple-press shrink-0"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleArchive(item)}
                      aria-label={item.archived ? `${item.name} terugzetten` : `${item.name} archiveren`}
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
            {showArchived ? "Gearchiveerd verbergen" : `Gearchiveerd tonen (${archivedCount})`}
          </button>
        )}
      </section>
    </div>
  );
}
