import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// ── In-memory trend storage (survives within same instance) ─────────

interface StoredSnapshot {
  ts: number;
  lunary: { mau: number; mrr: number; activeToday: number };
  seo: { impressions: number; clicks: number };
  spellcast: { postsToday: number };
}

const g = global as typeof globalThis & { _prevSnapshot?: StoredSnapshot };

// ── Data fetchers ───────────────────────────────────────────────────

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
  if (!secret)
    return { postsToday: 0, scheduled: 0, accounts: 0, igFollowers: 0, reachThisWeek: 0, postsThisWeek: 0 };
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

// ── Health checks ───────────────────────────────────────────────────

async function checkService(
  url: string,
  headers?: Record<string, string>
): Promise<{ status: "ok" | "down"; latencyMs: number }> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    return { status: res.ok ? "ok" : "down", latencyMs: Date.now() - start };
  } catch {
    return { status: "down", latencyMs: Date.now() - start };
  }
}

async function getHealth() {
  const lunaryUrl = process.env.LUNARY_URL ?? "https://lunary.app";
  const spellcastUrl = process.env.SPELLCAST_API_URL ?? "https://api.spellcast.sammii.dev";
  const contentUrl = process.env.CONTENT_CREATOR_URL ?? "https://content.sammii.dev";
  const key = process.env.LUNARY_ADMIN_API_KEY;
  const spellcastKey = process.env.SPELLCAST_API_KEY ?? process.env.SPELLCAST_CRON_SECRET;

  const [lunary, spellcast, contentCreator] = await Promise.all([
    checkService(
      `${lunaryUrl}/api/admin/health/db`,
      key ? { Authorization: `Bearer ${key}` } : undefined
    ),
    checkService(
      `${spellcastUrl}/api/health`,
      spellcastKey ? { Authorization: `Bearer ${spellcastKey}` } : undefined
    ),
    checkService(`${contentUrl}/api/health`),
  ]);

  return { lunary, spellcast, contentCreator };
}

// ── Content pipeline ────────────────────────────────────────────────

async function getContentPipeline() {
  const apiKey = process.env.SPELLCAST_API_KEY;
  const url = process.env.SPELLCAST_API_URL ?? "https://api.spellcast.sammii.dev";
  if (!apiKey) return { failedPosts: 0, failedPostDetails: [], scheduledToday: 0, scheduledTomorrow: 0, queueDepth: 0 };

  const headers = { Authorization: `Bearer ${apiKey}` };

  try {
    const [failedRes, scheduledRes] = await Promise.all([
      fetch(`${url}/api/posts?status=failed&limit=100`, { headers, next: { revalidate: 300 } }),
      fetch(`${url}/api/posts?status=scheduled&limit=100`, { headers, next: { revalidate: 300 } }),
    ]);

    const failedData = failedRes.ok ? await failedRes.json() : {};
    const scheduledData = scheduledRes.ok ? await scheduledRes.json() : {};

    const failedPosts = Array.isArray(failedData) ? failedData : failedData.posts ?? failedData.data ?? [];
    const scheduledPosts = Array.isArray(scheduledData) ? scheduledData : scheduledData.posts ?? scheduledData.data ?? [];

    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

    // Extract up to 5 failed post details for drill-down
    const failedPostDetails = failedPosts.slice(0, 5).map((p: Record<string, unknown>) => ({
      id: String(p.id ?? p._id ?? ""),
      content: String(p.content ?? p.text ?? "").slice(0, 100),
      platform: String((p.socialAccount as Record<string, unknown>)?.platform ?? p.platform ?? "unknown"),
      error: String(p.error ?? p.failedReason ?? p.errorMessage ?? "Unknown error"),
      scheduledFor: String(p.scheduledFor ?? p.scheduledAt ?? p.scheduledDate ?? ""),
    }));

    // Queue depth: posts scheduled within next 48h
    const in48h = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const queueDepth = scheduledPosts.filter(
      (p: { scheduledFor?: string; scheduledAt?: string }) => {
        const d = p.scheduledFor ?? p.scheduledAt ?? "";
        return d && d <= in48h;
      }
    ).length;

    return {
      failedPosts: failedPosts.length,
      failedPostDetails,
      scheduledToday: scheduledPosts.filter(
        (p: { scheduledFor?: string; scheduledAt?: string }) =>
          (p.scheduledFor ?? p.scheduledAt ?? "").startsWith(today)
      ).length,
      scheduledTomorrow: scheduledPosts.filter(
        (p: { scheduledFor?: string; scheduledAt?: string }) =>
          (p.scheduledFor ?? p.scheduledAt ?? "").startsWith(tomorrow)
      ).length,
      queueDepth,
    };
  } catch {
    return { failedPosts: 0, failedPostDetails: [], scheduledToday: 0, scheduledTomorrow: 0, queueDepth: 0 };
  }
}

