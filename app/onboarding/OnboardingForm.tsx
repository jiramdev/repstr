"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveOnboarding } from "./actions";

const SEX_OPTIONS = [
  { value: "man", label: "Male" },
  { value: "vrouw", label: "Female" },
  { value: "anders", label: "Other" },
] as const;

const fieldClass =
  "w-full bg-[#1b1b1e] border border-white/[0.08] rounded-2xl px-4 py-3 text-[15px] text-white outline-none focus:border-[#baa3d0] placeholder:text-[#52525b]";

export default function OnboardingForm() {
  const router = useRouter();
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [sex, setSex] = useState("");
  const [weight, setWeight] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function continueSignup() {
    router.push("/onboarding/notifications");
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!age.trim() && !heightCm.trim() && !sex && !weight.trim()) {
      continueSignup();
      return;
    }

    setSaving(true);
    setError(null);
    const result = await saveOnboarding({ age, heightCm, sex, weight });
    if (result?.error) {
      setError(result.error);
      setSaving(false);
      return;
    }
    continueSignup();
  }

  return (
    <div className="min-h-dvh bg-[#baa3d0] px-4 py-10 flex items-center justify-center select-none">
      <main className="w-full max-w-sm space-y-4">
        <div className="text-center pb-1">
          <h1 className="font-editorial text-[56px] text-[#141416] leading-none">PROFILE</h1>
          <p className="mt-3 text-[12px] font-semibold tracking-[0.22em] text-[#141416]/70 uppercase">
            Age, height, sex, weight
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[#141416] border border-white/[0.08] rounded-[34px] p-6 space-y-4 shadow-[0_16px_36px_rgba(0,0,0,0.25)]"
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="px-1 text-[11px] font-semibold tracking-wider text-[#71717a] uppercase">
                Age
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={10}
                max={100}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="—"
                className={fieldClass}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="px-1 text-[11px] font-semibold tracking-wider text-[#71717a] uppercase">
                Height (cm)
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={80}
                max={250}
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder="—"
                className={fieldClass}
              />
            </label>
          </div>

          <div className="space-y-1.5">
            <span className="px-1 text-[11px] font-semibold tracking-wider text-[#71717a] uppercase">
              Sex
            </span>
            <div className="grid grid-cols-3 gap-2">
              {SEX_OPTIONS.map((option) => {
                const selected = sex === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSex(selected ? "" : option.value)}
                    className={`h-11 rounded-2xl text-[13px] font-semibold transition apple-press ${
                      selected
                        ? "bg-[#baa3d0] text-[#141416]"
                        : "bg-[#1b1b1e] border border-white/[0.08] text-[#a1a1aa]"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="px-1 text-[11px] font-semibold tracking-wider text-[#71717a] uppercase">
              Weight (kg)
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min={1}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="—"
              className={fieldClass}
            />
          </label>

          {error && <p className="px-1 text-[13px] text-red-300">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#baa3d0] text-[#141416] rounded-full py-3.5 font-editorial text-[18px] tracking-wider disabled:opacity-50 apple-press"
          >
            {saving ? "SAVING..." : "SAVE"}
          </button>
        </form>

        <button
          type="button"
          onClick={continueSignup}
          disabled={saving}
          className="block w-full text-center text-[13px] font-semibold text-[#141416] underline underline-offset-2 disabled:opacity-50"
        >
          Skip
        </button>
      </main>
    </div>
  );
}
