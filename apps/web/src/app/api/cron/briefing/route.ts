import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";
import { sendPush } from "@/lib/send-push";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  const secret = process.env.HOMEBASE_SECRET;
  const port = process.env.PORT ?? "3005";

  // Warm the briefing cache by calling it with auth
  let urgentCount = 0;
  try {
    const res = await fetch(`http://localhost:${port}/api/briefing`, {
      headers: {
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      urgentCount = (data.items ?? []).filter(
        (i: { priority: string }) => i.priority === "urgent" || i.priority === "today"
      ).length;
    }
  } catch {
    // Briefing fetch failed — still send push
  }

  const body = urgentCount > 0
    ? `${urgentCount} item${urgentCount !== 1 ? "s" : ""} need your attention`
    : "All clear — no urgent items";

  await sendPush("☀ Morning briefing ready", body);

  return NextResponse.json({ ok: true, urgentCount });
}
