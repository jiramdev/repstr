import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSchedule } from "@/lib/queries";
import ScheduleManager from "@/app/schedule/ScheduleManager";
import TabHeader from "@/components/TabHeader";

export default async function SchedulePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const schedule = await getSchedule(session.user.id);

  return (
    <div className="min-h-screen bg-[#baa3d0] text-white pb-[calc(8rem+env(safe-area-inset-bottom))] pt-4 px-4 select-none">
      <main className="max-w-sm mx-auto space-y-3.5">
        <TabHeader title="SCHEDULE" />
        <ScheduleManager plans={schedule.plans} initialDays={schedule.initialDays} />
      </main>
    </div>
  );
}
