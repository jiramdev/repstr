"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { enterTransition } from "@/lib/motion";
import { markNotificationsRead } from "./actions";

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: string;
}

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

const itemMotion = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: enterTransition },
};

export default function NotificationList({ items }: { items: NotificationItem[] }) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (items.some((item) => !item.read)) markNotificationsRead();
  }, [items]);

  if (items.length === 0) {
    return (
      <section className="bg-[#141416] border border-white/[0.08] rounded-[34px] px-6 py-12 text-center shadow-[0_16px_36px_rgba(0,0,0,0.25)]">
        <p className="font-editorial text-[28px] text-white leading-none">Quiet</p>
        <p className="mt-3 text-[13px] text-[#a1a1aa]">
          No notifications yet. In the morning, your workout for the day shows up here.
        </p>
      </section>
    );
  }

  return (
    <motion.div
      className="space-y-2.5"
      initial={reduce ? false : "hidden"}
      animate="show"
      variants={{ show: { transition: { staggerChildren: reduce ? 0 : 0.045 } } }}
    >
      {items.map((item) => {
        const inner = (
          <>
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-editorial text-[20px] tracking-wide text-white leading-none">
                {item.title}
              </h2>
              {!item.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-[#baa3d0] shrink-0" />}
            </div>
            <p className="text-[13px] text-[#a1a1aa]">{item.body}</p>
            <p className="text-[11px] font-semibold tracking-wider text-[#71717a] uppercase">
              {formatWhen(item.createdAt)}
            </p>
          </>
        );

        const className =
          "block bg-[#141416] border border-white/[0.08] rounded-[28px] px-5 py-4 space-y-2 shadow-[0_12px_28px_rgba(0,0,0,0.2)]";

        if (!item.href) {
          return (
            <motion.article key={item.id} variants={itemMotion} className={className}>
              {inner}
            </motion.article>
          );
        }

        return (
          <motion.div key={item.id} variants={itemMotion}>
            <Link href={item.href} className={`${className} apple-press`}>
              {inner}
            </Link>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
