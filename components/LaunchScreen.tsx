"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const AUTH_ROUTES = ["/login", "/register"];
const BOOT_KEY = "repstr-booted";
const BOOT_MS = 1250;

export default function LaunchScreen() {
  const pathname = usePathname();
  const router = useRouter();
  const started = useRef(false);

  useLayoutEffect(() => {
    if (AUTH_ROUTES.includes(pathname) || pathname.startsWith("/onboarding")) {
      document.getElementById("boot-splash")?.remove();
    }
  }, [pathname]);

  useEffect(() => {
    if (AUTH_ROUTES.includes(pathname) || pathname.startsWith("/onboarding")) return;
    if (started.current) return;
    started.current = true;

    const splash = document.getElementById("boot-splash");
    if (sessionStorage.getItem(BOOT_KEY) === "1") {
      splash?.remove();
      return;
    }

    // Start the animation only once the overlay has actually painted, so the
    // slide-in is fully visible even when the page takes a while to load.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById("boot-splash")?.classList.add("boot-go");
      });
    });

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => {
      sessionStorage.setItem(BOOT_KEY, "1");
      splash?.remove();
      router.prefetch("/notifications");
      router.prefetch("/workout/active");
    }, reduce ? 300 : BOOT_MS);
    return () => window.clearTimeout(timer);
  }, [pathname, router]);

  return null;
}
