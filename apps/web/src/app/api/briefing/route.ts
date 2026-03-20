import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = checkAuth(req);
  if (denied) return denied;

  const orbitUrl = process.env.ORBIT_URL ?? "http://localhost:3001";
  const lunaryUrl = process.env.LUNARY_URL ?? "https://lunary.app";
  const lunaryKey = process.env.LUNARY_ADMIN_API_KEY;
  const spellcastUrl = process.env.SPELLCAST_API_URL ?? "https://api.spellcast.sammii.dev";
  const spellcastKey = process.env.SPELLCAST_API_KEY;

  const today = new Date().toISOString().slice(0, 10);

  try {
    // Phase 1: Try Orbit briefing (short timeout, may not exist)
    let orbitBriefing: Record<string, unknown> | null = null;
    try {
      const orbitRes = await fetch(`${orbitUrl}/api/state/briefing`, {
        signal: AbortSignal.timeout(3000),
        cache: "no-store",
      });
      if (orbitRes.ok) {
        orbitBriefing = await orbitRes.json();
      }
    } catch {
      // Orbit not available — that's fine
    }

    // Phase 2: Fetch live data in parallel
    const lunaryHeaders = lunaryKey
      ? { Authorization: `Bearer ${lunaryKey}` }
      : undefined;
    const spellcastHeaders = spellcastKey
      ? { Authorization: `Bearer ${spellcastKey}` }
      : undefined;

    const [lunaryRes, pendingRes, scheduledRes, failedRes, engagementRes] =
      await Promise.all([
        // Lunary stats
        lunaryHeaders
          ? fetch(`${lunaryUrl}/api/internal/homebase-stats`, {
              headers: lunaryHeaders,
              signal: AbortSignal.timeout(5000),
              cache: "no-store",
            }).catch(() => null)
          : Promise.resolve(null),

        // Spellcast: pending review
        spellcastHeaders
          ? fetch(
              `${spellcastUrl}/api/posts?status=pending_review&limit=50`,
              {
                headers: spellcastHeaders,
                signal: AbortSignal.timeout(5000),
                cache: "no-store",
              }
            ).catch(() => null)
          : Promise.resolve(null),

        // Spellcast: scheduled
        spellcastHeaders
          ? fetch(`${spellcastUrl}/api/posts?status=scheduled&limit=50`, {
              headers: spellcastHeaders,
              signal: AbortSignal.timeout(5000),
              cache: "no-store",
            }).catch(() => null)
          : Promise.resolve(null),

        // Spellcast: failed
        spellcastHeaders
          ? fetch(`${spellcastUrl}/api/posts?status=failed&limit=10`, {
              headers: spellcastHeaders,
              signal: AbortSignal.timeout(5000),
              cache: "no-store",
            }).catch(() => null)
          : Promise.resolve(null),

        // Spellcast: engagement stats
        spellcastHeaders
          ? fetch(`${spellcastUrl}/api/engagement/stats`, {
              headers: spellcastHeaders,
              signal: AbortSignal.timeout(5000),
              cache: "no-store",
            }).catch(() => null)
          : Promise.resolve(null),
      ]);

    // Parse Lunary metrics
    let dau = 0;
    let mau = 0;
    let mrr = 0;
    if (lunaryRes?.ok) {
      const data = await lunaryRes.json();
      dau = Number(data.activeToday ?? data.dau ?? 0);
      mau = Number(data.mau ?? 0);
      mrr = Number(data.mrr ?? 0);
    }

    // Parse pending review count
    let pendingReview = 0;
    if (pendingRes?.ok) {
      const data = await pendingRes.json();
      const arr = Array.isArray(data) ? data : data.posts ?? data.data ?? [];
      pendingReview = arr.length;
    }

    // Parse scheduled posts — count today's only
    let scheduledToday = 0;
    if (scheduledRes?.ok) {
      const data = await scheduledRes.json();
      const arr = Array.isArray(data) ? data : data.posts ?? data.data ?? [];
      scheduledToday = arr.filter(
        (p: { scheduledFor?: string; scheduledAt?: string }) =>
          (p.scheduledFor ?? p.scheduledAt ?? "").startsWith(today)
      ).length;
    }

    // Parse failed posts count
    let failedPosts = 0;
    if (failedRes?.ok) {
      const data = await failedRes.json();
      const arr = Array.isArray(data) ? data : data.posts ?? data.data ?? [];
      failedPosts = arr.length;
    }

    // Parse engagement stats
    let unread = 0;
    if (engagementRes?.ok) {
      const data = await engagementRes.json();
      unread = Number(data.unread ?? data.total ?? 0);
    }

    // Build smart alerts
    const alerts: string[] = [];
    if (failedPosts > 0) {
      alerts.push(`${failedPosts} post${failedPosts === 1 ? "" : "s"} failed overnight`);
    }
    if (pendingReview > 0) {
      alerts.push(
        `${pendingReview} post${pendingReview === 1 ? "" : "s"} waiting for your approval`
      );
    }
    if (scheduledToday === 0) {
      alerts.push("No content scheduled for today");
    }
    if (unread > 5) {
      alerts.push(`${unread} unread comments/DMs`);
    }

    return NextResponse.json({
      date: today,
      orbitBriefing,
      metrics: { dau, mau, mrr },
      content: {
        pendingReview,
        scheduledToday,
        failedPosts,
      },
      engagement: { unread },
      alerts,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[homebase] briefing fetch failed:", e);
    return NextResponse.json({ error: "Briefing fetch failed" }, { status: 502 });
  }
}
