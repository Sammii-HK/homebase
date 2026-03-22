import { NextRequest, NextResponse } from "next/server";
import { execFileSync } from "child_process";
import crypto from "crypto";
import { checkAuth } from "@/lib/auth";
import { readMetricsSnapshot } from "@/lib/metrics-snapshot";

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
    const data = await res.json();
    // If API returned zeros (Cloudflare block), fall back to heartbeat snapshot
    if (!data.mau && !data.activeToday) {
      const snapshot = readMetricsSnapshot();
      if (snapshot && (snapshot.mau || snapshot.dau)) {
        return {
          mau: snapshot.mau,
          mrr: snapshot.mrr,
          subscribers: data.subscribers ?? 0,
          activeToday: snapshot.dau,
          wau: snapshot.wau,
          signups7d: snapshot.signups7d,
          _source: "heartbeat-snapshot",
        };
      }
    }
    return data;
  } catch (e) {
    console.error("[homebase] lunary fetch failed:", e);
    // Fallback to heartbeat snapshot on error
    const snapshot = readMetricsSnapshot();
    if (snapshot) {
      return {
        mau: snapshot.mau,
        mrr: snapshot.mrr,
        subscribers: 0,
        activeToday: snapshot.dau,
        wau: snapshot.wau,
        signups7d: snapshot.signups7d,
        _source: "heartbeat-snapshot",
      };
    }
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
): Promise<{ status: "ok" | "degraded" | "down"; latencyMs: number }> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    // 403 = Cloudflare blocking datacenter IPs (not actually down)
    if (res.status === 403) return { status: "degraded", latencyMs: Date.now() - start };
    return { status: res.ok ? "ok" : "down", latencyMs: Date.now() - start };
  } catch {
    return { status: "down", latencyMs: Date.now() - start };
  }
}

async function getHealth() {
  const lunaryUrl = process.env.LUNARY_URL ?? "https://lunary.app";
  const spellcastUrl = process.env.SPELLCAST_API_URL ?? "https://api.spellcast.sammii.dev";
  const contentUrl = process.env.CONTENT_CREATOR_URL ?? "https://content.sammii.dev";
  const orbitUrl = process.env.ORBIT_URL ?? "https://orbit.sammii.dev";
  const key = process.env.LUNARY_ADMIN_API_KEY;
  const spellcastKey = process.env.SPELLCAST_API_KEY ?? process.env.SPELLCAST_CRON_SECRET;

  const [lunary, spellcast, contentCreator, orbit] = await Promise.all([
    checkService(
      `${lunaryUrl}/api/admin/health/db`,
      key ? { Authorization: `Bearer ${key}` } : undefined
    ),
    checkService(
      `${spellcastUrl}/api/health`,
      spellcastKey ? { Authorization: `Bearer ${spellcastKey}` } : undefined
    ),
    checkService(`${contentUrl}/api/health`),
    checkService(`${orbitUrl}/api/state`),
  ]);

  return { lunary, spellcast, contentCreator, orbit };
}

// ── Content pipeline ────────────────────────────────────────────────

async function getContentPipeline() {
  const apiKey = process.env.SPELLCAST_API_KEY;
  const url = process.env.SPELLCAST_API_URL ?? "https://api.spellcast.sammii.dev";
  if (!apiKey) return { failedPosts: 0, failedPostDetails: [], scheduledToday: 0, scheduledTomorrow: 0, queueDepth: 0, pendingReview: 0 };

  const headers = { Authorization: `Bearer ${apiKey}` };

  try {
    const [failedRes, scheduledRes, pendingRes] = await Promise.all([
      fetch(`${url}/api/posts?status=failed&limit=100`, { headers, next: { revalidate: 300 } }),
      fetch(`${url}/api/posts?status=scheduled&limit=100`, { headers, next: { revalidate: 300 } }),
      fetch(`${url}/api/posts?status=pending_review&limit=100`, { headers, next: { revalidate: 300 } }),
    ]);

    const failedData = failedRes.ok ? await failedRes.json() : {};
    const scheduledData = scheduledRes.ok ? await scheduledRes.json() : {};
    const pendingData = pendingRes.ok ? await pendingRes.json() : {};
    const pendingPosts = Array.isArray(pendingData) ? pendingData : pendingData.posts ?? pendingData.data ?? [];

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
      pendingReview: pendingPosts.length,
    };
  } catch {
    return { failedPosts: 0, failedPostDetails: [], scheduledToday: 0, scheduledTomorrow: 0, queueDepth: 0, pendingReview: 0 };
  }
}