// ── SEO snapshot with 7d trends ─────────────────────────────────────

interface SEOResult {
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  trend: {
    impressions: { delta: number; pct: number };
    clicks: { delta: number; pct: number };
  } | null;
}

async function getSEO(): Promise<SEOResult> {
  const key = process.env.LUNARY_ADMIN_API_KEY;
  const url = process.env.LUNARY_URL ?? "https://lunary.app";
  const empty: SEOResult = { impressions: 0, clicks: 0, ctr: 0, position: 0, trend: null };
  if (!key) return empty;

  try {
    const res = await fetch(`${url}/api/admin/analytics/search-console`, {
      headers: { Authorization: `Bearer ${key}` },
      next: { revalidate: 300 },
    });
    if (!res.ok) return empty;
    const raw = await res.json();
    const perf = raw?.data?.performance ?? raw?.performance ?? raw;
    const metrics: { date: string; clicks: number; impressions: number }[] = perf.metrics ?? [];

    // Compute 7d vs previous 7d from daily data
    let trend: SEOResult["trend"] = null;
    if (metrics.length >= 14) {
      const recent7 = metrics.slice(-7);
      const prev7 = metrics.slice(-14, -7);
      const r = { imp: sum(recent7, "impressions"), clk: sum(recent7, "clicks") };
      const p = { imp: sum(prev7, "impressions"), clk: sum(prev7, "clicks") };
      trend = {
        impressions: { delta: r.imp - p.imp, pct: p.imp ? ((r.imp - p.imp) / p.imp) * 100 : 0 },
        clicks: { delta: r.clk - p.clk, pct: p.clk ? ((r.clk - p.clk) / p.clk) * 100 : 0 },
      };
    }

    return {
      impressions: perf.totalImpressions ?? perf.impressions ?? 0,
      clicks: perf.totalClicks ?? perf.clicks ?? 0,
      ctr: perf.averageCtr ?? perf.ctr ?? 0,
      position: perf.averagePosition ?? perf.position ?? 0,
      trend,
    };
  } catch {
    return empty;
  }
}

function sum(arr: Record<string, unknown>[], key: string): number {
  return arr.reduce((a, b) => a + (Number(b[key]) || 0), 0);
}

// ── Engagement opportunities (high quality, Lunary-focused) ─────────

const LUNARY_KEYWORDS = [
  "astrology app", "horoscope app", "birth chart", "natal chart",
  "zodiac", "horoscope", "astrology", "mercury retrograde",
  "moon phase", "transit", "lunar", "rising sign", "sun sign",
  "compatibility", "synastry",
];

function isLunaryRelevant(content: string): boolean {
  const lower = content.toLowerCase();
  return LUNARY_KEYWORDS.some((kw) => lower.includes(kw));
}

function isQuestion(content: string): boolean {
  return content.includes("?") || /\b(how|what|which|where|why|does|is there|anyone|recommend)\b/i.test(content);
}

