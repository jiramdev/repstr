import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getDashboard } from "@/lib/queries";
import HomePanel from "@/components/HomePanel";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const [dashboard, unreadCount] = await Promise.all([
    getDashboard(userId),
    prisma.appNotification.count({
      where: { userId, read: false, title: { not: "Rest over" } },
    }),
  ]);

  const displayName = dashboard.profileName || dashboard.profileEmail?.split("@")[0] || "ATHLETE";

  return (
    <HomePanel
      displayName={displayName}
      dayOfWeek={dashboard.dayOfWeek}
      todayPlan={dashboard.todayPlan}
      sessionCount={dashboard.sessionCount}
      latestWeight={dashboard.latestWeight}
      unreadCount={unreadCount}
    />
  );
}
