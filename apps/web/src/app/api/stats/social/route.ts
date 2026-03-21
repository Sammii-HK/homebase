import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// ── Platform normalisation ────────────────────────────────────────────

const PLATFORM_DISPLAY: Record<string, string> = {
  instagram: "Instagram",
  threads: "Threads",
  twitter: "X",
  x: "X",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  bluesky: "Bluesky",
  facebook: "Facebook",
  mastodon: "Mastodon",
  hashnode: "Hashnode",
  devto: "Dev.to",
  reddit: "Reddit",
};

function normalisePlatform(raw: string): string {
  return PLATFORM_DISPLAY[raw.toLowerCase()] ?? raw;
}

// ── Display overrides ─────────────────────────────────────────────────
// Accounts that live in one Spellcast account set but should be
// displayed under a different persona name in the dashboard.
// Key: "platform:platformAccountId" (lowercase)
const DISPLAY_PERSONA_OVERRIDE: Record<string, string> = {
  "bluesky:sammiisparkle.bsky.social": "sammii sparkle",
  "mastodon:sammiisparkle": "sammii sparkle",
  "twitter:sammiihk": "sammii sparkle",
};

// ── Spellcast types ───────────────────────────────────────────────────

interface SpellcastSocialAccount {
  id: string;
  platform: string;
  platformAccountId: string;
  displayName?: string;
}

interface SpellcastAccountSet {
  id: string;
  name: string;
  socialAccounts: SpellcastSocialAccount[];
}

interface SpellcastPost {
  id: string;
  accountSetId?: string;
  selectedIntegrationIds?: string; // JSON array of social account IDs
  publishedAt?: string;
  scheduledAt?: string;
  scheduledFor?: string;
  createdAt?: string;
  [key: string]: unknown;
}

interface SpellcastEngagement {
  unread?: number;
  total?: number;
  byAccount?: Record<string, { unread?: number; total?: number }>;
  [key: string]: unknown;
}

interface SpellcastPostAnalytics {
  postId?: string;
  id?: string;
  likes?: number;
  likeCount?: number;
  comments?: number;
  commentCount?: number;
  shares?: number;
  shareCount?: number;
  reach?: number;
  impressions?: number;
  [key: string]: unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────

function normaliseHandle(handle: string): string {
  return handle.replace(/^@/, "").toLowerCase();
}

function getWindowStart(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString();
}

function getPostDate(post: SpellcastPost): string {
  return post.publishedAt ?? post.scheduledAt ?? post.scheduledFor ?? post.createdAt ?? "";
}

/** Count posts where the social account UUID appears in selectedIntegrationIds */
function countPostsForSocialAccountId(
  posts: SpellcastPost[],
  socialAccountId: string,
  since: string
): number {
  return posts.filter((p) => {
    const date = getPostDate(p);
    if (!date || date < since) return false;
    try {
      const ids: string[] = JSON.parse(p.selectedIntegrationIds ?? "[]");
      return ids.includes(socialAccountId);
    } catch {
      return false;
    }
  }).length;
}

/** Clean up handle for display — strip internal Postiz IDs, use displayName instead */
function cleanHandle(platformAccountId: string, displayName?: string): string {
  // Internal Postiz IDs look like "cmlz0sdxa0001p672p4p6lhj5" — starts with cm + 20+ alphanum
  if (/^cm[a-z0-9]{20,}$/.test(platformAccountId)) {
    if (displayName) return displayName.replace(/\s*\(@[^)]+\)$/, "").trim();
    return "—";
  }
  return `@${platformAccountId}`;
}

// ── Data fetchers ─────────────────────────────────────────────────────

