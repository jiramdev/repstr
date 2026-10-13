"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { enableNotifications } from "@/lib/enable-notifications";

export default function NotificationPromptPage() {
  const router = useRouter();
  const [asking, setAsking] = useState(false);

  function finish() {
    router.push("/");
    router.refresh();
  }

  async function allow() {
    setAsking(true);
    await enableNotifications();
    finish();
  }

  return (
    <div className="min-h-dvh bg-[#baa3d0] px-4 py-10 flex items-center justify-center select-none">
      <main className="w-full max-w-sm space-y-4">
        <div className="text-center pb-1">
          <h1 className="font-editorial text-[52px] text-[#141416] leading-none">Notifications</h1>
          <p className="mt-3 text-[14px] font-medium text-[#141416]/70">
            Permission to send you notifications.
          </p>
        </div>

        <section className="bg-[#141416] border border-white/[0.08] rounded-[34px] p-6 space-y-4 shadow-[0_16px_36px_rgba(0,0,0,0.25)] text-center">
          <p className="text-[14px] text-[#a1a1aa]">
            Turn on notifications. You will get a nudge when your rest time is over.
          </p>
          <button
            type="button"
            onClick={allow}
            disabled={asking}
            className="w-full bg-[#baa3d0] text-[#141416] rounded-full py-3.5 font-editorial text-[18px] tracking-wider disabled:opacity-50 apple-press"
          >
            {asking ? "ASKING..." : "TURN ON"}
          </button>
        </section>

        <button
          type="button"
          onClick={finish}
          disabled={asking}
          className="block w-full text-center text-[13px] font-semibold text-[#141416] underline underline-offset-2 disabled:opacity-50"
        >
          Not now
        </button>
      </main>
    </div>
  );
}
