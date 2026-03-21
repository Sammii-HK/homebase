import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// ── Known account data ───────────────────────────────────────────────
// Follower counts seeded from known values; live data overlays when available.

interface AccountDef {
  platform: string;
  handle: string;
  followerCount: number;
}

interface Persona {
  name: string;
  accounts: AccountDef[];
}

const PERSONAS: Persona[] = [
  {
    name: "Sammii Personal",
    accounts: [
      { platform: "X", handle: "@sammiihk", followerCount: 0 },
      { platform: "LinkedIn", handle: "sammiihk", followerCount: 0 },
      { platform: "Instagram", handle: "@sammiispellbound", followerCount: 52 },
      { platform: "Threads", handle: "@sammiispellbound", followerCount: 0 },
      { platform: "Bluesky", handle: "@sammiisparkle.bsky.social", followerCount: 0 },
    ],
  },
  {
    name: "Sammii Sparkle",
    accounts: [
      { platform: "Instagram", handle: "@sammiisparkle", followerCount: 604 },
      { platform: "Threads", handle: "@sammiisparkle", followerCount: 0 },
      { platform: "TikTok", handle: "@sammiisparkle", followerCount: 0 },
      { platform: "Facebook", handle: "sammiisparkle", followerCount: 0 },
    ],
  },
  {
    name: "Lunary",
    accounts: [
      { platform: "X", handle: "@LunaryApp", followerCount: 0 },
      { platform: "Instagram", handle: "@lunary.app", followerCount: 39 },
      { platform: "Threads", handle: "@lunary.app", followerCount: 0 },
      { platform: "TikTok", handle: "@lunary.app", followerCount: 0 },
      { platform: "YouTube", handle: "@lunaryapp", followerCount: 0 },
      { platform: "Bluesky", handle: "@lunaryapp.bsky.social", followerCount: 0 },
      { platform: "Facebook", handle: "lunaryapp", followerCount: 0 },
      { platform: "Mastodon", handle: "@lunaryapp", followerCount: 0 },
    ],
  },
  {
    name: "Crystal",
    accounts: [
      { platform: "Instagram", handle: "@thecrystalindex", followerCount: 0 },
      { platform: "Instagram", handle: "@crystalofthedayapp", followerCount: 0 },
      { platform: "Threads", handle: "@thecrystalindex", followerCount: 0 },
      { platform: "Threads", handle: "@crystalofthedayapp", followerCount: 0 },
    ],
  },
  {
    name: "Scape",
    accounts: [
      { platform: "X", handle: "@scapesquared", followerCount: 0 },
      { platform: "Instagram", handle: "@scapesquared", followerCount: 0 },
      { platform: "Threads", handle: "@scapesquared", followerCount: 0 },
      { platform: "Facebook", handle: "scapesquared", followerCount: 0 },
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────

function normaliseHandle(handle: string): string {
  return handle.replace(/^@/, "").toLowerCase();
}

function getWindowStart(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString();
}

// ── Spellcast data fetchers ──────────────────────────────────────────

interface SpellcastAnalytics {
  accounts?: {
    id: string;
    handle?: string;
    username?: string;
    platform?: string;
    followers?: number;
    followersCount?: number;
  }[];
  [key: string]: unknown;
}

interface SpellcastPost {
  id: string;
  socialAccount?: { handle?: string; username?: string; platform?: string };
  platform?: string;
  handle?: string;
  publishedAt?: string;
  scheduledAt?: string;
  scheduledFor?: string;
  createdAt?: string;
  [key: string]: unknown;
}

interface SpellcastEngagement {
  byAccount?: Record<string, { unread?: number; total?: number }>;
  [key: string]: unknown;
}

async function fetchSpellcastAnalytics(
  url: string,
  headers: Record<string, string>
): Promise<SpellcastAnalytics> {
  try {
    const res = await fetch(`${url}/api/analytics`, {
      headers,
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

async function fetchSpellcastPosts(
  url: string,
  headers: Record<string, string>
): Promise<SpellcastPost[]> {
  try {
    const res = await fetch(`${url}/api/posts?status=published&limit=100`, {
      headers,
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : data.posts ?? data.data ?? [];
  } catch {
    return [];
  }
}

async function fetchSpellcastEngagement(
  url: string,
  headers: Record<string, string>
): Promise<SpellcastEngagement> {
  try {
    const res = await fetch(`${url}/api/engagement/stats`, {
      headers,
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

// ── Post counting ────────────────────────────────────────────────────

function getPostDate(post: SpellcastPost): string {
  return (
    post.publishedAt ?? post.scheduledAt ?? post.scheduledFor ?? post.createdAt ?? ""
  );
}

function countPostsForHandle(
  posts: SpellcastPost[],
  handle: string,
  since: string
): number {
  const norm = normaliseHandle(handle);
  return posts.filter((p) => {
    const postHandle = normaliseHandle(
      p.socialAccount?.handle ??
        p.socialAccount?.username ??
        p.handle ??
        ""
    );
    const date = getPostDate(p);
    return postHandle === norm && date >= since;
  }).length;
}

// ── Route handler ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  const apiKey = process.env.SPELLCAST_API_KEY;
  const url = process.env.SPELLCAST_API_URL ?? "https://api.spellcast.sammii.dev";
  const headers: Record<string, string> = apiKey
    ? { Authorization: `Bearer ${apiKey}` }
    : {};

  const weekAgo = getWindowStart(7);
  const monthAgo = getWindowStart(30);

  const [analytics, posts, engagement] = await Promise.all([
    fetchSpellcastAnalytics(url, headers),
    fetchSpellcastPosts(url, headers),
    fetchSpellcastEngagement(url, headers),
  ]);

  // Build a lookup of handle -> followerCount from Spellcast analytics
  const liveFollowers: Record<string, number> = {};
  const analyticsAccounts = analytics.accounts ?? [];
  for (const acc of analyticsAccounts) {
    const handle = normaliseHandle(acc.handle ?? acc.username ?? "");
    if (handle) {
      liveFollowers[handle] =
        Number(acc.followers ?? acc.followersCount ?? 0);
    }
  }

  // Build grouped response
  const grouped = PERSONAS.map((persona) => ({
    persona: persona.name,
    accounts: persona.accounts.map((acc) => {
      const normHandle = normaliseHandle(acc.handle);
      // Prefer live follower count from Spellcast; fall back to seeded value
      const followerCount = liveFollowers[normHandle] ?? acc.followerCount;

      return {
        platform: acc.platform,
        handle: acc.handle,
        followerCount,
        postsThisWeek: countPostsForHandle(posts, acc.handle, weekAgo),
        postsThisMonth: countPostsForHandle(posts, acc.handle, monthAgo),
      };
    }),
  }));

  return NextResponse.json({
    personas: grouped,
    engagement: {
      unread: Number((engagement as { unread?: number }).unread ?? 0),
      total: Number((engagement as { total?: number }).total ?? 0),
      byAccount: (engagement as SpellcastEngagement).byAccount ?? {},
    },
    updatedAt: new Date().toISOString(),
  });
}