async function fetchAccountSets(
  url: string,
  headers: Record<string, string>
): Promise<SpellcastAccountSet[]> {
  try {
    const res = await fetch(`${url}/api/account-sets`, {
      headers,
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : data.accountSets ?? data.data ?? [];
  } catch {
    return [];
  }
}

async function fetchPosts(
  url: string,
  headers: Record<string, string>
): Promise<SpellcastPost[]> {
  try {
    const res = await fetch(`${url}/api/posts?status=published&limit=200`, {
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

async function fetchEngagement(
  url: string,
  headers: Record<string, string>
): Promise<SpellcastEngagement> {
  try {
    const res = await fetch(`${url}/api/engagement/stats`, {
      headers,
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

interface FollowerGrowthSnapshot {
  snapshotDate: string;
  followerCount: number;
}

interface FollowerGrowthEntry {
  socialAccountId: string;
  displayName: string;
  platform: string;
  snapshots: FollowerGrowthSnapshot[];
}

interface FollowerGrowthData {
  current: number | null;
  sevenDaysAgo: number | null;
}

/** Fetch Instagram follower growth snapshots from /api/analytics/follower-growth.
 *  Returns a map of socialAccountId -> { current, sevenDaysAgo }. */
async function fetchFollowerGrowth(
  url: string,
  headers: Record<string, string>
): Promise<Record<string, FollowerGrowthData>> {
  const result: Record<string, FollowerGrowthData> = {};
  try {
    const res = await fetch(`${url}/api/analytics/follower-growth`, {
      headers,
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) return result;
    const data: FollowerGrowthEntry[] = await res.json();
    const entries = Array.isArray(data) ? data : [];

    for (const entry of entries) {
      if (!entry.socialAccountId || !Array.isArray(entry.snapshots) || entry.snapshots.length === 0) continue;

      const sorted = [...entry.snapshots].sort((a, b) =>
        a.snapshotDate > b.snapshotDate ? -1 : 1
      );

      const current = sorted[0].followerCount;

      let sevenDaysAgo: number | null = null;
      if (sorted.length > 1) {
        const now = Date.now();
        const target = now - 7 * 86_400_000;
        // Find snapshot closest to 7 days ago within a 3-10 day window
        const windowMin = now - 10 * 86_400_000;
        const windowMax = now - 3 * 86_400_000;
        let best: FollowerGrowthSnapshot | null = null;
        let bestDist = Infinity;
        for (const snap of sorted.slice(1)) {
          const ts = new Date(snap.snapshotDate).getTime();
          if (ts < windowMin || ts > windowMax) continue;
          const dist = Math.abs(ts - target);
          if (dist < bestDist) {
            bestDist = dist;
            best = snap;
          }
        }
        if (best) sevenDaysAgo = best.followerCount;
      }

      result[entry.socialAccountId] = { current, sevenDaysAgo };
    }
  } catch {
    // follower-growth endpoint not available — counts will show as 0
  }
  return result;
}

/** Fetch Bluesky follower counts via the free public API (no auth needed).
 *  Returns a map of lowercased handle -> followersCount. */
async function fetchBskyFollowers(
  handles: string[]
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  if (handles.length === 0) return result;

  await Promise.all(
    handles.map(async (handle) => {
      const key = normaliseHandle(handle);
      try {
        const res = await fetch(
          `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(handle)}`,
          { signal: AbortSignal.timeout(5000), cache: "no-store" }
        );
        if (!res.ok) {
          result[key] = 0;
          return;
        }
        const data = await res.json();
        result[key] = Number(data.followersCount ?? 0);
      } catch {
        result[key] = 0;
      }
    })
  );

  return result;
}

/** Fetch analytics for a single post. Returns null if unavailable. */
async function fetchPostAnalytics(
  url: string,
  headers: Record<string, string>,
  postId: string
): Promise<SpellcastPostAnalytics | null> {
  try {
    const res = await fetch(`${url}/api/posts/${postId}/analytics`, {
      headers,
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function extractEngagement(pa: SpellcastPostAnalytics): number {
  return (
    Number(pa.likes ?? pa.likeCount ?? 0) +
    Number(pa.comments ?? pa.commentCount ?? 0) +
    Number(pa.shares ?? pa.shareCount ?? 0)
  );
}

function extractReach(pa: SpellcastPostAnalytics): number {
  return Number(pa.reach ?? pa.impressions ?? 0);
}

// ── Route handler ─────────────────────────────────────────────────────

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

  const [accountSets, posts, engagement, followerGrowth] = await Promise.all([
    fetchAccountSets(url, headers),
    fetchPosts(url, headers),
    fetchEngagement(url, headers),
    fetchFollowerGrowth(url, headers),
  ]);

  // Collect Bluesky handles for the public API call
  const bskyHandles = accountSets
    .flatMap((s) => s.socialAccounts)
    .filter((a) => a.platform.toLowerCase() === "bluesky")
    .map((a) => a.platformAccountId);
  const bskyFollowers = await fetchBskyFollowers(bskyHandles);

  // Fetch analytics for posts published in the last 7 days (cap at 30 to avoid hammering API)
  const recentPosts = posts.filter((p) => {
    const date = getPostDate(p);
    return date && date >= weekAgo;
  });
  const postsToAnalyse = recentPosts.slice(0, 30);
  const postAnalyticsResults = await Promise.all(
    postsToAnalyse.map((p) => fetchPostAnalytics(url, headers, p.id))
  );
  // Build a map: postId -> analytics
  const postAnalyticsMap = new Map<string, SpellcastPostAnalytics>();
  for (let i = 0; i < postsToAnalyse.length; i++) {
    const pa = postAnalyticsResults[i];
    if (pa) postAnalyticsMap.set(postsToAnalyse[i].id, pa);
  }

  // Helper: given a social account UUID, sum engagement and find best reach across recent posts
  function getAccountPostMetrics(socialAccountId: string): {
    engagementLast7d: number | null;
    bestPostReach: number | null;
  } {
    let totalEngagement = 0;
    let bestReach = 0;
    let hasAnyAnalytics = false;

    for (const post of postsToAnalyse) {
      try {
        const ids: string[] = JSON.parse(post.selectedIntegrationIds ?? "[]");
        if (!ids.includes(socialAccountId)) continue;
      } catch {
        continue;
      }
      const pa = postAnalyticsMap.get(post.id);
      if (!pa) continue;
      hasAnyAnalytics = true;
      totalEngagement += extractEngagement(pa);
      const reach = extractReach(pa);
      if (reach > bestReach) bestReach = reach;
    }

    return {
      engagementLast7d: hasAnyAnalytics ? totalEngagement : null,
      bestPostReach: hasAnyAnalytics && bestReach > 0 ? bestReach : null,
    };
  }

  // Build persona groups, respecting display overrides
  // Step 1: collect overridden accounts to inject into target personas
  interface AccountRowData {
    platform: string;
    handle: string;
    displayName: string;
    followerCount: number;
    postsThisWeek: number;
    postsThisMonth: number;
    followersChange7d: number | null;
    postsLast7d: number;
    engagementLast7d: number | null;
    bestPostReach: number | null;
  }
  const overflowAccounts: Record<string, AccountRowData[]> = {};

  const personas = accountSets
    .filter((set) => set.socialAccounts && set.socialAccounts.length > 0)
    .map((set) => {
      const kept: AccountRowData[] = [];
      for (const acc of set.socialAccounts) {
        const overrideKey = `${acc.platform.toLowerCase()}:${acc.platformAccountId.toLowerCase()}`;
        const targetPersona = DISPLAY_PERSONA_OVERRIDE[overrideKey];
        const platform = acc.platform.toLowerCase();

        let followerCount = 0;
        let followersChange7d: number | null = null;

        if (platform === "instagram") {
          const growth = followerGrowth[acc.id];
          followerCount = growth?.current ?? 0;
          if (growth?.current != null && growth.sevenDaysAgo != null) {
            followersChange7d = growth.current - growth.sevenDaysAgo;
          }
        } else if (platform === "bluesky") {
          followerCount = bskyFollowers[normaliseHandle(acc.platformAccountId)] ?? 0;
          // No historical data for Bluesky
          followersChange7d = null;
        } else {
          followerCount = 0;
          followersChange7d = null;
        }

        const { engagementLast7d, bestPostReach } = getAccountPostMetrics(acc.id);
        const row: AccountRowData = {
          platform: normalisePlatform(acc.platform),
          handle: cleanHandle(acc.platformAccountId, acc.displayName),
          displayName: acc.displayName ?? acc.platformAccountId,
          followerCount,
          postsThisWeek: countPostsForSocialAccountId(posts, acc.id, weekAgo),
          postsThisMonth: countPostsForSocialAccountId(posts, acc.id, monthAgo),
          followersChange7d,
          postsLast7d: countPostsForSocialAccountId(posts, acc.id, weekAgo),
          engagementLast7d,
          bestPostReach,
        };
        if (targetPersona) {
          const key = targetPersona.toLowerCase();
          overflowAccounts[key] = overflowAccounts[key] ?? [];
          overflowAccounts[key].push(row);
        } else {
          kept.push(row);
        }
      }
      return { persona: set.name, accounts: kept };
    })
    // Inject overridden accounts into their target personas
    .map((group) => {
      const key = group.persona.toLowerCase();
      const extras = overflowAccounts[key] ?? [];
      return { ...group, accounts: [...group.accounts, ...extras] };
    })
    // Drop personas that now have no accounts
    .filter((group) => group.accounts.length > 0);

  return NextResponse.json({
    personas,
    engagement: {
      unread: Number((engagement as SpellcastEngagement).unread ?? 0),
      total: Number((engagement as SpellcastEngagement).total ?? 0),
      byAccount: (engagement as SpellcastEngagement).byAccount ?? {},
    },
    updatedAt: new Date().toISOString(),
  });
}
