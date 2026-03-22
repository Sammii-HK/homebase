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
  const today = new Date().toISOString().slice(0, 10);

  try {
    // Pull from /api/stats (already correct) and Orbit briefing in parallel
    const authHeader = req.headers.get("authorization") ?? "";
    const cookieHeader = req.headers.get("cookie") ?? "";

    const [statsRes, orbitBriefingRes, eventsRes] = await Promise.all([
      fetch(`http://localhost:${process.env.PORT ?? 3005}/api/stats`, {
        headers: {
          ...(authHeader ? { authorization: authHeader } : {}),
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
        },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      }).catch(() => null),
      fetch(`${orbitUrl}/api/briefing`, {
        signal: AbortSignal.timeout(3000),
        cache: "no-store",
      }).catch(() => null),
      fetch(`http://localhost:${process.env.PORT ?? 3005}/api/stats/events`, {
        headers: {
          ...(authHeader ? { authorization: authHeader } : {}),
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
        },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      }).catch(() => null),
    ]);

    const stats = statsRes?.ok ? await statsRes.json() : null;
    const orbitBriefing: Record<string, unknown> | null =
      orbitBriefingRes?.ok ? await orbitBriefingRes.json() : null;
    const eventsData = eventsRes?.ok ? await eventsRes.json() : null;
    const upcoming48h: number = eventsData?.upcoming48h ?? 0;
    const thisWeek: number = eventsData?.thisWeek ?? 0;

    // Pull values from stats (already correct Spellcast data)
    const pendingReview: number = stats?.content?.pendingReview ?? 0;
    const scheduledToday: number = stats?.content?.scheduledToday ?? 0;
    const failedPosts: number = stats?.content?.failedPosts ?? 0;
    const unread: number = stats?.engagement?.unread ?? 0;
    const dau: number = stats?.lunary?.activeToday ?? 0;
    const mau: number = stats?.lunary?.mau ?? 0;
    const mrr: number = stats?.lunary?.mrr ?? 0;

    // Platform breakdown from failed post details
    const pendingPlatforms: string[] = [];
    const pendingNextTime: string | null = null;
    const postsByPlatform: Record<string, number> = {};
    const nextScheduledTime: string | null = null;

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

    // Tech events in London
    if (upcoming48h > 0) {
      items.push({
        priority: "today",
        label: `${upcoming48h} TECH EVENT${upcoming48h !== 1 ? "S" : ""} IN 48H`,
        detail: `${thisWeek} event${thisWeek !== 1 ? "s" : ""} this week — check Meta room`,
        action: "meta",
        count: upcoming48h,
      });
    } else if (thisWeek > 0) {
      items.push({
        priority: "info",
        label: `${thisWeek} TECH EVENT${thisWeek !== 1 ? "S" : ""} THIS WEEK`,
        detail: "Open Meta room to see full list",
        action: "meta",
        count: thisWeek,
      });
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
