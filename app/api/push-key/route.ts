import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Public VAPID key for service-worker re-subscription. Public by design. */
export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return NextResponse.json({ error: "Push not configured" }, { status: 500 });
  }
  return NextResponse.json({ publicKey });
}
