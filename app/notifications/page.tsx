import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import NotificationSettings from "@/components/NotificationSettings";
import SubpageHeader from "@/components/SubpageHeader";
import NotificationList from "./NotificationList";

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const notifications = await prisma.appNotification.findMany({
    where: { userId: session.user.id, title: { not: "Rest over" } },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      title: true,
      body: true,
      href: true,
      read: true,
      createdAt: true,
    },
  });

  return (
    <div className="min-h-screen bg-[#baa3d0] text-white pb-[calc(8rem+env(safe-area-inset-bottom))] pt-4 px-4 select-none">
      <main className="max-w-sm mx-auto space-y-3.5">
        <SubpageHeader title="Notifications" href="/" />

        <NotificationSettings />

        <NotificationList
          items={notifications.map((item) => ({
            ...item,
            createdAt: item.createdAt.toISOString(),
          }))}
        />
      </main>
    </div>
  );
}
