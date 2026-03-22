import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";
import { sendPush } from "@/lib/send-push";

export const dynamic = "force-dynamic";

/**
 * Cron: detect content gaps in the next 7 days and auto-trigger Orbit generation.
 * Run daily at 06:00 UTC. After briefing cron fires, before anyone wakes up.
 */
export async function POST(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  const spellcastUrl = process.env.SPELLCAST_API_URL ?? "https://api.spellcast.sammii.dev";
  const spellcastKey = process.env.SPELLCAST_API_KEY;
  const cronSecret = process.env.SPELLCAST_CRON_SECRET;
  const orbitUrl = process.env.ORBIT_URL ?? "http://localhost:3001";

  if (!spellcastKey) {
    return NextResponse.json({ error: "No Spellcast API key" }, { status: 500 });
  }

  try {
    // Fetch scheduled posts for next 7 days
    const now = new Date();
    const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const res = await fetch(
      `${spellcastUrl}/api/posts?status=SCHEDULED&limit=100`,
      {
        headers: { Authorization: `Bearer ${spellcastKey}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch scheduled posts" }, { status: 502 });
    }

    const data = await res.json();
    const posts: { scheduledFor?: string; publishDate?: string }[] =
      Array.isArray(data) ? data : data.posts ?? data.data ?? [];

    // Build set of dates that have posts
    const coveredDates = new Set<string>();
    for (const post of posts) {
      const dateStr = post.scheduledFor ?? post.publishDate;
      if (!dateStr) continue;
      const d = new Date(dateStr);
      if (d >= now && d <= in7d) {
        coveredDates.add(d.toISOString().split("T")[0]);
      }
    }

    // Find gap days (skip today — too late to fill)
    const gapDays: string[] = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const dateKey = d.toISOString().split("T")[0];
      if (!coveredDates.has(dateKey)) {
        gapDays.push(dateKey);
      }
    }

    if (gapDays.length === 0) {
      return NextResponse.json({ ok: true, message: "No gaps found", gaps: 0 });
    }

    // Auto-trigger Orbit generation pipeline (fire and forget)
    let pipelineTriggered = false;
    if (orbitUrl) {
      try {
        await fetch(`${orbitUrl}/api/pipeline/trigger`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "gap-fill", gapDays }),
          signal: AbortSignal.timeout(5000),
        });
        pipelineTriggered = true;
      } catch {
        // Orbit offline — try Spellcast autopilot as fallback
      }
    }

    // Fallback: trigger Spellcast autopilot
    if (!pipelineTriggered && cronSecret) {
      try {
        await fetch(`${spellcastUrl}/api/cron/autopilot`, {
          method: "POST",
          headers: { Authorization: `Bearer ${cronSecret}`, "Content-Type": "application/json" },
          signal: AbortSignal.timeout(5000),
        });
        pipelineTriggered = true;
      } catch {
        // best effort
      }
    }

    // Send push notification
    const gapStr = gapDays.length === 1 ? gapDays[0] : `${gapDays.length} days`;
    await sendPush(
      `⚡ Content gap detected — auto-filling`,
      `${gapStr} had no posts. Generation triggered.`
    );

    return NextResponse.json({
      ok: true,
      gaps: gapDays.length,
      gapDays,
      pipelineTriggered,
      message: `Found ${gapDays.length} gap day(s), generation triggered`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
