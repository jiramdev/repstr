// components/BottomBar.tsx
"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { selectTab } from "@/components/TabLink";
import { LayoutGrid, Calendar, BarChart3, User } from "lucide-react";
import { motion } from "motion/react";
import { TAB_HREFS } from "@/lib/motion";

function slidePages(page: HTMLElement, direction: 1 | -1, navigate: () => void) {
  document.querySelectorAll("[data-page-clone]").forEach((node) => node.remove());
  page.getAnimations().forEach((animation) => animation.cancel());

  const width = window.innerWidth;
  const clone = page.cloneNode(true) as HTMLElement;
  clone.removeAttribute("id");
  clone.setAttribute("data-page-clone", "");
  clone.style.position = "fixed";
  clone.style.top = "0";
  clone.style.left = "0";
  clone.style.width = `${width}px`;
  clone.style.height = `${window.innerHeight}px`;
  clone.style.margin = "0";
  clone.style.zIndex = "40";
  clone.style.overflow = "hidden";
  clone.style.pointerEvents = "none";
  clone.style.background = "#baa3d0";
  clone.style.transform = "translate3d(0,0,0)";
  document.body.appendChild(clone);

  const timing: KeyframeAnimationOptions = {
    duration: 450,
    easing: "cubic-bezier(0.32, 0.72, 0, 1)",
    fill: "both",
  };
  const incoming = page.animate(
    [
      { transform: `translate3d(${direction * width}px, 0, 0)` },
      { transform: "translate3d(0, 0, 0)" },
    ],
    timing
  );
  const outgoing = clone.animate(
    [
      { transform: "translate3d(0, 0, 0)" },
      { transform: `translate3d(${direction * -width}px, 0, 0)` },
    ],
    timing
  );

  const body = document.body;
  const previousOverflow = body.style.overflowX;
  body.style.overflowX = "hidden";

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    incoming.cancel();
    outgoing.cancel();
    clone.remove();
    page.style.transform = "";
    page.style.willChange = "";
    body.style.overflowX = previousOverflow;
  };

  page.style.willChange = "transform";
  navigate();
  incoming.onfinish = finish;
  window.setTimeout(finish, 520);
}

const TABS = [
  { href: TAB_HREFS[0], icon: LayoutGrid, label: "Workouts" },
  { href: TAB_HREFS[1], icon: Calendar, label: "Schedule" },
  { href: TAB_HREFS[2], icon: BarChart3, label: "Stats" },
  { href: TAB_HREFS[3], icon: User, label: "Account" },
];

export default function BottomBar() {
  const pathname = usePathname();
  const router = useRouter();
  const tabIndex = TAB_HREFS.indexOf(pathname as (typeof TAB_HREFS)[number]);

  useEffect(() => {
    if (pathname === "/login" || pathname === "/register" || pathname.startsWith("/onboarding") || pathname.startsWith("/workout/")) return;
    for (const tab of TABS) {
      router.prefetch(tab.href);
    }
  }, [pathname, router]);

  useEffect(() => {
    const isTab = (TAB_HREFS as readonly string[]).includes(pathname);
    const isAuth = pathname === "/login" || pathname === "/register" || pathname.startsWith("/onboarding");
    if (isTab || isAuth) return;

    const atEdge = (x: number) => x < 28 || x > window.innerWidth - 28;

    const onEdge = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const target = event.target;
      if (target instanceof Element && target.closest("a, button, input, textarea, select")) return;
      if (atEdge(event.touches[0].clientX)) event.preventDefault();
    };

    let lock = false;
    const onStart = (event: TouchEvent) => {
      lock = event.touches.length === 1 && atEdge(event.touches[0].clientX);
    };
    const onMove = (event: TouchEvent) => {
      if (!lock) return;
      event.preventDefault();
    };

    document.addEventListener("touchstart", onEdge, { passive: false, capture: true });
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false, capture: true });

    return () => {
      document.removeEventListener("touchstart", onEdge, true);
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove, true);
    };
  }, [pathname]);

  useEffect(() => {
    const index = tabIndex;
    if (index === -1) return;

    let startX = 0;
    let startY = 0;
    let horizontal = false;
    let active = false;

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, [data-no-swipe]")) return;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      horizontal = false;
      active = true;
    };

    const onMove = (event: TouchEvent) => {
      if (!active || event.touches.length !== 1) return;
      const dx = event.touches[0].clientX - startX;
      const dy = event.touches[0].clientY - startY;
      if (!horizontal && Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (!horizontal && Math.abs(dy) > Math.abs(dx)) {
        active = false;
        return;
      }
      horizontal = true;
      event.preventDefault();
    };

    const onEnd = (event: TouchEvent) => {
      if (!active || !horizontal) {
        active = false;
        return;
      }
      active = false;
      const dx = event.changedTouches[0].clientX - startX;
      const dy = event.changedTouches[0].clientY - startY;
      if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy)) return;
      if (document.querySelector("[data-page-clone]")) return;

      const nextIndex = dx < 0 ? index + 1 : index - 1;
      if (nextIndex < 0 || nextIndex >= TAB_HREFS.length) return;

      if (document.getElementById("tab-track")) {
        selectTab(nextIndex);
        return;
      }
      const page = document.getElementById("page-root");
      const href = TAB_HREFS[nextIndex];
      const direction = dx < 0 ? 1 : -1;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!page || reduce) {
        router.replace(href);
        return;
      }
      slidePages(page, direction, () => router.replace(href));
    };

    const onCancel = () => {
      active = false;
    };

    const onEdge = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const x = event.touches[0].clientX;
      if (x < 16 || x > window.innerWidth - 16) event.preventDefault();
    };

    document.addEventListener("touchstart", onEdge, { passive: false, capture: true });
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onCancel);

    return () => {
      document.removeEventListener("touchstart", onEdge, true);
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onCancel);
    };
  }, [tabIndex, router]);

  if (pathname === "/login" || pathname === "/register" || pathname.startsWith("/onboarding") || pathname.startsWith("/workout/")) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <nav className="pointer-events-auto bg-[#141416]/90 backdrop-blur-2xl border border-white/[0.1] px-6 py-3 rounded-full shadow-[0_12px_36px_rgba(0,0,0,0.35)] flex items-center gap-8 transition-all">
        {TABS.map((tab) => {
          const to = TAB_HREFS.indexOf(tab.href);
          const isActive = tabIndex === to;
          const Icon = tab.icon;
          const from = tabIndex;
          const slide =
            from !== -1 && to !== -1 && from !== to
              ? to > from
                ? "nav-forward"
                : "nav-back"
              : null;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch={true}
              onClick={(event) => {
                if (!slide) return;
                if (
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey ||
                  event.button !== 0
                ) {
                  return;
                }
                if (document.getElementById("tab-track")) {
                  event.preventDefault();
                  selectTab(to);
                  return;
                }
                const page = document.getElementById("page-root");
                const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                if (!page || reduce) return;

                event.preventDefault();
                try {
                  slidePages(page, slide === "nav-forward" ? 1 : -1, () => router.replace(tab.href));
                } catch {
                  router.replace(tab.href);
                }
              }}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
              className={`p-2 rounded-full transition apple-press flex items-center justify-center relative ${
                isActive ? "text-white" : "text-[#71717a] hover:text-[#a1a1aa]"
              }`}
            >
              <Icon className="w-5 h-5 stroke-[1.8]" />
              {isActive && (
                <motion.span
                  layoutId="tab-dot"
                  className="absolute -bottom-1 w-1 h-1 bg-[#baa3d0] rounded-full"
                  transition={{ type: "spring", stiffness: 520, damping: 34 }}
                />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}