async function getOpportunities() {
  const apiKey = process.env.SPELLCAST_API_KEY;
  const url = process.env.SPELLCAST_API_URL ?? "https://api.spellcast.sammii.dev";
  if (!apiKey) return [];

  try {
    const res = await fetch(`${url}/api/discovery?status=new&limit=50`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const posts = Array.isArray(data) ? data : data.posts ?? data.data ?? [];

    // Score each post for Lunary relevance (many posts have null relevanceScore)
    const scored = posts
      .map((post: Record<string, unknown>) => {
        const content = String(post.content ?? post.text ?? "");
        // Start with API score or 0.4 base for unscored posts
        let score = (post.relevanceScore as number) ?? 0.4;

        // Boost questions (high engagement value — someone asking = chance to help)
        if (isQuestion(content)) score += 0.2;

        // Boost Lunary-relevant content
        if (isLunaryRelevant(content)) score += 0.15;

        // Prefer Threads/Instagram (Lunary's target platforms)
        const platform = String(post.platform ?? "");
        if (platform === "threads" || platform === "instagram") score += 0.1;
        // Slight boost for Reddit (good for long-form answers)
        if (platform === "reddit") score += 0.05;

        return { ...post, _boostedScore: Math.min(score, 1) };
      })
      // Only keep genuinely relevant posts (0.5 threshold to let more multi-platform content through)
      .filter((p: { _boostedScore: number }) => p._boostedScore >= 0.5)
      .sort((a: { _boostedScore: number }, b: { _boostedScore: number }) =>
        b._boostedScore - a._boostedScore
      );

    // Take top 5, max 2 per platform
    const result: {
      id: string;
      platform: string;
      authorHandle: string;
      content: string;
      relevanceScore: number;
      platformUrl: string;
    }[] = [];

    for (const post of scored) {
      if (result.length >= 5) break;
      const platform = String(post.platform ?? "unknown");
      if (result.filter((p) => p.platform === platform).length >= 3) continue;

      result.push({
        id: String(post.id ?? post._id ?? Math.random()),
        platform,
        authorHandle: String(post.authorHandle ?? post.author ?? ""),
        content: String(post.content ?? post.text ?? "").slice(0, 120),
        relevanceScore: post._boostedScore,
        platformUrl: String(post.platformUrl ?? post.url ?? "#"),
      });
    }

    return result;
  } catch {
    return [];
  }
}

// ── Orbit summary (lightweight check) ────────────────────────────────

async function getOrbitSummary() {
  const orbitUrl = process.env.ORBIT_URL ?? "http://localhost:3001";
  try {
    const res = await fetch(`${orbitUrl}/api/state`, {
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (!res.ok) return { online: false, agentCount: 0, runningAgents: 0, errorAgents: 0, pipelineRunning: false };
    const state = await res.json();
    const agents = Object.values(state.agents ?? {}) as Record<string, unknown>[];
    return {
      online: true,
      agentCount: agents.length,
      runningAgents: agents.filter((a) => a.status === "running").length,
      errorAgents: agents.filter((a) => a.status === "error" || a.status === "failed").length,
      pipelineRunning: agents.some((a) => a.status === "running"),
    };
  } catch {
    return { online: false, agentCount: 0, runningAgents: 0, errorAgents: 0, pipelineRunning: false };
  }
}

// ── Engagement summary ───────────────────────────────────────────────

async function getEngagementSummary() {
  const apiKey = process.env.SPELLCAST_API_KEY;
  const url = process.env.SPELLCAST_API_URL ?? "https://api.spellcast.sammii.dev";
  if (!apiKey) return { unread: 0, total: 0, byPlatform: {} as Record<string, number> };

  try {
    const res = await fetch(`${url}/api/engagement/stats`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return { unread: 0, total: 0, byPlatform: {} };
    const data = await res.json();
    return {
      unread: Number(data.unread ?? 0),
      total: Number(data.total ?? 0),
      byPlatform: data.byPlatform ?? {},
    };
  } catch {
    return { unread: 0, total: 0, byPlatform: {} };
  }
}

// ── Trend computation ───────────────────────────────────────────────

interface Trend {
  delta: number;
  direction: "up" | "down" | "flat";
}

function computeTrends(
  lunary: { mau: number; mrr: number; activeToday: number },
  spellcast: { postsToday: number },
  seo: { impressions: number; clicks: number }
): Record<string, Trend> | null {
  const prev = g._prevSnapshot;
  if (!prev) return null;

  const ageMins = (Date.now() - prev.ts) / 60_000;
  // Only show trends if previous snapshot is at least 5 min old (meaningful delta)
  if (ageMins < 5) return null;

  const t = (curr: number, old: number): Trend => ({
    delta: curr - old,
    direction: curr > old ? "up" : curr < old ? "down" : "flat",
  });

  return {
    dau: t(lunary.activeToday, prev.lunary.activeToday),
    mau: t(lunary.mau, prev.lunary.mau),
    mrr: t(lunary.mrr, prev.lunary.mrr),
    postsToday: t(spellcast.postsToday, prev.spellcast.postsToday),
  };
}

// ── Route handler ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const denied = checkAuth(req);
  if (denied) return denied;

  const [github, lunary, spellcast, health, content, seo, opportunities, orbit, engagement] =
    await Promise.all([
      getGitHub(),
      getLunary(),
      getSpellcast(),
      getHealth(),
      getContentPipeline(),
      getSEO(),
      getOpportunities(),
      getOrbitSummary(),
      getEngagementSummary(),
    ]);

  // Compute trends from previous snapshot
  const trends = computeTrends(lunary, spellcast, seo);

  // Store current as previous for next poll
  g._prevSnapshot = {
    ts: Date.now(),
    lunary: { mau: lunary.mau, mrr: lunary.mrr, activeToday: lunary.activeToday },
    seo: { impressions: seo.impressions, clicks: seo.clicks },
    spellcast: { postsToday: spellcast.postsToday },
  };

  return NextResponse.json({
    github,
    lunary,
    spellcast: {
      ...spellcast,
      queueDepth: content.queueDepth ?? 0,
    },
    meta: {
      followers: spellcast.igFollowers ?? 0,
      reachThisWeek: spellcast.reachThisWeek ?? 0,
      postsThisWeek: spellcast.postsThisWeek ?? 0,
    },
    health,
    content,
    engagement,
    orbit,
    seo,
    opportunities,
    trends,
    updatedAt: new Date().toISOString(),
  });
}
