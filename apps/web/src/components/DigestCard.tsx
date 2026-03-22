"use client";

import { useState } from "react";
import type { DashboardStats, HeartbeatResponse } from "@/types/dashboard";

interface DigestCardProps {
  stats: DashboardStats | null;
  heartbeat: HeartbeatResponse | null;
  onOpenApprovalQueue?: () => void;
  onOpenEngagementQueue?: () => void;
}

interface DigestChip {
  icon: string;
  count: number | string;
  label: string;
  colour: string;
  onClick?: () => void;
  href?: string;
}

// Only count truly down services (degraded = partial/Cloudflare, not an alert)
function countDownServices(health: DashboardStats["health"]): number {
  return Object.values(health).filter((s) => s.status === "down").length;
}

const SERVICE_LABELS: Record<string, string> = {
  lunary: "lunary.app",
  spellcast: "spellcast",
  contentCreator: "content",
  orbit: "orbit",
};

const STATUS_COLOUR: Record<string, string> = {
  ok: "#4ade80",
  degraded: "#fbbf24",
  down: "#f87171",
};

const STATUS_DOT: Record<string, string> = {
  ok: "●",
  degraded: "◐",
  down: "●",
};

export default function DigestCard({ stats, onOpenApprovalQueue, onOpenEngagementQueue }: DigestCardProps) {
  const [showHealth, setShowHealth] = useState(false);

  // Loading skeleton
  if (!stats) {
    return (
      <div
        style={{
          background: "#0a0a0f",
          border: "1px solid #1a1a2e",
          borderRadius: 8,
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          minHeight: 44,
        }}
      >
        {[80, 100, 72].map((w, i) => (
          <div
            key={i}
            style={{
              width: w,
              height: 24,
              borderRadius: 12,
              background: "rgba(255,255,255,0.06)",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        ))}
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 0.8; }
          }
        `}</style>
      </div>
    );
  }

  const systemsDown = countDownServices(stats.health);

  const chips: DigestChip[] = [
    ...(stats.content.scheduledToday > 0
      ? [{ icon: "📅", count: stats.content.scheduledToday, label: "posts today", colour: "#888", onClick: onOpenApprovalQueue }]
      : []),
    ...(stats.content.pendingReview > 0
      ? [{ icon: "⏳", count: stats.content.pendingReview, label: "review", colour: "#fbbf24", onClick: onOpenApprovalQueue }]
      : []),
    ...(stats.content.failedPosts > 0
      ? [{ icon: "✗", count: stats.content.failedPosts, label: "failed", colour: "#f87171", onClick: onOpenApprovalQueue }]
      : []),
    ...(stats.opportunities.length > 0
      ? [{ icon: "💡", count: stats.opportunities.length, label: "opps", colour: "#4ade80", onClick: onOpenEngagementQueue }]
      : []),
    ...(stats.orbit.runningAgents > 0
      ? [{ icon: "🤖", count: stats.orbit.runningAgents, label: "agents", colour: "#4ade80" }]
      : []),
    ...(systemsDown > 0
      ? [{ icon: "⚠", count: systemsDown, label: "down", colour: "#f87171", onClick: () => setShowHealth((v) => !v) }]
      : []),
    ...(stats.github.commitsToday > 0
      ? [{ icon: "⎇", count: stats.github.commitsToday, label: "commits", colour: "#4ade80", href: "https://github.com/sammii-hk" }]
      : []),
  ];

  const now = new Date();
  const timeLabel = now.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          background: "#0a0a0f",
          border: "1px solid #1a1a2e",
          borderRadius: showHealth ? "8px 8px 0 0" : 8,
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
          minHeight: 44,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {chips.map((chip, i) => {
            const isClickable = !!(chip.onClick || chip.href);
            const chipStyle: React.CSSProperties = {
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: `${chip.colour}18`,
              border: `1px solid ${chip.colour}40`,
              borderRadius: 20,
              padding: "3px 9px",
              fontSize: 11,
              lineHeight: 1.4,
              color: chip.colour,
              whiteSpace: "nowrap",
              fontFamily: "system-ui, sans-serif",
              cursor: isClickable ? "pointer" : "default",
              transition: isClickable ? "background 0.15s, border-color 0.15s" : undefined,
              textDecoration: "none",
            };
            const content = (
              <>
                <span style={{ fontSize: 12, lineHeight: 1 }}>{chip.icon}</span>
                <span style={{ fontWeight: 600 }}>{chip.count}</span>
                <span style={{ opacity: 0.75, fontSize: 10 }}>{chip.label}</span>
              </>
            );
            if (chip.href) {
              return (
                <a key={i} href={chip.href} target="_blank" rel="noopener noreferrer" style={chipStyle}>
                  {content}
                </a>
              );
            }
            if (chip.onClick) {
              return (
                <button
                  key={i}
                  onClick={chip.onClick}
                  style={{ ...chipStyle, background: `${chip.colour}18` }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `${chip.colour}28`; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = `${chip.colour}18`; }}
                >
                  {content}
                </button>
              );
            }
            return <span key={i} style={chipStyle}>{content}</span>;
          })}
          {chips.length === 0 && (
            <span style={{ fontSize: 11, color: "#4ade80", fontFamily: "system-ui, sans-serif" }}>
              All clear today
            </span>
          )}
        </div>
        <span
          style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.2)",
            fontFamily: "system-ui, sans-serif",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {timeLabel}
        </span>
      </div>

      {/* Health breakdown panel */}
      {showHealth && (
        <div
          style={{
            background: "#0a0a0f",
            border: "1px solid #1a1a2e",
            borderTop: "1px solid #1a1a2e",
            borderRadius: "0 0 8px 8px",
            padding: "8px 14px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {Object.entries(stats.health).map(([key, svc]) => (
            <div
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: STATUS_COLOUR[svc.status], fontSize: 9 }}>
                  {STATUS_DOT[svc.status]}
                </span>
                <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
                  {SERVICE_LABELS[key] ?? key}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontFamily: "system-ui, sans-serif",
                    fontSize: 10,
                    color: STATUS_COLOUR[svc.status],
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {svc.status}
                </span>
                {svc.latencyMs > 0 && svc.status !== "down" && (
                  <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 10, color: "rgba(255,255,255,0.2)" }}>
                    {svc.latencyMs}ms
                  </span>
                )}
              </div>
            </div>
          ))}
          <button
            onClick={() => setShowHealth(false)}
            style={{
              marginTop: 2,
              alignSelf: "flex-end",
              fontFamily: "system-ui, sans-serif",
              fontSize: 10,
              color: "rgba(255,255,255,0.3)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            close ✕
          </button>
        </div>
      )}
    </div>
  );
}
