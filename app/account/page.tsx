import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import AccountForm from "@/app/account/AccountForm";
import TabHeader from "@/components/TabHeader";

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const [accountUser, latestWeight] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, age: true, heightCm: true, sex: true },
    }),
    prisma.bodyWeightLog.findFirst({
      where: { userId },
      orderBy: { loggedAt: "desc" },
      select: { weight: true },
    }),
  ]);

  if (!accountUser) redirect("/login");

  return (
    <div className="min-h-screen bg-[#baa3d0] text-white pb-[calc(8rem+env(safe-area-inset-bottom))] pt-4 px-4 select-none">
      <main className="max-w-sm mx-auto space-y-3.5">
        <TabHeader title="Account" />
        <AccountForm
          initial={{
            name: accountUser.name ?? "",
            email: accountUser.email,
            age: accountUser.age != null ? String(accountUser.age) : "",
            heightCm: accountUser.heightCm != null ? String(accountUser.heightCm) : "",
            sex: accountUser.sex ?? "",
            weight: latestWeight ? String(latestWeight.weight) : "",
          }}
        />
      </main>
    </div>
  );
}
