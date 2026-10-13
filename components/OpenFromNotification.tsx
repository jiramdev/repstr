"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { refreshPushSubscription, syncExistingPushSubscription } from "@/lib/enable-notifications";

export default function OpenFromNotification() {
  const router = useRouter();

  useEffect(() => {
    syncExistingPushSubscription().catch(() => {});
    refreshPushSubscription().catch(() => {});
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== "repiq-open" || typeof data.url !== "string") return;
      if (!data.url.startsWith("/") || data.url.startsWith("//")) return;
      const current = window.location.pathname + window.location.search;
      if (current === data.url) return;
      router.push(data.url);
    };

    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);

  return null;
}
