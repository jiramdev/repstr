import Link from "next/link";
import { Bell } from "lucide-react";
import Prefetch from "@/components/Prefetch";
import TabLink from "@/components/TabLink";

const dayNamesEN = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

export default function HomePanel({
  displayName,
  dayOfWeek,
  todayPlan,
  sessionCount,
  latestWeight,
  unreadCount,
}: {
  displayName: string;
  dayOfWeek: number;
  todayPlan: { id: string; name: string; exerciseCount: number } | null;
  sessionCount: number;
  latestWeight: number | null;
  unreadCount: number;
}) {
  const userInitial = displayName.charAt(0).toUpperCase();
  const workoutHref = todayPlan ? `/workout/active?planId=${todayPlan.id}` : "/schedule";

  return (
    <div className="min-h-dvh bg-[#baa3d0] text-white pb-[calc(8rem+env(safe-area-inset-bottom))] pt-4 px-4 select-none">
      <Prefetch hrefs={[workoutHref, "/notifications"]} />
      <main className="max-w-sm mx-auto space-y-3.5">
        <header className="flex justify-between items-center px-1 py-1">
          <TabLink
            href="/account"
            className="h-10 bg-[#141416] border border-white/[0.08] pl-1.5 pr-4 rounded-full flex items-center gap-2.5 shadow-[0_4px_12px_rgba(0,0,0,0.15)] transition apple-press"
          >
            <div className="w-7 h-7 rounded-full bg-[#baa3d0] text-[#141416] flex items-center justify-center font-bold text-[12px] uppercase">
              {userInitial}
            </div>
            <span className="font-editorial text-[14px] tracking-wider text-white leading-none uppercase">
              {displayName}
            </span>
          </TabLink>

          <Link
            href="/notifications"
            prefetch={true}
            aria-label="Notifications"
            className="relative w-10 h-10 rounded-full bg-[#141416] border border-white/[0.08] flex items-center justify-center text-[#a1a1aa] hover:text-white transition apple-press shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
          >
            <Bell className="w-4 h-4 stroke-[1.8]" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#baa3d0]" />
            )}
          </Link>
        </header>

        {todayPlan ? (
          <Link
            href={workoutHref}
            prefetch={true}
            aria-label="Start workout"
            className="block bg-[#141416] border border-white/[0.08] rounded-[34px] px-6 py-9 text-center space-y-3 relative overflow-hidden shadow-[0_16px_36px_rgba(0,0,0,0.25)] transition apple-press"
          >
            <p className="text-[12px] font-semibold tracking-[0.2em] text-[#baa3d0] uppercase">
              {dayNamesEN[dayOfWeek]}
            </p>
            <h1 className="text-[52px] sm:text-[58px] font-editorial tracking-tight text-white leading-none">
              {todayPlan.name}
            </h1>
            <p className="text-[14px] text-[#a1a1aa] font-medium tracking-tight">
              {todayPlan.exerciseCount} exercises scheduled
            </p>
          </Link>
        ) : (
          <TabLink
            href="/schedule"
            className="block bg-[#141416] border border-white/[0.08] rounded-[34px] px-6 py-9 text-center space-y-3 relative overflow-hidden shadow-[0_16px_36px_rgba(0,0,0,0.25)] transition apple-press"
          >
            <p className="text-[12px] font-semibold tracking-[0.2em] text-[#baa3d0] uppercase">
              {dayNamesEN[dayOfWeek]}
            </p>
            <h1 className="text-[52px] sm:text-[58px] font-editorial tracking-tight text-white leading-none">
              REST DAY
            </h1>
            <p className="text-[14px] text-[#a1a1aa] font-medium tracking-tight">
              No workout scheduled
            </p>
          </TabLink>
        )}

        <div className="grid grid-cols-2 gap-3.5">
          <div className="bg-[#141416] border border-white/[0.08] rounded-[30px] p-5 text-center flex flex-col justify-between items-center aspect-square shadow-[0_12px_28px_rgba(0,0,0,0.2)]">
            <span className="text-[11px] font-semibold tracking-[0.18em] text-[#baa3d0] uppercase">
              Workouts
            </span>
            <div className="flex-1 flex items-center justify-center">
              <span className="text-[48px] font-editorial tracking-tight text-white leading-none block">
                {sessionCount}
              </span>
            </div>
            <span className="text-[12px] text-[#a1a1aa] font-medium">this month</span>
          </div>

          <TabLink
            href="/account"
            className="bg-[#141416] border border-white/[0.08] rounded-[30px] p-5 text-center flex flex-col justify-between items-center aspect-square shadow-[0_12px_28px_rgba(0,0,0,0.2)] transition apple-press"
          >
            <span className="text-[11px] font-semibold tracking-[0.18em] text-[#baa3d0] uppercase">
              Weight
            </span>
            <div className="flex-1 flex items-center justify-center">
              <span className="text-[48px] font-editorial tracking-tight text-white leading-none block">
                {latestWeight ?? "--"}
              </span>
            </div>
            <span className="text-[12px] text-[#a1a1aa] font-medium">kg</span>
          </TabLink>
        </div>
      </main>
    </div>
  );
}
