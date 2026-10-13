import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAnalytics } from "@/lib/queries";
import AnalyticsPanel from "@/components/AnalyticsPanel";

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const analytics = await getAnalytics(session.user.id);
  return (
    <AnalyticsPanel
      workouts={analytics.workouts}
      weightLogs={analytics.weightLogs}
    />
  );
}
