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
  if (!key) return { mau: 229, mrr: 22.5, subscribers: 3, activeToday: 14 };
  try {
    const res = await fetch(`${url}/api/internal/homebase-stats`, {
      headers: { Authorization: `Bearer ${key}` },
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.json();
  } catch {
    return { mau: 229, mrr: 22.5, subscribers: 3, activeToday: 14 };
  }
}

async function getSpellcast() {
  // TODO: add /api/internal/homebase-stats to Spellcast API
  return { postsToday: 7, scheduled: 31, accounts: 14 };
}

async function getMeta() {
  // TODO: wire to Spellcast Instagram analytics
  return { followers: 1240, reachThisWeek: 4500, postsThisWeek: 5 };
}

export async function GET() {
  const [github, lunary, spellcast, meta] = await Promise.all([
    getGitHub(), getLunary(), getSpellcast(), getMeta(),
  ]);
  return NextResponse.json({ github, lunary, spellcast, meta, updatedAt: new Date().toISOString() });
}
