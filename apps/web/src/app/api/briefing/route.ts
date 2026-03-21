import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export interface BriefingItem {
  priority: "urgent" | "today" | "info" | "done";
  label: string;
  detail: string;
  action?: string;
  count?: number;
}

export interface BriefingResponse {
  generatedAt: string;
  items: BriefingItem[];
  allClear: boolean;
  // Legacy fields retained for backward compatibility with existing BriefingCard inline view
  date: string;
  orbitBriefing: Record<string, unknown> | null;
  compiledAt: string | null;
  metrics: { dau: number; mau: number; mrr: number; dauDelta: number; mauDelta: number };
  overnightWork: { drafts_generated: number; editor_approved: number; pending_review: number } | null;
  content: {
    pendingReview: number;
    scheduledToday: number;
    failedPosts: number;
    postsByPlatform: Record<string, number>;
  };
  engagement: { unread: number };
  system: { authStatus: string; agentsOnline: number; lastPipelineRun: string } | null;
  alerts: string[];
}

export async function GET(req: NextRequest) {
  const denied = await checkAuth(req);
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
      const orbitRes = await fetch(`${orbitUrl}/api/briefing`, {
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
              `${spellcastUrl}/posts?status=pending_review&limit=50`,
              {
                headers: spellcastHeaders,
                signal: AbortSignal.timeout(5000),
                cache: "no-store",
              }
            ).catch(() => null)
          : Promise.resolve(null),

        // Spellcast: scheduled
        spellcastHeaders
          ? fetch(`${spellcastUrl}/posts?status=scheduled&limit=50`, {
              headers: spellcastHeaders,
              signal: AbortSignal.timeout(5000),
              cache: "no-store",
            }).catch(() => null)
          : Promise.resolve(null),

        // Spellcast: failed
        spellcastHeaders
          ? fetch(`${spellcastUrl}/posts?status=failed&limit=10`, {
              headers: spellcastHeaders,
              signal: AbortSignal.timeout(5000),
              cache: "no-store",
            }).catch(() => null)
          : Promise.resolve(null),

        // Spellcast: engagement stats
        spellcastHeaders
          ? fetch(`${spellcastUrl}/engagement/stats`, {
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

    // Parse pending review — capture platform breakdown too
    let pendingReview = 0;
    const pendingPlatforms: string[] = [];
    let pendingNextTime: string | null = null;
    if (pendingRes?.ok) {
      const data = await pendingRes.json();
      const arr: Array<{ platform?: string; scheduledFor?: string; scheduledAt?: string }> =
        Array.isArray(data) ? data : data.posts ?? data.data ?? [];
      pendingReview = arr.length;
      const platformSet = new Set<string>();
      for (const p of arr) {
        if (p.platform) platformSet.add(p.platform);
        const t = p.scheduledFor ?? p.scheduledAt;
        if (t && !pendingNextTime) pendingNextTime = t;
      }
      pendingPlatforms.push(...Array.from(platformSet));
    }

    // Parse scheduled posts — count today's only, find next post time
    let scheduledToday = 0;
    let nextScheduledTime: string | null = null;
    const postsByPlatform: Record<string, number> = {};
    if (scheduledRes?.ok) {
      const data = await scheduledRes.json();
      const arr: Array<{ scheduledFor?: string; scheduledAt?: string; platform?: string }> =
        Array.isArray(data) ? data : data.posts ?? data.data ?? [];
      const todayPosts = arr.filter((p) =>
        (p.scheduledFor ?? p.scheduledAt ?? "").startsWith(today)
      );
      scheduledToday = todayPosts.length;
      // Sort to find next post time
      const sorted = todayPosts
        .map((p) => p.scheduledFor ?? p.scheduledAt ?? "")
        .filter(Boolean)
        .sort();
      const now = new Date().toISOString();
      nextScheduledTime = sorted.find((t) => t > now) ?? sorted[0] ?? null;
      // Platform counts
      for (const p of todayPosts) {
        if (p.platform) {
          postsByPlatform[p.platform] = (postsByPlatform[p.platform] ?? 0) + 1;
        }
      }
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

    // Extract Orbit-specific fields if available
    const orbitData = orbitBriefing as Record<string, unknown> | null;
    const orbitMetrics = orbitData?.metrics as Record<string, number> | null;
    const overnightWork = (orbitData?.overnight_work as Record<string, number>) ?? null;
    const todaySchedule = orbitData?.today as Record<string, unknown> | null;
    const systemStatus = orbitData?.system as Record<string, unknown> | null;
    const compiledAt = (orbitData?.compiled_at as string) ?? null;
    const orbitErrors = orbitData?.errors as string[] | null;
    const castToday = orbitData?.cast as Record<string, unknown> | null;

    const dauDelta = orbitMetrics?.dau_delta ?? 0;
    const mauDelta = orbitMetrics?.mau_delta ?? 0;

    // Orbit platform breakdown overrides if available
    const orbitPlatforms =
      (todaySchedule?.posts_by_platform as Record<string, number>) ?? {};
    const finalPostsByPlatform =
      Object.keys(orbitPlatforms).length > 0 ? orbitPlatforms : postsByPlatform;

    // Build legacy alerts array
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

    // ── Build structured priority items ──────────────────────────────

    const items: BriefingItem[] = [];

    // Failed posts → urgent
    if (failedPosts > 0) {
      items.push({
        priority: "urgent",
        label: `${failedPosts} POST${failedPosts === 1 ? "" : "S"} FAILED`,
        detail: `${failedPosts} post${failedPosts === 1 ? "" : "s"} failed to publish overnight`,
        action: "spellcast",
        count: failedPosts,
      });
    }

    // Agent errors from Orbit → urgent
    if (orbitErrors && orbitErrors.length > 0) {
      items.push({
        priority: "urgent",
        label: `${orbitErrors.length} AGENT ERROR${orbitErrors.length === 1 ? "" : "S"}`,
        detail: orbitErrors.slice(0, 2).join("; "),
        action: "orbit",
        count: orbitErrors.length,
      });
    }

    // Pending approval → today
    if (pendingReview > 0) {
      const platformStr =
        pendingPlatforms.length > 0
          ? pendingPlatforms.join(", ")
          : "multiple platforms";
      const timeStr = pendingNextTime
        ? ` — next at ${new Date(pendingNextTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
        : "";
      items.push({
        priority: "today",
        label: `${pendingReview} POST${pendingReview === 1 ? "" : "S"} PENDING APPROVAL`,
        detail: `${platformStr}${timeStr}`,
        action: "approvals",
        count: pendingReview,
      });
    }

    // Unread engagement → today (if significant)
    if (unread > 0) {
      items.push({
        priority: unread > 10 ? "today" : "info",
        label: `${unread} UNREAD ENGAGEMENT`,
        detail: `${unread} comment${unread === 1 ? "" : "s"} or DM${unread === 1 ? "" : "s"} awaiting reply`,
        action: "engagement",
        count: unread,
      });
    }

    // Scheduled today → info
    if (scheduledToday > 0) {
      const nextStr = nextScheduledTime
        ? `Next post at ${new Date(nextScheduledTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
        : `${scheduledToday} post${scheduledToday === 1 ? "" : "s"} scheduled`;
      const platformEntries = Object.entries(finalPostsByPlatform);
      const platformStr =
        platformEntries.length > 0
          ? platformEntries.map(([p, c]) => `${p} ×${c}`).join(", ")
          : "";
      items.push({
        priority: "info",
        label: `${scheduledToday} SCHEDULED TODAY`,
        detail: [nextStr, platformStr].filter(Boolean).join(" — "),
        action: "spellcast",
        count: scheduledToday,
      });
    } else {
      // No content scheduled → flag as today priority
      items.push({
        priority: "today",
        label: "NO CONTENT SCHEDULED",
        detail: "Nothing scheduled for today — generate or schedule now",
        action: "spellcast",
      });
    }

    // Cast: interviews today
    if (castToday) {
      const interviewCount = Number(castToday.interviews_today ?? 0);
      if (interviewCount > 0) {
        items.push({
          priority: "urgent",
          label: `${interviewCount} INTERVIEW${interviewCount === 1 ? "" : "S"} TODAY`,
          detail: String(castToday.detail ?? "Check Cast for schedule"),
          action: "cast",
          count: interviewCount,
        });
      }
    }

    // Service health issues from Orbit
    if (systemStatus) {
      const authStatus = String(systemStatus.auth_status ?? "");
      const agentsOnline = Number(systemStatus.agents_online ?? 0);
      if (authStatus && authStatus !== "ok") {
        items.push({
          priority: "urgent",
          label: "AUTH ISSUE DETECTED",
          detail: `System auth status: ${authStatus}`,
          action: "system",
        });
      }
      if (agentsOnline === 0) {
        items.push({
          priority: "today",
          label: "NO AGENTS ONLINE",
          detail: "Orbit reports 0 agents running",
          action: "orbit",
        });
      }
    }

    // Mark all-clear if no urgent/today items
    const allClear = items.every((i) => i.priority === "info" || i.priority === "done");

    const response: BriefingResponse = {
      generatedAt: new Date().toISOString(),
      items,
      allClear,
      // Legacy fields
      date: today,
      orbitBriefing,
      compiledAt,
      metrics: { dau, mau, mrr, dauDelta, mauDelta },
      overnightWork: overnightWork
        ? {
            drafts_generated: Number(overnightWork.drafts_generated ?? 0),
            editor_approved: Number(overnightWork.editor_approved ?? 0),
            pending_review: Number(overnightWork.pending_review ?? 0),
          }
        : null,
      content: {
        pendingReview,
        scheduledToday,
        failedPosts,
        postsByPlatform: finalPostsByPlatform,
      },
      engagement: { unread },
      system: systemStatus
        ? {
            authStatus: String(systemStatus.auth_status ?? "unknown"),
            agentsOnline: Number(systemStatus.agents_online ?? 0),
            lastPipelineRun: String(systemStatus.last_pipeline_run ?? ""),
          }
        : null,
      alerts,
    };

    return NextResponse.json(response);
  } catch (e) {
    console.error("[homebase] briefing fetch failed:", e);
    return NextResponse.json({ error: "Briefing fetch failed" }, { status: 502 });
  }
}