// ── SEO snapshot with 7d trends ─────────────────────────────────────

interface SEOResult {
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  dailyAvg: number; // impressions per day for the 7d window
  prev?: { impressions: number; clicks: number; ctr: number; position: number };
  trend: {
    impressions: { delta: number; pct: number };
    clicks: { delta: number; pct: number };
    ctr: { delta: number; pct: number };
    position: { delta: number; pct: number } | null;
  } | null;
}

/** Sign a JWT with RS256 for Google service account OAuth2 */
async function getGoogleAccessToken(serviceAccountJson: string): Promise<string | null> {
  try {
    const sa = JSON.parse(serviceAccountJson) as {
      client_email: string; private_key: string;
    };
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/webmasters.readonly",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })).toString("base64url");

    const signingInput = `${header}.${payload}`;
    const privateKey = crypto.createPrivateKey(sa.private_key);
    const sig = crypto.sign("sha256", Buffer.from(signingInput), privateKey).toString("base64url");
    const jwt = `${signingInput}.${sig}`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });
    if (!tokenRes.ok) return null;
    const { access_token } = await tokenRes.json() as { access_token: string };
    return access_token;
  } catch {
    return null;
  }
}

async function getSEO(): Promise<SEOResult> {
  const empty: SEOResult = { impressions: 0, clicks: 0, ctr: 0, position: 0, dailyAvg: 0, trend: null };

  // Try Google Search Console API directly (no Cloudflare, works from Hetzner)
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const siteUrl = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL ?? "sc-domain:lunary.app";

  if (saJson) {
    try {
      const token = await getGoogleAccessToken(saJson);
      if (token) {
        const end = new Date(); end.setDate(end.getDate() - 1); // GSC lags 1-2 days
        const start = new Date(end); start.setDate(start.getDate() - 15); // 16 days — GSC lag means ~14 complete rows

        const gscRes = await fetch(
          `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              startDate: start.toISOString().split("T")[0],
              endDate: end.toISOString().split("T")[0],
              dimensions: ["date"],
              rowLimit: 16,
            }),
          }
        );

        if (gscRes.ok) {
          const gscData = await gscRes.json() as { rows?: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[] };
          const rows = gscData.rows ?? [];
          const metrics = rows.map((r) => ({
            date: r.keys[0],
            clicks: r.clicks,
            impressions: r.impressions,
            ctr: r.ctr,
            position: r.position,
          })).sort((a, b) => a.date.localeCompare(b.date));

          if (metrics.length >= 7) {
            // Process metrics through the standard path below
            return computeSEOResult(metrics);
          }
        }
      }
    } catch { /* fall through to snapshot */ }
  }

  // Fall back to snapshot pushed from Mac heartbeat (Cloudflare blocks Hetzner→Lunary)
  const snap = readMetricsSnapshot();
  if (snap?.seoImpressions7d) {
    return {
      impressions: snap.seoImpressions7d,
      clicks: snap.seoClicks7d ?? 0,
      ctr: snap.seoCtr7d ?? 0,
      position: snap.seoPosition7d ?? 0,
      dailyAvg: snap.seoDailyAvg ?? Math.round(snap.seoImpressions7d / 7),
      trend: null,
    };
  }
  return empty;
}

function computeSEOResult(metrics: { date: string; clicks: number; impressions: number; ctr?: number; position?: number }[]): SEOResult {
  const empty: SEOResult = { impressions: 0, clicks: 0, ctr: 0, position: 0, dailyAvg: 0, trend: null };
  if (metrics.length < 7) return empty;

  const recent7 = metrics.slice(-7);
  const rImp = sum(recent7, "impressions");
  const rClk = sum(recent7, "clicks");
  const ctr7d = rImp > 0 ? rClk / rImp : 0;

  const posEntries = recent7.filter((d) => d.position != null && d.position > 0);
  const position7d = posEntries.length > 0
    ? posEntries.reduce((a, d) => a + (d.position ?? 0), 0) / posEntries.length
    : 0;

  let trend: SEOResult["trend"] = null;
  let prev: SEOResult["prev"] | undefined;

  if (metrics.length >= 14) {
    const prev7 = metrics.slice(-14, -7);
    const pImp = sum(prev7, "impressions");
    const pClk = sum(prev7, "clicks");
    const pCtr = pImp > 0 ? pClk / pImp : 0;
    const prevPosEntries = prev7.filter((d) => d.position != null && d.position > 0);
    const pPos = prevPosEntries.length > 0
      ? prevPosEntries.reduce((a, d) => a + (d.position ?? 0), 0) / prevPosEntries.length
      : null;

    prev = { impressions: pImp, clicks: pClk, ctr: pCtr, position: pPos ?? position7d };
    trend = {
      impressions: { delta: rImp - pImp, pct: pImp ? ((rImp - pImp) / pImp) * 100 : 0 },
      clicks: { delta: rClk - pClk, pct: pClk ? ((rClk - pClk) / pClk) * 100 : 0 },
      ctr: { delta: ctr7d - pCtr, pct: pCtr ? ((ctr7d - pCtr) / pCtr) * 100 : 0 },
      position: pPos != null
        ? { delta: position7d - pPos, pct: pPos ? ((position7d - pPos) / pPos) * 100 : 0 }
        : null,
    };
  }

  return {
    impressions: rImp,
    clicks: rClk,
    ctr: ctr7d,
    position: position7d,
    dailyAvg: Math.round(rImp / 7),
    prev,
    trend,
  };
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
        if (platform === "threads" || platform === "instagram") score += 0.25;
        // Boost Reddit (good for long-form answers)
        if (platform === "reddit") score += 0.15;
        // Penalise Bluesky slightly (not Lunary's audience)
        if (platform === "bluesky") score -= 0.1;

        return { ...post, _boostedScore: Math.min(score, 1) };
      })
      // Only keep genuinely relevant posts (0.5 threshold to let more multi-platform content through)
      .filter((p: { _boostedScore: number }) => p._boostedScore >= 0.5)
      .sort((a: { _boostedScore: number }, b: { _boostedScore: number }) =>
        b._boostedScore - a._boostedScore
      );

    // Take top 5, max 2 per platform, max 1 Bluesky (not Lunary's target)
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
      const platformCap = platform === "bluesky" ? 1 : 2;
      if (result.filter((p) => p.platform === platform).length >= platformCap) continue;

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
    const authStatus = state.authStatus?.status ?? null;
    return {
      online: true,
      agentCount: agents.length,
      runningAgents: agents.filter((a) => a.status === "running").length,
      errorAgents: agents.filter((a) => a.status === "error" || a.status === "failed").length,
      pipelineRunning: agents.some((a) => a.status === "running"),
      authStatus,
    };
  } catch {
    return { online: false, agentCount: 0, runningAgents: 0, errorAgents: 0, pipelineRunning: false, authStatus: null };
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

// ── Server disk (Hetzner) ────────────────────────────────────────────

function getServerDisk(): { pct: number; used: string; avail: string } | null {
  try {
    const out = execFileSync("df", ["-h", "/"], { timeout: 3000 }).toString();
    const line = out.split("\n")[1];
    if (!line) return null;
    const parts = line.trim().split(/\s+/);
    const pct = parseInt(parts[4] ?? "0", 10);
    const used = parts[2] ?? "?";
    const avail = parts[3] ?? "?";
    return { pct, used, avail };
  } catch {
    return null;
  }
}

// ── Route handler ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const denied = await checkAuth(req);
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
    engagement: {
      unread: opportunities.length, // use actionable opportunities count, not raw historical unread
      total: engagement.total,
      byPlatform: engagement.byPlatform,
    },
    orbit,
    seo,
    opportunities,
    trends,
    server: { disk: getServerDisk() },
    updatedAt: new Date().toISOString(),
  });
}
