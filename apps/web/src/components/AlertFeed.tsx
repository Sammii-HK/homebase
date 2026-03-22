"use client";

import { authHeaders } from "@/lib/client-auth";
import { useState, useEffect, useRef, useCallback } from "react";
import type { DashboardStats, HeartbeatResponse } from "@/types/dashboard";

const PS2P = "'Press Start 2P', monospace";

type RoomId = "lunary" | "spellcast" | "dev" | "meta" | "orbit" | "engagement";

interface Alert {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail?: string;
  room?: RoomId;
  quickAction?: { label: string; actionId: string; payload?: Record<string, unknown> };
  ts: number;
}

// ── Persistent dismissals (survive page refresh) ─────────────────────

const DISMISS_KEY = "homebase_dismissed_alerts";
const DISMISS_EXPIRY_MS = 4 * 60 * 60 * 1000; // 4 hours — auto-resurface

function loadDismissed(): Map<string, number> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return new Map();
    const entries: [string, number][] = JSON.parse(raw);
    const now = Date.now();
    // Filter expired dismissals
    return new Map(entries.filter(([, ts]) => now - ts < DISMISS_EXPIRY_MS));
  } catch {
    return new Map();
  }
}

function saveDismissed(map: Map<string, number>) {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify([...map.entries()]));
  } catch { /* ignore quota errors */ }
}

// ── Alert derivation engine ──────────────────────────────────────────

