import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  const apiKey = process.env.SPELLCAST_API_KEY;
  const url = process.env.SPELLCAST_API_URL ?? "https://api.spellcast.sammii.dev";
  if (!apiKey) {
    return NextResponse.json({ error: "No API key" }, { status: 500 });
  }

  const headers = { Authorization: `Bearer ${apiKey}` };

  try {
    const [failedRes, scheduledRes, engagementRes, velocityRes, autopilotRes] = await Promise.all([
      fetch(`${url}/api/posts?status=failed&limit=20`, { headers, cache: "no-store" }),
      fetch(`${url}/api/posts?status=scheduled&limit=100`, { headers, cache: "no-store" }),
      fetch(`${url}/api/engagement?status=unread&limit=1`, { headers, cache: "no-store" }).catch(() => null),
      fetch(`${url}/api/analytics/velocity?hours=48`, { headers, cache: "no-store" }).catch(() => null),
      fetch(`${url}/api/autopilot`, { headers, cache: "no-store" }).catch(() => null),
    ]);

    // Failed posts
    const failedData = failedRes.ok ? await failedRes.json() : {};
    const failedArr = Array.isArray(failedData) ? failedData : failedData.posts ?? failedData.data ?? [];
    const failedPosts = failedArr.map((p: Record<string, unknown>) => ({
      id: String(p.id ?? p._id ?? ""),
      content: String(p.content ?? p.text ?? "").slice(0, 100),
      platform: String((p.socialAccount as Record<string, unknown>)?.platform ?? p.platform ?? "unknown"),
      error: String(p.error ?? p.failedReason ?? p.errorMessage ?? "Unknown error"),
      scheduledFor: String(p.scheduledFor ?? p.scheduledAt ?? p.scheduledDate ?? ""),
    }));

    // Scheduled posts — group by day for calendar + queue
    const scheduledData = scheduledRes.ok ? await scheduledRes.json() : {};
    const scheduledArr = Array.isArray(scheduledData) ? scheduledData : scheduledData.posts ?? scheduledData.data ?? [];

    // Build 7-day calendar
    const calendar: { date: string; count: number; status: "good" | "gap" | "overloaded" }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.now() + i * 86_400_000).toISOString().slice(0, 10);
      const count = scheduledArr.filter(
        (p: { scheduledFor?: string; scheduledAt?: string }) =>
          (p.scheduledFor ?? p.scheduledAt ?? "").startsWith(d)
      ).length;
      calendar.push({
        date: d,
        count,
        status: count === 0 ? "gap" : count > 6 ? "overloaded" : "good",
      });
    }

    // Queue by day
    const queueMap: Record<string, number> = {};
    for (const p of scheduledArr) {
      const d = (p.scheduledFor ?? p.scheduledAt ?? "").slice(0, 10);
      if (d) queueMap[d] = (queueMap[d] ?? 0) + 1;
    }
    const queueByDay = Object.entries(queueMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 14)
      .map(([date, count]) => ({ date, count }));

    // Engagement
    let engagement = { unread: 0, total: 0 };
    if (engagementRes?.ok) {
      const engData = await engagementRes.json();
      engagement = {
        unread: engData.total ?? engData.unread ?? 0,
        total: engData.totalAll ?? engData.total ?? 0,
      };
    }

    // Velocity
    let velocity: { hour: string; count: number }[] = [];
    if (velocityRes?.ok) {
      const velData = await velocityRes.json();
      velocity = Array.isArray(velData) ? velData : velData.data ?? [];
    }

    // Autopilot
    let autopilot = { enabled: false, lastRun: null as string | null };
    if (autopilotRes?.ok) {
      const apData = await autopilotRes.json();
      autopilot = {
        enabled: apData.enabled ?? false,
        lastRun: apData.lastRun ?? apData.lastRunAt ?? null,
      };
    }

    return NextResponse.json({
      failedPosts,
      calendar,
      velocity,
      queueByDay,
      autopilot,
      engagement,
    });
  } catch (e) {
    console.error("[homebase] spellcast deep fetch failed:", e);
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  }
}
