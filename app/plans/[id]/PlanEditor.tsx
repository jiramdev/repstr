// app/plans/[id]/PlanEditor.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Edit2, GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import {
  updatePlanName,
  addExerciseToPlan,
  updateExercise,
  reorderExercises,
  removeExerciseFromPlan,
  deletePlan,
} from "./actions";
import {
  EXERCISE_LIBRARY,
  TRACKING_OPTIONS,
  libraryMatch,
  type ExerciseTracking,
} from "@/lib/exercise-library";

interface ExerciseItem {
  id: string;
  exerciseId?: string | null;
  name: string;
  tracking?: ExerciseTracking;
  targetSets?: number;
  restSeconds?: number;
  repGoal?: number | null;
}

interface LibraryExercise {
  id: string;
  name: string;
  tracking?: string;
  defaultSets?: number;
  repGoal?: number | null;
  restSeconds?: number;
}

interface DragState {
  id: string;
  pointerId: number;
  startIndex: number;
  overIndex: number;
  startY: number;
  deltaY: number;
  slot: number;
  tops: number[];
}

interface PlanEditorProps {
  planId: string;
  initialName: string;
  exercises: ExerciseItem[];
  library: LibraryExercise[];
}

export default function PlanEditor({
  planId,
  initialName,
  exercises,
  library,
}: PlanEditorProps) {
  const [name, setName] = useState(initialName);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  const [items, setItems] = useState(exercises);
  const itemsRef = useRef(exercises);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const listRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const dragRef = useRef<DragState | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [exerciseName, setExerciseName] = useState("");
  const [tracking, setTracking] = useState<ExerciseTracking>("weight");
  const [targetSets, setTargetSets] = useState("3");
  const [repGoal, setRepGoal] = useState("");
  const [restSeconds, setRestSeconds] = useState("90");
  const [addError, setAddError] = useState<string | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTracking, setEditTracking] = useState<ExerciseTracking>("weight");
  const [editSets, setEditSets] = useState("");
  const [editRepGoal, setEditRepGoal] = useState("");
  const [editRest, setEditRest] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (draggingRef.current) return;
    setItems(exercises);
  }, [exercises]);

  const handleSaveTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsEditingTitle(false);
    await updatePlanName(planId, name);
  };

  function parseCount(value: string, min: number, max: number) {
    if (!value.trim()) return null;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) return null;
    return parsed;
  }

  const handleAddExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    const sets = parseCount(targetSets, 1, 20);
    const rest = parseCount(restSeconds, 0, 600);
    const goal = repGoal.trim() ? parseCount(repGoal, 1, 10000) : null;
    if (!exerciseName.trim()) {
      setAddError("Vul een naam in.");
      return;
    }
    if (sets === null) {
      setAddError("Aantal sets moet tussen 1 en 20 liggen.");
      return;
    }
    if (rest === null) {
      setAddError("Rusttijd moet tussen 0 en 600 seconden liggen.");
      return;
    }
    if (repGoal.trim() && goal === null) {
      setAddError("Doel moet tussen 1 en 10000 liggen.");
      return;
    }
    const key = exerciseName.trim().toLocaleLowerCase("nl");
    const match = library.find((exercise) => exercise.name.trim().toLocaleLowerCase("nl") === key);
    setAddError(null);
    const result = await addExerciseToPlan(planId, exerciseName, sets, rest, match?.id, tracking, goal);
    if (result?.error) {
      setAddError(result.error);
      return;
    }
    setExerciseName("");
    setTracking("weight");
    setTargetSets("3");
    setRepGoal("");
    setRestSeconds("90");
    setIsAddingExercise(false);
  };

  function startEdit(exercise: ExerciseItem) {
    setEditingId(exercise.id);
    setEditName(exercise.name);
    setEditTracking(exercise.tracking ?? "weight");
    setEditSets(String(exercise.targetSets ?? 3));
    setEditRepGoal(exercise.repGoal != null ? String(exercise.repGoal) : "");
    setEditRest(String(exercise.restSeconds ?? 90));
    setEditError(null);
  }

  const handleSaveExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    const sets = parseCount(editSets, 1, 20);
    const rest = parseCount(editRest, 0, 600);
    const goal = editRepGoal.trim() ? parseCount(editRepGoal, 1, 10000) : null;
    if (!editName.trim()) {
      setEditError("Vul een naam in.");
      return;
    }
    if (sets === null) {
      setEditError("Aantal sets moet tussen 1 en 20 liggen.");
      return;
    }
    if (rest === null) {
      setEditError("Rusttijd moet tussen 0 en 600 seconden liggen.");
      return;
    }
    if (editRepGoal.trim() && goal === null) {
      setEditError("Doel moet tussen 1 en 10000 liggen.");
      return;
    }

    const currentName = items.find((exercise) => exercise.id === editingId)?.name ?? "";
    if (editName.trim() !== currentName) {
      const confirmed = window.confirm(
        "Deze naam geldt voor elk schema en alle eerdere logs van deze oefening. Doorgaan?"
      );
      if (!confirmed) return;
    }

    const result = await updateExercise(planId, editingId, editName, sets, rest, editTracking, goal);
    if (result?.error) {
      setEditError(result.error);
      return;
    }
    setItems((current) =>
      current.map((exercise) =>
        exercise.id === editingId
          ? { ...exercise, name: editName.trim(), tracking: editTracking, targetSets: sets, restSeconds: rest, repGoal: goal }
          : exercise
      )
    );
    setEditingId(null);
    setOpenId(null);
  };

  function startDrag(event: React.PointerEvent<HTMLButtonElement>, index: number) {
    if (event.button !== 0 || items.length < 2) return;
    const list = listRef.current;
    if (!list) return;
    const rows = [...list.querySelectorAll<HTMLElement>("[data-exercise-id]")];
    const listTop = list.getBoundingClientRect().top;
    const tops = rows.map((row) => row.getBoundingClientRect().top - listTop);
    const slot =
      tops[index + 1] != null
        ? tops[index + 1] - tops[index]
        : tops[index] - (tops[index - 1] ?? tops[index]);

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const next: DragState = {
      id: items[index].id,
      pointerId: event.pointerId,
      startIndex: index,
      overIndex: index,
      startY: event.clientY,
      deltaY: 0,
      slot,
      tops,
    };
    draggingRef.current = true;
    dragRef.current = next;
    setDrag(next);
  }

  function moveDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const current = dragRef.current;
    if (!current || event.pointerId !== current.pointerId || !listRef.current) return;
    const y = event.clientY - listRef.current.getBoundingClientRect().top;
    let overIndex = current.tops.length - 1;
    for (let i = 0; i < current.tops.length; i++) {
      const mid =
        i < current.tops.length - 1
          ? (current.tops[i] + current.tops[i + 1]) / 2
          : current.tops[i] + current.slot / 2;
      if (y < mid) {
        overIndex = i;
        break;
      }
    }
    const next = { ...current, overIndex, deltaY: event.clientY - current.startY };
    dragRef.current = next;
    setDrag(next);
  }

  async function endDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const current = dragRef.current;
    if (!current || event.pointerId !== current.pointerId) return;
    dragRef.current = null;
    draggingRef.current = false;
    setDrag(null);
    if (current.startIndex === current.overIndex) return;

    const reordered = [...itemsRef.current];
    const [moved] = reordered.splice(current.startIndex, 1);
    reordered.splice(current.overIndex, 0, moved);
    itemsRef.current = reordered;
    setItems(reordered);
    const result = await reorderExercises(
      planId,
      reordered.map((exercise) => exercise.id)
    );
    if (result?.error) setItems(exercises);
  }

  async function moveItem(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= items.length) return;
    const reordered = [...items];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, moved);
    itemsRef.current = reordered;
    setItems(reordered);
    const result = await reorderExercises(
      planId,
      reordered.map((exercise) => exercise.id)
    );
    if (result?.error) setItems(exercises);
  }

  function dragShift(index: number) {
    if (!drag) return 0;
    if (index === drag.startIndex) return drag.deltaY;
    if (drag.overIndex > drag.startIndex && index > drag.startIndex && index <= drag.overIndex) {
      return -drag.slot;
    }
    if (drag.overIndex < drag.startIndex && index < drag.startIndex && index >= drag.overIndex) {
      return drag.slot;
    }
    return 0;
  }

  const handleDeleteExercise = async (exerciseId: string) => {
    setItems((current) => current.filter((exercise) => exercise.id !== exerciseId));
    if (editingId === exerciseId) setEditingId(null);
    setOpenId((current) => (current === exerciseId ? null : current));
    await removeExerciseFromPlan(planId, exerciseId);
  };

  const handleDeletePlan = async () => {
    if (confirm("Weet je zeker dat je dit hele plan wilt verwijderen?")) {
      await deletePlan(planId);
    }
  };

  const fieldClass =
    "w-full bg-[#1b1b1e] border border-white/[0.04] rounded-2xl px-4 py-3 text-[14px] text-white placeholder-[#71717a] outline-none focus:border-[#baa3d0]";
  const ownedNames = new Set(library.map((item) => item.name.trim().toLocaleLowerCase("nl")));
  const exerciseQuery = exerciseName.trim().toLocaleLowerCase("nl");
  // Een oefening mag twee keer in een plan, dus er wordt niets uitgefilterd op gebruik.
  const suggestions = [
    ...library
      .filter((exercise) => {
        if (!exerciseQuery) return true;
        return exercise.name.toLocaleLowerCase("nl").includes(exerciseQuery);
      })
      .map((exercise) => ({
        key: exercise.id,
        id: exercise.id,
        name: exercise.name,
        tracking: (exercise.tracking === "reps" || exercise.tracking === "hold"
          ? exercise.tracking
          : "weight") as ExerciseTracking,
        defaultSets: exercise.defaultSets,
        repGoal: exercise.repGoal,
        restSeconds: exercise.restSeconds,
      })),
    ...EXERCISE_LIBRARY.filter((exercise) => {
      const key = exercise.name.toLocaleLowerCase("nl");
      if (ownedNames.has(key)) return false;
      if (!exerciseQuery) return true;
      return key.includes(exerciseQuery);
    }).map((exercise) => ({
      key: `library:${exercise.name}`,
      id: null as string | null,
      name: exercise.name,
      tracking: exercise.tracking,
      defaultSets: undefined as number | undefined,
      repGoal: undefined as number | null | undefined,
      restSeconds: undefined as number | undefined,
    })),
  ].slice(0, 12);
  const exactOwn = library.find(
    (exercise) => exercise.name.trim().toLocaleLowerCase("nl") === exerciseQuery
  );
  const showTracking = !exactOwn;

  return (
    <div className="space-y-3.5">
      <section className="bg-[#141416] border border-white/[0.08] rounded-[30px] p-5 space-y-3 shadow-[0_12px_28px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold tracking-[0.18em] text-[#baa3d0] uppercase">
            Plan
          </span>
        </div>

        {isEditingTitle ? (
          <form onSubmit={handleSaveTitle} className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className={`flex-1 ${fieldClass}`}
            />
            <button
              type="submit"
              className="bg-[#baa3d0] text-[#141416] font-semibold px-4 rounded-2xl text-[12px] uppercase tracking-wider apple-press"
            >
              Opslaan
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setIsEditingTitle(true)}
            className="w-full bg-[#1b1b1e] rounded-2xl px-4 py-3 flex items-center justify-between gap-3 border border-white/[0.04] apple-press"
          >
            <span className="text-[14px] font-medium text-white shrink-0">Naam</span>
            <span className="font-editorial text-[22px] text-[#baa3d0] tracking-wider leading-none truncate">
              {name}
            </span>
          </button>
        )}
      </section>

      <section className="bg-[#141416] border border-white/[0.08] rounded-[30px] p-5 space-y-3 shadow-[0_12px_28px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold tracking-[0.18em] text-[#baa3d0] uppercase">
            Oefeningen
          </span>
          <button
            type="button"
            onClick={() => setIsAddingExercise(!isAddingExercise)}
            aria-label="Oefening toevoegen"
            className="flex items-center gap-1 text-[11px] font-semibold tracking-[0.18em] text-[#baa3d0] uppercase"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            Nieuw
          </button>
        </div>

        {isAddingExercise && (
          <form onSubmit={handleAddExercise} className="space-y-2">
            <input
              type="text"
              placeholder="Zoek of maak een oefening"
              value={exerciseName}
              onChange={(e) => {
                const value = e.target.value;
                setExerciseName(value);
                const own = library.find(
                  (exercise) => exercise.name.trim().toLocaleLowerCase("nl") === value.trim().toLocaleLowerCase("nl")
                );
                const fromLibrary = libraryMatch(value);
                if (own?.tracking === "reps" || own?.tracking === "hold" || own?.tracking === "weight") {
                  setTracking(own.tracking);
                } else if (fromLibrary) {
                  setTracking(fromLibrary.tracking);
                }
              }}
              autoFocus
              className={fieldClass}
            />
            {suggestions.length > 0 && (
              <div className="max-h-40 space-y-2 overflow-y-auto">
                {suggestions.map((exercise) => {
                  const selected =
                    exercise.name.trim().toLocaleLowerCase("nl") === exerciseQuery;
                  return (
                    <button
                      key={exercise.key}
                      type="button"
                      onClick={() => {
                        setExerciseName(exercise.name);
                        setTracking(exercise.tracking);
                        if (exercise.defaultSets) setTargetSets(String(exercise.defaultSets));
                        if (exercise.repGoal != null) setRepGoal(String(exercise.repGoal));
                        if (exercise.restSeconds) setRestSeconds(String(exercise.restSeconds));
                      }}
                      className={`w-full bg-[#1b1b1e] rounded-2xl px-4 py-3 flex items-center justify-between gap-3 border text-left apple-press ${
                        selected ? "border-[#baa3d0]" : "border-white/[0.04]"
                      }`}
                    >
                      <span className="text-[14px] font-medium text-white truncate">
                        {exercise.name}
                      </span>
                      <span className="text-[11px] text-[#71717a] shrink-0">
                        {TRACKING_OPTIONS.find((option) => option.id === exercise.tracking)?.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {showTracking && (
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
            )}
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                inputMode="numeric"
                aria-label="Sets"
                placeholder="Sets"
                value={targetSets}
                onChange={(e) => setTargetSets(e.target.value.replace(/[^\d]/g, ""))}
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
            <p className="px-1 text-[12px] leading-snug text-[#71717a]">
              Een oefening mag twee keer in een plan voorkomen.
            </p>
            {addError && <p className="px-1 text-[12px] text-red-300">{addError}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-[#baa3d0] text-[#141416] font-semibold py-3 rounded-2xl text-[12px] uppercase tracking-wider apple-press"
              >
                Toevoegen
              </button>
              <button
                type="button"
                onClick={() => setIsAddingExercise(false)}
                className="px-4 bg-[#1b1b1e] border border-white/[0.04] text-[#a1a1aa] py-3 rounded-2xl text-[12px] uppercase tracking-wider"
              >
                Annuleer
              </button>
            </div>
          </form>
        )}

        <div ref={listRef} className="space-y-2 pt-1">
          {items.length === 0 ? (
            <div className="bg-[#1b1b1e] rounded-2xl px-4 py-3 flex items-center border border-white/[0.04]">
              <span className="text-[14px] font-medium text-[#71717a]">Nog geen oefeningen</span>
            </div>
          ) : (
            items.map((ex, idx) => (
              <div
                key={ex.id}
                data-exercise-id={ex.id}
                className={`bg-[#1b1b1e] border border-white/[0.04] rounded-2xl px-4 py-3 ${
                  drag?.id === ex.id ? "shadow-[0_16px_32px_rgba(0,0,0,0.45)]" : ""
                }`}
                style={
                  drag
                    ? {
                        position: "relative",
                        zIndex: drag.id === ex.id ? 20 : 1,
                        transform: `translateY(${dragShift(idx)}px)`,
                        transition: drag.id === ex.id ? "none" : "transform 160ms ease",
                      }
                    : undefined
                }
              >
                {editingId === ex.id ? (
                  <form onSubmit={handleSaveExercise} className="space-y-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                      aria-label="Naam van de oefening"
                      className="w-full bg-[#141416] border border-white/[0.08] rounded-2xl px-4 py-3 text-[14px] text-white outline-none focus:border-[#baa3d0]"
                    />
                    <p className="px-1 text-[12px] leading-snug text-[#baa3d0]">
                      Een andere naam geldt voor elk schema en alle eerdere logs van deze oefening.
                    </p>
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
                        aria-label="Sets"
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
                  <div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Versleep om te herschikken"
                        onPointerDown={(event) => startDrag(event, idx)}
                        onPointerMove={moveDrag}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                        className="w-6 h-8 flex items-center justify-center text-[#52525b] touch-none cursor-grab active:cursor-grabbing shrink-0"
                      >
                        <GripVertical className="w-4 h-4" />
                      </button>
                      <div className="flex flex-col">
                        <button
                          type="button"
                          aria-label={`${ex.name} omhoog`}
                          disabled={idx === 0}
                          onClick={() => moveItem(idx, -1)}
                          className="w-6 h-4 flex items-center justify-center text-[#71717a] disabled:opacity-30"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`${ex.name} omlaag`}
                          disabled={idx === items.length - 1}
                          onClick={() => moveItem(idx, 1)}
                          className="w-6 h-4 flex items-center justify-center text-[#71717a] disabled:opacity-30"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOpenId((current) => (current === ex.id ? null : ex.id))}
                        aria-expanded={openId === ex.id}
                        className="min-w-0 flex-1 flex items-center gap-2 text-left"
                      >
                        <span className="min-w-0 flex-1 text-[14px] font-medium text-white truncate">
                          {ex.name}
                        </span>
                        <span className="font-editorial text-[22px] text-[#baa3d0] tracking-wider leading-none shrink-0">
                          {ex.targetSets ?? 3}
                          <span className="px-1">·</span>
                          {ex.restSeconds ?? 90}
                          {ex.repGoal != null && (
                            <>
                              <span className="px-1">·</span>
                              {ex.repGoal}
                            </>
                          )}
                        </span>
                      </button>
                    </div>
                    {openId === ex.id && (
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(ex)}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-[#141416] border border-white/[0.08] text-white py-2.5 rounded-2xl text-[12px] uppercase tracking-wider font-semibold apple-press"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Bewerk
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteExercise(ex.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-[#141416] border border-white/[0.08] text-red-300 py-2.5 rounded-2xl text-[12px] uppercase tracking-wider font-semibold apple-press"
                        >
                          <Trash2 className="w-3.5 h-3.5 stroke-[1.8]" />
                          Verwijder
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <button
        type="button"
        onClick={handleDeletePlan}
        className="w-full bg-[#141416] border border-white/[0.08] rounded-[30px] px-5 py-4 text-[14px] font-medium text-red-300 shadow-[0_12px_28px_rgba(0,0,0,0.2)] apple-press"
      >
        Plan verwijderen
      </button>
    </div>
  );
}