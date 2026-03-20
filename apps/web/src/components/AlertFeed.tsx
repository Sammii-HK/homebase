"use client";

import { useState, useEffect, useRef } from "react";
import type { DashboardStats, HeartbeatResponse } from "@/types/dashboard";

const PS2P = "'Press Start 2P', monospace";

interface Alert {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail?: string;
  room?: "lunary" | "spellcast" | "dev" | "meta" | "orbit" | "engagement";
  action?: { label: string; href?: string };
  ts: number;
}

function deriveAlerts(stats: DashboardStats | null, heartbeat: HeartbeatResponse | null): Alert[] {
  if (!stats) return [];
  const alerts: Alert[] = [];
  const now = Date.now();

  // Critical: service down
  if (stats.health.lunary.status === "down") {
    alerts.push({ id: "lunary-down", severity: "critical", title: "Lunary is DOWN", room: "dev", ts: now });
  }
  if (stats.health.spellcast.status === "down") {
    alerts.push({ id: "spellcast-down", severity: "critical", title: "Spellcast is DOWN", room: "dev", ts: now });
  }
  if (stats.health.contentCreator.status === "down") {
    alerts.push({ id: "cc-down", severity: "critical", title: "Content Creator is DOWN", room: "dev", ts: now });
  }

  // Critical: workstation offline
  if (heartbeat?.status === "offline") {
    alerts.push({ id: "mac-offline", severity: "critical", title: "Workstation offline", detail: "MAC not responding", room: "dev", ts: now });
  }

  // Warning: failed posts
  if (stats.content.failedPosts > 0) {
    alerts.push({
      id: "failed-posts",
      severity: "warning",
      title: `${stats.content.failedPosts} failed post${stats.content.failedPosts !== 1 ? "s" : ""}`,
      detail: stats.content.failedPostDetails[0]?.error,
      room: "spellcast",
      action: { label: "VIEW" },
      ts: now,
    });
  }

  // Warning: nothing scheduled tomorrow
  if (stats.content.scheduledTomorrow === 0) {
    alerts.push({
      id: "no-tomorrow",
      severity: "warning",
      title: "No posts scheduled tomorrow",
      detail: "Content gap detected",
      room: "spellcast",
      ts: now,
    });
  }

  // Warning: nothing scheduled today and it's before 6pm
  if (stats.content.scheduledToday === 0 && new Date().getHours() < 18) {
    alerts.push({
      id: "no-today",
      severity: "warning",
      title: "No posts scheduled today",
      room: "spellcast",
      ts: now,
    });
  }

  // Warning: SEO dropping
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

  // Warning: high latency
  if (stats.health.lunary.latencyMs > 3000) {
    alerts.push({ id: "lunary-slow", severity: "warning", title: "Lunary response slow", detail: `${stats.health.lunary.latencyMs}ms`, room: "dev", ts: now });
  }
  if (stats.health.spellcast.latencyMs > 3000) {
    alerts.push({ id: "spellcast-slow", severity: "warning", title: "Spellcast response slow", detail: `${stats.health.spellcast.latencyMs}ms`, room: "dev", ts: now });
  }

  // Info: DAU trend
  const dauTrend = stats.trends?.dau;
  if (dauTrend && dauTrend.direction === "up" && dauTrend.delta >= 3) {
    alerts.push({ id: "dau-up", severity: "info", title: "DAU trending up", detail: `+${dauTrend.delta.toFixed(0)} since last check`, room: "lunary", ts: now });
  }

  // Info: engagement opportunities
  if (stats.opportunities.length > 0) {
    alerts.push({
      id: "opportunities",
      severity: "info",
      title: `${stats.opportunities.length} engagement opportunit${stats.opportunities.length !== 1 ? "ies" : "y"}`,
      room: "meta",
      action: { label: "VIEW" },
      ts: now,
    });
  }

  // Info: queue depth low
  if (stats.spellcast.queueDepth <= 2 && stats.spellcast.queueDepth >= 0) {
    alerts.push({
      id: "queue-low",
      severity: "info",
      title: "Content queue running low",
      detail: `Only ${stats.spellcast.queueDepth} posts in 48h queue`,
      room: "spellcast",
      ts: now,
    });
  }

  return alerts;
}

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

interface AlertFeedProps {
  stats: DashboardStats | null;
  heartbeat: HeartbeatResponse | null;
  onOpenRoom?: (room: "lunary" | "spellcast" | "dev" | "meta" | "orbit" | "engagement") => void;
}

export default function AlertFeed({ stats, heartbeat, onOpenRoom }: AlertFeedProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(true);
  const prevCountRef = useRef(0);

  const alerts = deriveAlerts(stats, heartbeat).filter((a) => !dismissed.has(a.id));
  const criticals = alerts.filter((a) => a.severity === "critical");
  const warnings = alerts.filter((a) => a.severity === "warning");
  const infos = alerts.filter((a) => a.severity === "info");
  const sorted = [...criticals, ...warnings, ...infos];

  // Auto-expand when new critical alerts appear
  useEffect(() => {
    if (criticals.length > 0 && criticals.length > prevCountRef.current) {
      setExpanded(true);
    }
    prevCountRef.current = criticals.length;
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
        width: expanded ? "min(320px, 80vw)" : "auto",
      }}
    >
      {/* Toggle button */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "rgba(0,0,0,0.85)",
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
        {criticals.length > 0 && (
          <span style={{ fontFamily: PS2P, fontSize: 6, color: "#ef4444", marginLeft: "auto" }}>
            {criticals.length} CRIT
          </span>
        )}
        <span style={{ fontFamily: PS2P, fontSize: 8, color: "rgba(255,255,255,0.3)", marginLeft: expanded ? 0 : 4 }}>
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
          maxHeight: 280,
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
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontFamily: PS2P, fontSize: 8, color: colors.text, flex: 1 }}>
                      {alert.title}
                    </span>
                    {alert.room && (
                      <button
                        onClick={() => onOpenRoom?.(alert.room!)}
                        style={{
                          fontFamily: PS2P, fontSize: 6,
                          color: ROOM_ACCENTS[alert.room] ?? "#fff",
                          background: "rgba(255,255,255,0.05)",
                          border: `1px solid ${ROOM_ACCENTS[alert.room] ?? "rgba(255,255,255,0.1)"}`,
                          borderRadius: 3, padding: "2px 5px",
                          cursor: "pointer", flexShrink: 0,
                        }}
                      >
                        {alert.room.toUpperCase()}
                      </button>
                    )}
                  </div>
                  {alert.detail && (
                    <div style={{ fontFamily: PS2P, fontSize: 7, color: "rgba(255,255,255,0.3)", marginTop: 3, lineHeight: 1.3 }}>
                      {alert.detail}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setDismissed((s) => new Set([...s, alert.id]))}
                  style={{
                    fontFamily: PS2P, fontSize: 7,
                    color: "rgba(255,255,255,0.2)",
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
