import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** E2E-only introspection (requires the test hatch, 404 otherwise). */
export async function GET(req: Request) {
  if (process.env.ALLOW_MEMORY_RATELIMIT !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const sessionId = new URL(req.url).searchParams.get("sessionId");
  const timers = await prisma.restTimer.findMany({
    where: { userId: session.user.id, ...(sessionId ? { workoutLogId: sessionId } : {}) },
    orderBy: { createdAt: "desc" },
    select: { token: true, status: true, workoutLogId: true, fireAt: true, createdAt: true },
  });
  return NextResponse.json({
    timers: timers.map((timer) => ({
      ...timer,
      fireAt: timer.fireAt?.toISOString() ?? null,
      createdAt: timer.createdAt.toISOString(),
    })),
  });
}
