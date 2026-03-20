import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// US-optimised posting slots (UTC hours)
// 14:00 (10am ET), 16:00 (12pm ET), 17:00 (1pm ET), 21:00 (5pm ET), 22:00 (6pm ET), 01:00+1 (9pm ET)
const SLOT_HOURS_UTC = [14, 16, 17, 21, 22, 25]; // 25 = 01:00 next day

async function getScheduledTimes(apiKey: string, spellcastUrl: string): Promise<Set<string>> {
  try {
    const res = await fetch(`${spellcastUrl}/api/posts?status=scheduled&limit=200`, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return new Set();
    const data = await res.json();
    const posts = Array.isArray(data) ? data : data.posts ?? data.data ?? [];
    const times = new Set<string>();
    for (const p of posts) {
      const t = p.scheduledFor ?? p.scheduledAt ?? p.scheduledDate ?? "";
      if (t) times.add(t.slice(0, 13)); // key by YYYY-MM-DDTHH
    }
    return times;
  } catch {
    return new Set();
  }
}

function pickNextSlot(scheduledKeys: Set<string>): string {
  const now = new Date();

  // Try slots starting from today, up to 7 days out
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    for (const hourUtc of SLOT_HOURS_UTC) {
      const actualHour = hourUtc % 24;
      const actualDayOffset = dayOffset + Math.floor(hourUtc / 24);

      const candidate = new Date(now);
      candidate.setUTCDate(candidate.getUTCDate() + actualDayOffset);
      candidate.setUTCHours(actualHour, 0, 0, 0);

      // Skip times in the past (need at least 15 min buffer)
      if (candidate.getTime() < now.getTime() + 15 * 60_000) continue;

      const key = candidate.toISOString().slice(0, 13);
      if (!scheduledKeys.has(key)) {
        return candidate.toISOString();
      }
    }
  }

  // Fallback: 24 hours from now
  return new Date(now.getTime() + 24 * 60 * 60_000).toISOString();
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = checkAuth(req);
  if (denied) return denied;

  const { id } = await params;
  const apiKey = process.env.SPELLCAST_API_KEY;
  const spellcastUrl = process.env.SPELLCAST_API_URL ?? "https://api.spellcast.sammii.dev";

  if (!apiKey) {
    return NextResponse.json({ error: "No API key configured" }, { status: 500 });
  }

  // Orbit posts are not schedulable via Spellcast
  if (id.startsWith("orbit-")) {
    return NextResponse.json({ error: "Orbit posts cannot be scheduled via this endpoint yet" }, { status: 400 });
  }

  let body: { scheduledDate?: string } = {};
  try {
    body = await req.json();
  } catch {
    // No body is fine - we'll pick a default slot
  }

  let scheduledDate = body.scheduledDate;

  if (!scheduledDate) {
    // Pick next available US-optimised slot
    const existing = await getScheduledTimes(apiKey, spellcastUrl);
    scheduledDate = pickNextSlot(existing);
  }

  try {
    const res = await fetch(`${spellcastUrl}/api/posts/${id}/schedule`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ date: scheduledDate }),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: `Schedule failed: ${err}` },
        { status: res.status }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Post approved and scheduled",
      scheduledDate,
    });
  } catch (e) {
    console.error("[homebase] approve failed:", e);
    return NextResponse.json({ error: "Failed to approve post" }, { status: 502 });
  }
}
