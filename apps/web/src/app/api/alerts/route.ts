import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export interface Alert {
  id: string;
  level: "critical" | "warning";
  message: string;
  action?: { label: string; tab?: "status" | "queue" | "chat" };
}

// ── Orbit agent state ────────────────────────────────────────────────

async function getOrbitAlerts(): Promise<Alert[]> {
  const orbitUrl = process.env.ORBIT_URL ?? "https://orbit.sammii.dev";
  const alerts: Alert[] = [];

  try {
    const res = await fetch(`${orbitUrl}/api/state`, {
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return alerts;

    const state = await res.json();

    // Failed agents
    const agents = Object.entries(state.agents ?? {}) as [
      string,
      Record<string, unknown>,
    ][];
    const failed = agents.filter(
      ([, a]) => a.status === "error" || a.status === "failed"
    );
    if (failed.length > 0) {
      const names = failed.map(([, a]) => String(a.name ?? a.id ?? "agent")).join(", ");
      alerts.push({
        id: "orbit-agents-failed",
        level: "warning",
        message: `Orbit: ${failed.length} agent(s) failed — ${names}`,
        action: { label: "Check", tab: "status" },
      });
    }

    // Stale pipeline
    const lastRun = state.pipeline?.lastRun;
    if (lastRun) {
      const ageHours = (Date.now() - new Date(lastRun).getTime()) / 3_600_000;
      if (ageHours > 10) {
        const h = Math.floor(ageHours);
        alerts.push({
          id: "orbit-pipeline-stale",
          level: "warning",
          message: `Pipeline last ran ${h}h ago`,
          action: { label: "Check", tab: "status" },
        });
      }
    }

    // Auth status
    const authStatus = state.auth ?? state.authStatus;
    const authOk =
      authStatus === "ok" ||
      authStatus?.status === "ok" ||
      authStatus === null ||
      authStatus === undefined;
    if (!authOk) {
      alerts.push({
        id: "orbit-auth-expired",
        level: "critical",
        message: "Hetzner auth expired",
        action: { label: "Fix", tab: "status" },
      });
    }
  } catch {
    // Never crash — just return whatever we have
  }

  return alerts;
}

// ── Spellcast pending review (overdue) ───────────────────────────────

async function getSpellcastAlerts(): Promise<Alert[]> {
  const url = process.env.SPELLCAST_API_URL ?? "https://api.spellcast.sammii.dev";
  const secret = process.env.SPELLCAST_CRON_SECRET;
  const alerts: Alert[] = [];

  if (!secret) return alerts;

  try {
    const headers = { Authorization: `Bearer ${secret}` };
    const now = new Date().toISOString();

    // Overdue pending review
    const pendingRes = await fetch(`${url}/api/posts?status=pending_review`, {
      headers,
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (pendingRes.ok) {
      const data = await pendingRes.json();
      const posts = Array.isArray(data) ? data : data.posts ?? data.data ?? [];
      const overdue = posts.filter((p: Record<string, unknown>) => {
        const scheduled = String(p.scheduledFor ?? p.scheduledAt ?? "");
        return scheduled && scheduled < now;
      });
      if (overdue.length > 0) {
        alerts.push({
          id: "spellcast-overdue-review",
          level: "warning",
          message: `${overdue.length} post(s) overdue in review queue`,
          action: { label: "Review", tab: "queue" },
        });
      }
    }

    // Failed posts via homebase-stats
    const statsRes = await fetch(`${url}/api/internal/homebase-stats`, {
      headers,
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (statsRes.ok) {
      const stats = await statsRes.json();
      const failedCount = Number(stats.failedPosts ?? stats.failed ?? 0);
      if (failedCount > 0) {
        alerts.push({
          id: "spellcast-failed-posts",
          level: "warning",
          message: `${failedCount} post(s) failed to publish`,
          action: { label: "View", tab: "queue" },
        });
      }
    } else {
      // Fallback: query failed posts directly
      const failedRes = await fetch(`${url}/api/posts?status=failed&limit=100`, {
        headers,
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      });
      if (failedRes.ok) {
        const data = await failedRes.json();
        const posts = Array.isArray(data) ? data : data.posts ?? data.data ?? [];
        if (posts.length > 0) {
          alerts.push({
            id: "spellcast-failed-posts",
            level: "warning",
            message: `${posts.length} post(s) failed to publish`,
            action: { label: "View", tab: "queue" },
          });
        }
      }
    }
  } catch {
    // Never crash
  }

  return alerts;
}

// ── Route handler ────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  // All sources in parallel — each has its own try/catch
  const [orbitAlerts, spellcastAlerts] = await Promise.all([
    getOrbitAlerts(),
    getSpellcastAlerts(),
  ]);

  const alerts: Alert[] = [...orbitAlerts, ...spellcastAlerts];

  // Critical first, then warnings
  alerts.sort((a, b) => {
    if (a.level === b.level) return 0;
    return a.level === "critical" ? -1 : 1;
  });

  return NextResponse.json({
    alerts,
    count: alerts.length,
    updatedAt: new Date().toISOString(),
  });
}
