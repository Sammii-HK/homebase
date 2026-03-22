// Server-side alert derivation — mirrors AlertFeed.tsx logic without localStorage

import type { DashboardStats, HeartbeatResponse } from "@/types/dashboard";

export interface DerivedAlert {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail?: string;
}

export function deriveAlerts(
  stats: DashboardStats | null,
  heartbeat: HeartbeatResponse | null
): DerivedAlert[] {
  if (!stats) return [];
  const alerts: DerivedAlert[] = [];

  // ═══ CRITICAL ═══

  if (stats.health.lunary.status === "down") {
    alerts.push({ id: "lunary-down", severity: "critical", title: "Lunary is DOWN" });
  }
  if (stats.health.spellcast.status === "down") {
    alerts.push({ id: "spellcast-down", severity: "critical", title: "Spellcast is DOWN" });
  }
  if (stats.health.contentCreator.status === "down") {
    alerts.push({ id: "cc-down", severity: "critical", title: "Content Creator is DOWN" });
  }

  if (heartbeat?.status === "offline") {
    alerts.push({ id: "mac-offline", severity: "critical", title: "Workstation offline", detail: "MAC not responding" });
  }

  if (stats.orbit?.errorAgents > 0) {
    alerts.push({
      id: "orbit-errors",
      severity: "critical",
      title: `${stats.orbit.errorAgents} Orbit agent${stats.orbit.errorAgents !== 1 ? "s" : ""} failed`,
      detail: "Agent pipeline has errors",
    });
  }

  if (stats.orbit && !stats.orbit.online) {
    alerts.push({ id: "orbit-offline", severity: "critical", title: "Orbit is offline", detail: "Agent command centre unreachable" });
  }

  if (stats.orbit?.authStatus === "auth-expired") {
    alerts.push({ id: "orbit-auth", severity: "critical", title: "Orbit auth expired", detail: "SSH in and run: claude auth login" });
  }

  // ═══ WARNING ═══

  if (stats.content.failedPosts > 0) {
    alerts.push({
      id: "failed-posts",
      severity: "warning",
      title: `${stats.content.failedPosts} failed post${stats.content.failedPosts !== 1 ? "s" : ""}`,
      detail: stats.content.failedPostDetails[0]?.error,
    });
  }

  if (stats.content.pendingReview > 0) {
    alerts.push({
      id: "pending-review",
      severity: "warning",
      title: `${stats.content.pendingReview} post${stats.content.pendingReview !== 1 ? "s" : ""} awaiting review`,
      detail: "Orbit submitted drafts for approval",
    });
  }

  if (stats.content.scheduledTomorrow === 0) {
    alerts.push({
      id: "no-tomorrow",
      severity: "warning",
      title: "No posts scheduled tomorrow",
      detail: "Content gap detected",
    });
  }

  if (stats.content.scheduledToday === 0 && new Date().getHours() < 18) {
    alerts.push({
      id: "no-today",
      severity: "warning",
      title: "No posts scheduled today",
    });
  }

  if (stats.seo.trend && stats.seo.trend.clicks.pct < -15) {
    alerts.push({
      id: "seo-drop",
      severity: "warning",
      title: "SEO clicks dropping",
      detail: `${stats.seo.trend.clicks.pct.toFixed(1)}% vs last week`,
    });
  }

  if (stats.health.lunary.latencyMs > 3000) {
    alerts.push({ id: "lunary-slow", severity: "warning", title: "Lunary response slow", detail: `${stats.health.lunary.latencyMs}ms` });
  }
  if (stats.health.spellcast.latencyMs > 3000) {
    alerts.push({ id: "spellcast-slow", severity: "warning", title: "Spellcast response slow", detail: `${stats.health.spellcast.latencyMs}ms` });
  }

  if (stats.engagement?.unread >= 10) {
    alerts.push({
      id: "engagement-backlog",
      severity: "warning",
      title: `${stats.engagement.unread} unread engagement items`,
      detail: "Replies piling up",
    });
  }

  if (stats.spellcast.queueDepth === 0) {
    alerts.push({
      id: "queue-empty",
      severity: "warning",
      title: "Content queue EMPTY",
      detail: "No posts in 48h pipeline",
    });
  }

  // ═══ INFO ═══

  const dauTrend = stats.trends?.dau;
  if (dauTrend && dauTrend.direction === "up" && dauTrend.delta >= 3) {
    alerts.push({ id: "dau-up", severity: "info", title: "DAU trending up", detail: `+${dauTrend.delta.toFixed(0)} since last check` });
  }

  if (stats.opportunities.length > 0) {
    alerts.push({
      id: "opportunities",
      severity: "info",
      title: `${stats.opportunities.length} engagement opportunit${stats.opportunities.length !== 1 ? "ies" : "y"}`,
    });
  }

  if (stats.orbit?.pipelineRunning) {
    alerts.push({
      id: "orbit-running",
      severity: "info",
      title: "Orbit pipeline active",
      detail: `${stats.orbit.runningAgents} agent${stats.orbit.runningAgents !== 1 ? "s" : ""} running`,
    });
  }

  return alerts;
}
