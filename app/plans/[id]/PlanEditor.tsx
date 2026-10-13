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
  setsOverride?: number | null;
  restOverride?: number | null;
  repGoalOverride?: number | null;
  defaultSets?: number | null;
  defaultRepGoal?: number | null;
  defaultRest?: number | null;
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

function targetUnit(tracking: ExerciseTracking) {
  return tracking === "hold" ? "sec" : "reps";
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
  const [targetSets, setTargetSets] = useState("");
  const [repGoal, setRepGoal] = useState("");
  const [restSeconds, setRestSeconds] = useState("");
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

  function parseOptionalCount(value: string, min: number, max: number): number | null | undefined {
    if (!value.trim()) return null;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) return undefined;
    return parsed;
  }

  function selectedDefaults() {
    const key = exerciseName.trim().toLocaleLowerCase("en");
    const match = library.find((exercise) => exercise.name.trim().toLocaleLowerCase("en") === key);
    if (!match) return null;
    return {
      sets: match.defaultSets ?? 3,
      goal: match.repGoal,
      rest: match.restSeconds ?? 90,
    };
  }

  const handleAddExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    const sets = parseOptionalCount(targetSets, 1, 20);
    const rest = parseOptionalCount(restSeconds, 0, 600);
    const goal = parseOptionalCount(repGoal, 1, 10000);
    if (!exerciseName.trim()) {
      setAddError("Enter a name.");
      return;
    }
    if (sets === undefined) {
      setAddError("Sets must be between 1 and 20.");
      return;
    }
    if (rest === undefined) {
      setAddError("Rest must be between 0 and 600 seconds.");
      return;
    }
    if (goal === undefined) {
      setAddError("Target must be between 1 and 10000.");
      return;
    }
    const key = exerciseName.trim().toLocaleLowerCase("en");
    const match = library.find((exercise) => exercise.name.trim().toLocaleLowerCase("en") === key);
    setAddError(null);
    const result = await addExerciseToPlan(planId, exerciseName, sets, rest, match?.id, tracking, goal);
    if (result?.error) {
      setAddError(result.error);
      return;
    }
    setExerciseName("");
    setTracking("weight");
    setTargetSets("");
    setRepGoal("");
    setRestSeconds("");
    setIsAddingExercise(false);
  };

  function startEdit(exercise: ExerciseItem) {
    setEditingId(exercise.id);
    setEditName(exercise.name);
    setEditTracking(exercise.tracking ?? "weight");
    setEditSets(exercise.setsOverride != null ? String(exercise.setsOverride) : "");
    setEditRepGoal(exercise.repGoalOverride != null ? String(exercise.repGoalOverride) : "");
    setEditRest(exercise.restOverride != null ? String(exercise.restOverride) : "");
    setEditError(null);
  }

  const handleSaveExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    const sets = parseOptionalCount(editSets, 1, 20);
    const rest = parseOptionalCount(editRest, 0, 600);
    const goal = parseOptionalCount(editRepGoal, 1, 10000);
    if (!editName.trim()) {
      setEditError("Enter a name.");
      return;
    }
    if (sets === undefined) {
      setEditError("Sets must be between 1 and 20.");
      return;
    }
    if (rest === undefined) {
      setEditError("Rest must be between 0 and 600 seconds.");
      return;
    }
    if (goal === undefined) {
      setEditError("Target must be between 1 and 10000.");
      return;
    }

    const current = items.find((exercise) => exercise.id === editingId);
    const currentName = current?.name ?? "";
    if (editName.trim() !== currentName) {
      const confirmed = window.confirm(
        "This name applies to every plan and all past logs of this exercise. Continue?"
      );
      if (!confirmed) return;
    }

    const result = await updateExercise(planId, editingId, editName, sets, rest, editTracking, goal);
    if (result?.error) {
      setEditError(result.error);
      return;
    }
    const resolvedSets = sets ?? current?.defaultSets ?? current?.targetSets ?? 3;
    const resolvedRest = rest ?? current?.defaultRest ?? current?.restSeconds ?? 90;
    const resolvedGoal = goal ?? current?.defaultRepGoal ?? null;
    setItems((items) =>
      items.map((exercise) =>
        exercise.id === editingId
          ? {
              ...exercise,
              name: editName.trim(),
              tracking: editTracking,
              targetSets: resolvedSets,
              restSeconds: resolvedRest,
              repGoal: resolvedGoal,
              setsOverride: sets,
              restOverride: rest,
              repGoalOverride: goal,
            }
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
    if (confirm("Are you sure you want to delete this entire plan?")) {
      await deletePlan(planId);
    }
  };

  const fieldClass =
    "w-full bg-[#1b1b1e] border border-white/[0.04] rounded-2xl px-4 py-3 text-[14px] text-white placeholder-[#71717a] outline-none focus:border-[#baa3d0]";
  const ownedNames = new Set(library.map((item) => item.name.trim().toLocaleLowerCase("en")));
  const exerciseQuery = exerciseName.trim().toLocaleLowerCase("en");
  // An exercise may appear twice in a plan, so nothing is filtered out by use.
  const suggestions = [
    ...library
      .filter((exercise) => {
        if (!exerciseQuery) return true;
        return exercise.name.toLocaleLowerCase("en").includes(exerciseQuery);
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
      const key = exercise.name.toLocaleLowerCase("en");
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
    (exercise) => exercise.name.trim().toLocaleLowerCase("en") === exerciseQuery
  );
  const showTracking = !exactOwn;
  const addDefaults = selectedDefaults();

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
              Save
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setIsEditingTitle(true)}
            className="w-full bg-[#1b1b1e] rounded-2xl px-4 py-3 flex items-center justify-between gap-3 border border-white/[0.04] apple-press"
          >
            <span className="text-[14px] font-medium text-white shrink-0">Name</span>
            <span className="font-editorial text-[22px] text-[#baa3d0] tracking-wider leading-none truncate">
              {name}
            </span>
          </button>
        )}
      </section>

      <section className="bg-[#141416] border border-white/[0.08] rounded-[30px] p-5 space-y-3 shadow-[0_12px_28px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold tracking-[0.18em] text-[#baa3d0] uppercase">
            Exercises
          </span>
          <button
            type="button"
            onClick={() => setIsAddingExercise(!isAddingExercise)}
            aria-label="Add exercise"
            className="flex items-center gap-1 text-[11px] font-semibold tracking-[0.18em] text-[#baa3d0] uppercase"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            New
          </button>
        </div>

        {isAddingExercise && (
          <form onSubmit={handleAddExercise} className="space-y-2">
            <input
              type="text"
              placeholder="Search or create an exercise"
              value={exerciseName}
              onChange={(e) => {
                const value = e.target.value;
                setExerciseName(value);
                const own = library.find(
                  (exercise) => exercise.name.trim().toLocaleLowerCase("en") === value.trim().toLocaleLowerCase("en")
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
                    exercise.name.trim().toLocaleLowerCase("en") === exerciseQuery;
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
              <label className="block space-y-1">
                <span className="px-1 text-[10px] font-semibold tracking-[0.14em] text-[#71717a] uppercase">
                  Sets
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label="Sets override, empty means default"
                  placeholder={addDefaults ? `Default ${addDefaults.sets}` : "Sets"}
                  value={targetSets}
                  onChange={(e) => setTargetSets(e.target.value.replace(/[^\d]/g, ""))}
                  className={`${fieldClass} text-center`}
                />
              </label>
              <label className="block space-y-1">
                <span className="px-1 text-[10px] font-semibold tracking-[0.14em] text-[#71717a] uppercase">
                  Target ({targetUnit(tracking)})
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label="Target reps or seconds override, empty means default"
                  placeholder={addDefaults?.goal != null ? `Default ${addDefaults.goal}` : "Target"}
                  value={repGoal}
                  onChange={(e) => setRepGoal(e.target.value.replace(/[^\d]/g, ""))}
                  className={`${fieldClass} text-center`}
                />
              </label>
              <label className="block space-y-1">
                <span className="px-1 text-[10px] font-semibold tracking-[0.14em] text-[#71717a] uppercase">
                  Rest (s)
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label="Rest in seconds override, empty means default"
                  placeholder={addDefaults ? `Default ${addDefaults.rest}` : "Rest"}
                  value={restSeconds}
                  onChange={(e) => setRestSeconds(e.target.value.replace(/[^\d]/g, ""))}
                  className={`${fieldClass} text-center`}
                />
              </label>
            </div>
            <p className="px-1 text-[12px] leading-snug text-[#71717a]">
              Empty means the exercise default. An exercise may appear twice in a plan.
            </p>
            {addError && <p className="px-1 text-[12px] text-red-300">{addError}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-[#baa3d0] text-[#141416] font-semibold py-3 rounded-2xl text-[12px] uppercase tracking-wider apple-press"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setIsAddingExercise(false)}
                className="px-4 bg-[#1b1b1e] border border-white/[0.04] text-[#a1a1aa] py-3 rounded-2xl text-[12px] uppercase tracking-wider"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div ref={listRef} className="space-y-2 pt-1">
          {items.length === 0 ? (
            <div className="bg-[#1b1b1e] rounded-2xl px-4 py-3 flex items-center border border-white/[0.04]">
              <span className="text-[14px] font-medium text-[#71717a]">No exercises yet</span>
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
                    <label className="block space-y-1">
                      <span className="px-1 text-[10px] font-semibold tracking-[0.14em] text-[#71717a] uppercase">
                        Name
                      </span>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                        aria-label="Exercise name"
                        className="w-full bg-[#141416] border border-white/[0.08] rounded-2xl px-4 py-3 text-[14px] text-white outline-none focus:border-[#baa3d0]"
                      />
                    </label>
                    <p className="px-1 text-[12px] leading-snug text-[#baa3d0]">
                      A different name applies to every plan and all past logs of this exercise.
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
                      <label className="block space-y-1">
                        <span className="px-1 text-[10px] font-semibold tracking-[0.14em] text-[#71717a] uppercase">
                          Sets
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          aria-label="Sets override, empty means default"
                          placeholder={ex.defaultSets != null ? `Default ${ex.defaultSets}` : "Sets"}
                          value={editSets}
                          onChange={(e) => setEditSets(e.target.value.replace(/[^\d]/g, ""))}
                          className="w-full bg-[#141416] border border-white/[0.08] rounded-2xl px-4 py-3 text-[14px] text-white text-center outline-none focus:border-[#baa3d0]"
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="px-1 text-[10px] font-semibold tracking-[0.14em] text-[#71717a] uppercase">
                          Target ({targetUnit(editTracking)})
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          aria-label="Target reps or seconds override, empty means default"
                          placeholder={ex.defaultRepGoal != null ? `Default ${ex.defaultRepGoal}` : "Target"}
                          value={editRepGoal}
                          onChange={(e) => setEditRepGoal(e.target.value.replace(/[^\d]/g, ""))}
                          className="w-full bg-[#141416] border border-white/[0.08] rounded-2xl px-4 py-3 text-[14px] text-white text-center outline-none focus:border-[#baa3d0]"
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="px-1 text-[10px] font-semibold tracking-[0.14em] text-[#71717a] uppercase">
                          Rest (s)
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          aria-label="Rest in seconds override, empty means default"
                          placeholder={ex.defaultRest != null ? `Default ${ex.defaultRest}` : "Rest"}
                          value={editRest}
                          onChange={(e) => setEditRest(e.target.value.replace(/[^\d]/g, ""))}
                          className="w-full bg-[#141416] border border-white/[0.08] rounded-2xl px-4 py-3 text-[14px] text-white text-center outline-none focus:border-[#baa3d0]"
                        />
                      </label>
                    </div>
                    <p className="px-1 text-[12px] leading-snug text-[#71717a]">
                      Empty fields use the exercise default.
                    </p>
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
                  </form>
                ) : (
                  <div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Drag to reorder"
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
                          aria-label={`${ex.name} up`}
                          disabled={idx === 0}
                          onClick={() => moveItem(idx, -1)}
                          className="w-6 h-4 flex items-center justify-center text-[#71717a] disabled:opacity-30"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`${ex.name} down`}
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
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteExercise(ex.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-[#141416] border border-white/[0.08] text-red-300 py-2.5 rounded-2xl text-[12px] uppercase tracking-wider font-semibold apple-press"
                        >
                          <Trash2 className="w-3.5 h-3.5 stroke-[1.8]" />
                          Remove
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
        Delete plan
      </button>
    </div>
  );
}