function deriveAlerts(stats: DashboardStats | null, heartbeat: HeartbeatResponse | null): Alert[] {
  if (!stats) return [];
  const alerts: Alert[] = [];
  const now = Date.now();

  // ═══ CRITICAL ═══

  // Service down
  if (stats.health.lunary.status === "down") {
    alerts.push({ id: "lunary-down", severity: "critical", title: "Lunary is DOWN", room: "dev", ts: now });
  }
  if (stats.health.spellcast.status === "down") {
    alerts.push({ id: "spellcast-down", severity: "critical", title: "Spellcast is DOWN", room: "dev", ts: now });
  }
  if (stats.health.contentCreator.status === "down") {
    alerts.push({ id: "cc-down", severity: "critical", title: "Content Creator is DOWN", room: "dev", ts: now });
  }

  // Workstation offline
  if (heartbeat?.status === "offline") {
    alerts.push({ id: "mac-offline", severity: "critical", title: "Workstation offline", detail: "MAC not responding", room: "dev", ts: now });
  }

  // Orbit agent errors
  if (stats.orbit?.errorAgents > 0) {
    alerts.push({
      id: "orbit-errors",
      severity: "critical",
      title: `${stats.orbit.errorAgents} Orbit agent${stats.orbit.errorAgents !== 1 ? "s" : ""} failed`,
      detail: "Agent pipeline has errors",
      room: "orbit",
      ts: now,
    });
  }

  // Orbit offline
  if (stats.orbit && !stats.orbit.online) {
    alerts.push({ id: "orbit-offline", severity: "critical", title: "Orbit is offline", detail: "Agent command centre unreachable", room: "orbit", ts: now });
  }

  // Orbit auth expired
  if (stats.orbit?.authStatus === "auth-expired") {
    alerts.push({ id: "orbit-auth", severity: "critical", title: "Orbit auth expired", detail: "SSH in and run: claude auth login", room: "orbit", ts: now });
  }

  // ═══ WARNING ═══

  // Failed posts with quick action
  if (stats.content.failedPosts > 0) {
    alerts.push({
      id: "failed-posts",
      severity: "warning",
      title: `${stats.content.failedPosts} failed post${stats.content.failedPosts !== 1 ? "s" : ""}`,
      detail: stats.content.failedPostDetails[0]?.error,
      room: "spellcast",
      quickAction: { label: "RETRY ALL", actionId: "retry-all-failed" },
      ts: now,
    });
  }

  // Posts waiting for review (Orbit submitted drafts)
  if (stats.content.pendingReview > 0) {
    alerts.push({
      id: "pending-review",
      severity: "warning",
      title: `${stats.content.pendingReview} post${stats.content.pendingReview !== 1 ? "s" : ""} awaiting review`,
      detail: "Orbit submitted drafts for approval",
      room: "spellcast",
      quickAction: { label: "REVIEW", actionId: "open-approval-queue" },
      ts: now,
    });
  }

  // Nothing scheduled tomorrow
  if (stats.content.scheduledTomorrow === 0) {
    alerts.push({
      id: "no-tomorrow",
      severity: "warning",
      title: "No posts scheduled tomorrow",
      detail: "Content gap detected",
      room: "spellcast",
      quickAction: { label: "AUTOPILOT", actionId: "trigger-autopilot" },
      ts: now,
    });
  }

  // Nothing scheduled today (before 6pm)
  if (stats.content.scheduledToday === 0 && new Date().getHours() < 18) {
    alerts.push({
      id: "no-today",
      severity: "warning",
      title: "No posts scheduled today",
      room: "spellcast",
      quickAction: { label: "AUTOPILOT", actionId: "trigger-autopilot" },
      ts: now,
    });
  }

  // SEO clicks dropping
  if (stats.seo.trend && stats.seo.trend.clicks.pct < -15) {
    alerts.push({
      id: "seo-drop",
      severity: "warning",
      title: "SEO clicks dropping",
      detail: `${stats.seo.trend.clicks.pct.toFixed(1)}% vs last week`,
      room: "meta",
      ts: now,
    });
  }

  // SEO impressions dropping (separate from clicks — can indicate different problems)
  if (stats.seo.trend && stats.seo.trend.impressions.pct < -20) {
    alerts.push({
      id: "seo-impressions-drop",
      severity: "warning",
      title: "SEO impressions dropping",
      detail: `${stats.seo.trend.impressions.pct.toFixed(1)}% vs last week`,
      room: "meta",
      ts: now,
    });
  }

  // High latency
  if (stats.health.lunary.latencyMs > 3000) {
    alerts.push({ id: "lunary-slow", severity: "warning", title: "Lunary response slow", detail: `${stats.health.lunary.latencyMs}ms`, room: "dev", ts: now });
  }
  if (stats.health.spellcast.latencyMs > 3000) {
    alerts.push({ id: "spellcast-slow", severity: "warning", title: "Spellcast response slow", detail: `${stats.health.spellcast.latencyMs}ms`, room: "dev", ts: now });
  }

  // Engagement backlog — lots of unread items piling up
  if (stats.engagement?.unread >= 10) {
    alerts.push({
      id: "engagement-backlog",
      severity: "warning",
      title: `${stats.engagement.unread} unread engagement items`,
      detail: "Replies piling up",
      room: "engagement",
      ts: now,
    });
  }

  // DAU dropping
  const dauTrend = stats.trends?.dau;
  if (dauTrend && dauTrend.direction === "down" && dauTrend.delta <= -5) {
    alerts.push({
      id: "dau-drop",
      severity: "warning",
      title: "DAU dropping",
      detail: `${dauTrend.delta.toFixed(0)} since last check`,
      room: "lunary",
      ts: now,
    });
  }

  // MRR dropping
  const mrrTrend = stats.trends?.mrr;
  if (mrrTrend && mrrTrend.direction === "down" && mrrTrend.delta < 0) {
    alerts.push({
      id: "mrr-drop",
      severity: "warning",
      title: "MRR decreased",
      detail: `${mrrTrend.delta.toFixed(2)} since last check`,
      room: "lunary",
      ts: now,
    });
  }

  // Content queue critically low (0 posts)
  if (stats.spellcast.queueDepth === 0) {
    alerts.push({
      id: "queue-empty",
      severity: "warning",
      title: "Content queue EMPTY",
      detail: "No posts in 48h pipeline",
      room: "spellcast",
      quickAction: { label: "AUTOPILOT", actionId: "trigger-autopilot" },
      ts: now,
    });
  }

  // Zero reach this week
  if (stats.meta.reachThisWeek === 0 && stats.meta.postsThisWeek > 0) {
    alerts.push({
      id: "zero-reach",
      severity: "warning",
      title: "Zero reach this week",
      detail: `${stats.meta.postsThisWeek} posts sent, 0 reach`,
      room: "meta",
      ts: now,
    });
  }

  // ═══ INFO ═══

  // DAU trending up
  if (dauTrend && dauTrend.direction === "up" && dauTrend.delta >= 3) {
    alerts.push({ id: "dau-up", severity: "info", title: "DAU trending up", detail: `+${dauTrend.delta.toFixed(0)} since last check`, room: "lunary", ts: now });
  }

  // MRR trending up
  if (mrrTrend && mrrTrend.direction === "up" && mrrTrend.delta > 0) {
    alerts.push({ id: "mrr-up", severity: "info", title: "MRR increased", detail: `+${mrrTrend.delta.toFixed(2)}`, room: "lunary", ts: now });
  }

  // Engagement opportunities
  if (stats.opportunities.length > 0) {
    alerts.push({
      id: "opportunities",
      severity: "info",
      title: `${stats.opportunities.length} engagement opportunit${stats.opportunities.length !== 1 ? "ies" : "y"}`,
      room: "engagement",
      ts: now,
    });
  }

  // Unread engagement (low count — informational)
  if (stats.engagement?.unread > 0 && stats.engagement.unread < 10) {
    alerts.push({
      id: "engagement-unread",
      severity: "info",
      title: `${stats.engagement.unread} unread comment${stats.engagement.unread !== 1 ? "s" : ""}`,
      room: "engagement",
      ts: now,
    });
  }

  // Queue running low (not empty but getting there)
  if (stats.spellcast.queueDepth > 0 && stats.spellcast.queueDepth <= 2) {
    alerts.push({
      id: "queue-low",
      severity: "info",
      title: "Content queue running low",
      detail: `Only ${stats.spellcast.queueDepth} posts in 48h queue`,
      room: "spellcast",
      ts: now,
    });
  }

  // Orbit pipeline running
  if (stats.orbit?.pipelineRunning) {
    alerts.push({
      id: "orbit-running",
      severity: "info",
      title: `Orbit pipeline active`,
      detail: `${stats.orbit.runningAgents} agent${stats.orbit.runningAgents !== 1 ? "s" : ""} running`,
      room: "orbit",
      ts: now,
    });
  }

  // GitHub activity
  if (stats.github.commitsToday >= 5) {
    alerts.push({
      id: "commits-active",
      severity: "info",
      title: `${stats.github.commitsToday} commits today`,
      detail: "Productive day",
      room: "dev",
      ts: now,
    });
  }

  // SEO trending up
  if (stats.seo.trend && stats.seo.trend.clicks.pct > 15) {
    alerts.push({
      id: "seo-up",
      severity: "info",
      title: "SEO clicks growing",
      detail: `+${stats.seo.trend.clicks.pct.toFixed(1)}% vs last week`,
      room: "meta",
      ts: now,
    });
  }

  return alerts;
}

