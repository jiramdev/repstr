"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { registerUser } from "@/app/actions/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

const fieldClass =
  "w-full bg-[#1b1b1e] border border-white/[0.08] rounded-2xl px-4 py-3 text-[15px] text-white outline-none focus:border-[#baa3d0] placeholder:text-[#52525b]";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const res = await registerUser(formData);

    if (res?.error) {
      setError(res.error);
      setLoading(false);
      return;
    }

    const signedIn = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (signedIn?.error) {
      router.push("/login?callbackUrl=/onboarding");
      return;
    }

    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#baa3d0] px-4 py-10 flex items-center justify-center select-none">
      <main className="w-full max-w-sm space-y-4">
        <div className="text-center pb-1">
          <h1 className="brand-name text-[64px] text-[#141416] leading-none">repiq</h1>
          <p className="mt-3 text-[14px] font-medium text-[#141416]/70">Every rep, counted.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[#141416] border border-white/[0.08] rounded-[34px] p-6 space-y-4 shadow-[0_16px_36px_rgba(0,0,0,0.25)]"
        >
          <label className="block space-y-1.5">
            <span className="px-1 text-[11px] font-semibold tracking-wider text-[#71717a] uppercase">
              Name
            </span>
            <input
              type="text"
              name="name"
              required
              autoComplete="name"
              placeholder="Your name"
              className={fieldClass}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="px-1 text-[11px] font-semibold tracking-wider text-[#71717a] uppercase">
              Email
            </span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="name@example.com"
              className={fieldClass}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="px-1 text-[11px] font-semibold tracking-wider text-[#71717a] uppercase">
              Password
            </span>
            <input
              type="password"
              name="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="at least 8 characters"
              className={fieldClass}
            />
          </label>

          {error && <p className="px-1 text-[13px] text-red-300">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#baa3d0] text-[#141416] rounded-full py-3.5 font-editorial text-[18px] tracking-wider disabled:opacity-50 apple-press"
          >
            {loading ? "SIGNING UP..." : "SIGN UP"}
          </button>
        </form>

        <p className="text-center text-[13px] text-[#141416]/80">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-[#141416] underline underline-offset-2">
            Log in
          </Link>
        </p>
      </main>
    </div>
  );
}
