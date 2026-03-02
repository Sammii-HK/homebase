import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function getGitHub() {
  try {
    const [userRes, eventsRes] = await Promise.all([
      fetch("https://api.github.com/users/sammii-hk", {
        headers: { "User-Agent": "homebase-dashboard" },
        next: { revalidate: 300 },
      }),
      fetch("https://api.github.com/users/sammii-hk/events/public?per_page=50", {
        headers: { "User-Agent": "homebase-dashboard" },
        next: { revalidate: 300 },
      }),
    ]);
    const user = await userRes.json();
    const events = await eventsRes.json();
    const today = new Date().toISOString().slice(0, 10);
    const commitsToday = Array.isArray(events)
      ? events.filter((e: { type: string; created_at: string }) =>
          e.type === "PushEvent" && e.created_at?.startsWith(today)
        ).length
      : 0;
    return { repos: user.public_repos ?? 0, followers: user.followers ?? 0, commitsToday };
  } catch {
    return { repos: 0, followers: 0, commitsToday: 0 };
  }
}

async function getLunary() {
  const key = process.env.LUNARY_ADMIN_API_KEY;
  const url = process.env.LUNARY_URL ?? "https://lunary.app";
  if (!key) return { mau: 0, mrr: 0, subscribers: 0, activeToday: 0 };
  try {
    const res = await fetch(`${url}/api/internal/homebase-stats`, {
      headers: { Authorization: `Bearer ${key}` },
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.json();
  } catch (e) {
    console.error("[homebase] lunary fetch failed:", e);
    return { mau: 0, mrr: 0, subscribers: 0, activeToday: 0 };
  }
}

async function getSpellcast() {
  const secret = process.env.SPELLCAST_CRON_SECRET;
  const url = process.env.SPELLCAST_API_URL ?? "https://api.spellcast.sammii.dev";
  if (!secret) return { postsToday: 0, scheduled: 0, accounts: 0, igFollowers: 0, reachThisWeek: 0, postsThisWeek: 0 };
  try {
    const res = await fetch(`${url}/api/internal/homebase-stats`, {
      headers: { Authorization: `Bearer ${secret}` },
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.json();
  } catch (e) {
    console.error("[homebase] spellcast fetch failed:", e);
    return { postsToday: 0, scheduled: 0, accounts: 0, igFollowers: 0, reachThisWeek: 0, postsThisWeek: 0 };
  }
}

export async function GET() {
  const [github, lunary, spellcast] = await Promise.all([
    getGitHub(), getLunary(), getSpellcast(),
  ]);

  return NextResponse.json({
    github,
    lunary,
    spellcast,
    meta: {
      followers: spellcast.igFollowers ?? 0,
      reachThisWeek: spellcast.reachThisWeek ?? 0,
      postsThisWeek: spellcast.postsThisWeek ?? 0,
    },
    updatedAt: new Date().toISOString(),
  });
}
