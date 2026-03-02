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
      ? events.filter(
          (e: { type: string; created_at: string }) =>
            e.type === "PushEvent" && e.created_at?.startsWith(today)
        ).length
      : 0;

    return {
      repos: user.public_repos ?? 0,
      followers: user.followers ?? 0,
      commitsToday,
    };
  } catch {
    return { repos: 0, followers: 0, commitsToday: 0 };
  }
}

async function getLunary() {
  // TODO: wire to Lunary internal API — add LUNARY_INTERNAL_SECRET to .env
  // const res = await fetch(`${process.env.LUNARY_URL}/api/internal/stats`, {
  //   headers: { Authorization: `Bearer ${process.env.LUNARY_INTERNAL_SECRET}` }
  // })
  return {
    mau: 229,
    mrr: 22.5,
    activeToday: 14,
  };
}

async function getSpellcast() {
  // TODO: wire to Spellcast API — add SPELLCAST_API_KEY to .env
  // const res = await fetch(`${process.env.SPELLCAST_URL}/api/stats`, {
  //   headers: { Authorization: `Bearer ${process.env.SPELLCAST_API_KEY}` }
  // })
  return {
    postsToday: 7,
    scheduled: 31,
    accounts: 14,
  };
}

async function getMeta() {
  // TODO: wire to Spellcast Instagram analytics endpoint — add SPELLCAST_API_KEY to .env
  // const res = await fetch(`${process.env.SPELLCAST_URL}/api/analytics/instagram`, {
  //   headers: { Authorization: `Bearer ${process.env.SPELLCAST_API_KEY}` }
  // })
  return {
    followers: 1240,
    reachThisWeek: 4500,
    postsThisWeek: 5,
  };
}

export async function GET() {
  const [github, lunary, spellcast, meta] = await Promise.all([
    getGitHub(),
    getLunary(),
    getSpellcast(),
    getMeta(),
  ]);

  return NextResponse.json({
    github,
    lunary,
    spellcast,
    meta,
    updatedAt: new Date().toISOString(),
  });
}