// ── Colours ──────────────────────────────────────────────────────────

const SEVERITY_COLORS = {
  critical: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", dot: "#ef4444", text: "#fca5a5" },
  warning: { bg: "rgba(250,204,21,0.08)", border: "rgba(250,204,21,0.2)", dot: "#facc15", text: "#fde68a" },
  info: { bg: "rgba(96,165,250,0.06)", border: "rgba(96,165,250,0.15)", dot: "#60a5fa", text: "#93c5fd" },
};

const ROOM_ACCENTS: Record<string, string> = {
  lunary: "#c084fc",
  spellcast: "#22d3ee",
  dev: "#4ade80",
  meta: "#f472b6",
  orbit: "#f59e0b",
  engagement: "#10b981",
};

// ── Component ────────────────────────────────────────────────────────

interface AlertFeedProps {
  stats: DashboardStats | null;
  heartbeat: HeartbeatResponse | null;
  token?: string | null;
  onOpenRoom?: (room: RoomId) => void;
  onOpenApprovalQueue?: () => void;
  onRefresh?: () => void;
}

export default function AlertFeed({ stats, heartbeat, token, onOpenRoom, onOpenApprovalQueue, onRefresh }: AlertFeedProps) {
  const [dismissed, setDismissed] = useState<Map<string, number>>(() => new Map());
  const [expanded, setExpanded] = useState(true);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const prevCritRef = useRef(0);

  // Load persisted dismissals on mount
  useEffect(() => {
    setDismissed(loadDismissed());
  }, []);

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Map(prev);
      next.set(id, Date.now());
      saveDismissed(next);
      return next;
    });
  }, []);

  const executeAction = useCallback(async (actionId: string, payload?: Record<string, unknown>) => {
    if (!token || runningAction) return;
    setRunningAction(actionId);
    try {
      await fetch("/api/actions", {
        method: "POST",
        headers: { ...authHeaders(token ?? ""), "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionId, ...payload }),
      });
      // Refresh data after action
      setTimeout(() => onRefresh?.(), 2000);
    } catch { /* silently fail */ }
    setRunningAction(null);
  }, [token, runningAction, onRefresh]);

  const alerts = deriveAlerts(stats, heartbeat).filter((a) => !dismissed.has(a.id));
  const criticals = alerts.filter((a) => a.severity === "critical");
  const warnings = alerts.filter((a) => a.severity === "warning");
  const infos = alerts.filter((a) => a.severity === "info");
  const sorted = [...criticals, ...warnings, ...infos];

  // Auto-expand when new critical alerts appear
  useEffect(() => {
    if (criticals.length > 0 && criticals.length > prevCritRef.current) {
      setExpanded(true);
    }
    prevCritRef.current = criticals.length;
  }, [criticals.length]);

  if (sorted.length === 0) return null;

  const topSeverity = sorted[0]?.severity ?? "info";
  const topColor = SEVERITY_COLORS[topSeverity];

  return (
    <div
      style={{
        position: "fixed",
        top: 42,
        left: 8,
        zIndex: 40,
        width: expanded ? "min(340px, 85vw)" : "auto",
      }}
    >
      {/* Toggle button */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "var(--hb-panel-85)",
          border: `1px solid ${topColor.border}`,
          borderRadius: expanded ? "6px 6px 0 0" : 6,
          padding: "5px 10px",
          cursor: "pointer",
          width: expanded ? "100%" : "auto",
        }}
      >
        <div style={{
          width: 7, height: 7, borderRadius: 2,
          background: topColor.dot,
          boxShadow: `0 0 6px ${topColor.dot}`,
          animation: topSeverity === "critical" ? "pulse 1.5s ease-in-out infinite" : "none",
        }} />
        <span style={{ fontFamily: PS2P, fontSize: 7, color: topColor.text }}>
          {sorted.length} ALERT{sorted.length !== 1 ? "S" : ""}
        </span>
        {warnings.length > 0 && criticals.length === 0 && (
          <span style={{ fontFamily: PS2P, fontSize: 6, color: "#facc15", marginLeft: "auto" }}>
            {warnings.length} WARN
          </span>
        )}
        {criticals.length > 0 && (
          <span style={{ fontFamily: PS2P, fontSize: 6, color: "#ef4444", marginLeft: "auto" }}>
            {criticals.length} CRIT
          </span>
        )}
        <span style={{ fontFamily: PS2P, fontSize: 8, color: "var(--hb-60)", marginLeft: expanded ? 0 : 4 }}>
          {expanded ? "▼" : "▶"}
        </span>
      </button>

      {/* Feed */}
      {expanded && (
        <div style={{
          background: "rgba(8,8,14,0.95)",
          border: `1px solid ${topColor.border}`,
          borderTop: "none",
          borderRadius: "0 0 6px 6px",
          maxHeight: 340,
          overflowY: "auto",
        }}>
          {sorted.map((alert) => {
            const colors = SEVERITY_COLORS[alert.severity];
            return (
              <div
                key={alert.id}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 8,
                  padding: "8px 10px",
                  background: colors.bg,
                  borderBottom: `1px solid ${colors.border}`,
                }}
              >
                <div style={{
                  width: 6, height: 6, borderRadius: 1, marginTop: 3, flexShrink: 0,
                  background: colors.dot,
                  boxShadow: `0 0 4px ${colors.dot}`,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: PS2P, fontSize: 8, color: colors.text, flex: 1, minWidth: 0 }}>
                      {alert.title}
                    </span>
                    {alert.quickAction && token && (
                      <button
                        onClick={() => {
                          if (alert.quickAction!.actionId === "open-approval-queue") {
                            onOpenApprovalQueue?.();
                          } else {
                            executeAction(alert.quickAction!.actionId, alert.quickAction!.payload);
                          }
                        }}
                        disabled={runningAction === alert.quickAction.actionId}
                        style={{
                          fontFamily: PS2P, fontSize: 6,
                          color: runningAction === alert.quickAction.actionId ? "var(--hb-60)" : "#4ade80",
                          background: "rgba(74,222,128,0.08)",
                          border: "1px solid rgba(74,222,128,0.3)",
                          borderRadius: 3, padding: "2px 5px",
                          cursor: runningAction ? "wait" : "pointer", flexShrink: 0,
                        }}
                      >
                        {runningAction === alert.quickAction.actionId ? "..." : alert.quickAction.label}
                      </button>
                    )}
                    {alert.room && (
                      <button
                        onClick={() => onOpenRoom?.(alert.room!)}
                        style={{
                          fontFamily: PS2P, fontSize: 6,
                          color: ROOM_ACCENTS[alert.room] ?? "#fff",
                          background: "var(--hb-05)",
                          border: `1px solid ${ROOM_ACCENTS[alert.room] ?? "var(--hb-10)"}`,
                          borderRadius: 3, padding: "2px 5px",
                          cursor: "pointer", flexShrink: 0,
                        }}
                      >
                        {alert.room.toUpperCase()}
                      </button>
                    )}
                  </div>
                  {alert.detail && (
                    <div style={{ fontFamily: PS2P, fontSize: 7, color: "var(--hb-60)", marginTop: 3, lineHeight: 1.3 }}>
                      {alert.detail}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => dismiss(alert.id)}
                  style={{
                    fontFamily: PS2P, fontSize: 7,
                    color: "var(--hb-20)",
                    background: "none", border: "none",
                    cursor: "pointer", padding: "0 2px", flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
