"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateAccount, updatePassword, type AccountInput } from "./actions";
import { fullSignOut } from "@/lib/sign-out";

const SEX_OPTIONS = [
  { value: "man", label: "Man" },
  { value: "vrouw", label: "Vrouw" },
  { value: "anders", label: "Anders" },
] as const;

const fieldClass =
  "w-full bg-[#1b1b1e] border border-white/[0.08] rounded-2xl px-4 py-3 text-[15px] text-white outline-none focus:border-[#baa3d0] placeholder:text-[#52525b]";

export default function AccountForm({ initial }: { initial: AccountInput }) {
  const router = useRouter();
  const [profile, setProfile] = useState(initial);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [emailPassword, setEmailPassword] = useState("");
  const emailChanged = profile.email.trim().toLowerCase() !== initial.email.trim().toLowerCase();
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  function updateField(field: keyof AccountInput, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
    setProfileSaved(false);
  }

  async function handleProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError(null);
    setProfileSaved(false);
    const result = await updateAccount(profile, emailPassword);
    setSavingProfile(false);
    if (result?.error) {
      setProfileError(result.error);
      return;
    }
    if (result?.emailChanged) {
      await fullSignOut();
      return;
    }
    setEmailPassword("");
    setProfileSaved(true);
    router.refresh();
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setSavingPassword(true);
    setPasswordError(null);
    const result = await updatePassword(currentPassword, nextPassword);
    setSavingPassword(false);
    if (result?.error) {
      setPasswordError(result.error);
      return;
    }
    setCurrentPassword("");
    setNextPassword("");
    await fullSignOut();
  }

  return (
    <div className="space-y-3.5">
      <section className="bg-[#141416] border border-white/[0.08] rounded-[34px] px-6 py-8 text-center shadow-[0_16px_36px_rgba(0,0,0,0.25)] space-y-3">
        <h1 className="font-editorial text-[36px] tracking-wide text-white leading-none">
          {profile.name.trim() || "Account"}
        </h1>
        <p className="text-[13px] text-[#a1a1aa]">{profile.email}</p>
      </section>

      <form
        onSubmit={handleProfile}
        className="bg-[#141416] border border-white/[0.08] rounded-[30px] p-5 space-y-3 shadow-[0_12px_28px_rgba(0,0,0,0.2)]"
      >
        <span className="text-[11px] font-semibold tracking-[0.18em] text-[#baa3d0] uppercase px-1">
          Profiel
        </span>

        <label className="block space-y-1.5">
          <span className="px-1 text-[11px] font-semibold tracking-wider text-[#71717a] uppercase">
            Gebruikersnaam
          </span>
          <input
            value={profile.name}
            onChange={(e) => updateField("name", e.target.value)}
            autoComplete="nickname"
            className={fieldClass}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="px-1 text-[11px] font-semibold tracking-wider text-[#71717a] uppercase">
            E-mail
          </span>
          <input
            type="email"
            value={profile.email}
            onChange={(e) => updateField("email", e.target.value)}
            autoComplete="email"
            className={fieldClass}
          />
        </label>

        {emailChanged && (
          <label className="block space-y-1.5">
            <span className="px-1 text-[11px] font-semibold tracking-wider text-[#71717a] uppercase">
              Huidig wachtwoord
            </span>
            <input
              type="password"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              autoComplete="current-password"
              className={fieldClass}
            />
            <span className="px-1 block text-[12px] text-[#a1a1aa]">
              Nodig om je e-mail te wijzigen. Je wordt daarna uitgelogd.
            </span>
          </label>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="px-1 text-[11px] font-semibold tracking-wider text-[#71717a] uppercase">
              Leeftijd
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={10}
              max={100}
              value={profile.age}
              onChange={(e) => updateField("age", e.target.value)}
              placeholder="—"
              className={fieldClass}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="px-1 text-[11px] font-semibold tracking-wider text-[#71717a] uppercase">
              Lengte (cm)
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={80}
              max={250}
              value={profile.heightCm}
              onChange={(e) => updateField("heightCm", e.target.value)}
              placeholder="—"
              className={fieldClass}
            />
          </label>
        </div>

        <div className="space-y-1.5">
          <span className="px-1 text-[11px] font-semibold tracking-wider text-[#71717a] uppercase">
            Geslacht
          </span>
          <div className="grid grid-cols-3 gap-2">
            {SEX_OPTIONS.map((option) => {
              const selected = profile.sex === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateField("sex", selected ? "" : option.value)}
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
            Gewicht (kg)
          </span>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min={1}
            value={profile.weight}
            onChange={(e) => updateField("weight", e.target.value)}
            placeholder="—"
            className={fieldClass}
          />
        </label>

        {profileError && (
          <p className="px-1 text-[13px] text-red-300">{profileError}</p>
        )}
        {profileSaved && (
          <p className="px-1 text-[13px] text-[#baa3d0]">Opgeslagen</p>
        )}

        <button
          type="submit"
          disabled={savingProfile}
          className="w-full bg-[#baa3d0] text-[#141416] rounded-full py-3.5 font-editorial text-[18px] tracking-wider disabled:opacity-50 apple-press"
        >
          {savingProfile ? "OPSLAAN..." : "PROFIEL OPSLAAN"}
        </button>
      </form>

      <form
        onSubmit={handlePassword}
        className="bg-[#141416] border border-white/[0.08] rounded-[30px] p-5 space-y-3 shadow-[0_12px_28px_rgba(0,0,0,0.2)]"
      >
        <span className="text-[11px] font-semibold tracking-[0.18em] text-[#baa3d0] uppercase px-1">
          Wachtwoord
        </span>

        <label className="block space-y-1.5">
          <span className="px-1 text-[11px] font-semibold tracking-wider text-[#71717a] uppercase">
            Huidig wachtwoord
          </span>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            className={fieldClass}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="px-1 text-[11px] font-semibold tracking-wider text-[#71717a] uppercase">
            Nieuw wachtwoord
          </span>
          <input
            type="password"
            value={nextPassword}
            onChange={(e) => setNextPassword(e.target.value)}
            autoComplete="new-password"
            className={fieldClass}
          />
        </label>

        {passwordError && (
          <p className="px-1 text-[13px] text-red-300">{passwordError}</p>
        )}
        <p className="px-1 text-[12px] text-[#a1a1aa]">
          Na een wijziging word je op dit apparaat en op andere sessies uitgelogd.
        </p>

        <button
          type="submit"
          disabled={savingPassword}
          className="w-full bg-[#1b1b1e] border border-white/[0.08] text-white rounded-full py-3.5 font-editorial text-[18px] tracking-wider disabled:opacity-50 apple-press"
        >
          {savingPassword ? "OPSLAAN..." : "WACHTWOORD WIJZIGEN"}
        </button>
      </form>

      <button
        type="button"
        onClick={async () => {
          await fullSignOut();
        }}
        className="w-full text-[13px] font-semibold tracking-wider text-[#71717a] uppercase py-3 apple-press"
      >
        Uitloggen
      </button>
    </div>
  );
}
