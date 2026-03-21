"use client";

import type { DashboardStats, HeartbeatResponse } from "@/types/dashboard";

interface DigestCardProps {
  stats: DashboardStats | null;
  heartbeat: HeartbeatResponse | null;
}

interface DigestChip {
  icon: string;
  count: number | string;
  label: string;
  colour: string;
}

function countDownServices(health: DashboardStats["health"]): number {
  return Object.values(health).filter((s) => s.status !== "ok").length;
}

export default function DigestCard({ stats }: DigestCardProps) {
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
    {
      icon: "📅",
      count: stats.content.scheduledToday,
      label: "posts today",
      colour: "#888",
    },
    ...(stats.content.pendingReview > 0
      ? [
          {
            icon: "⏳",
            count: stats.content.pendingReview,
            label: "pending review",
            colour: "#fbbf24",
          },
        ]
      : []),
    ...(stats.content.failedPosts > 0
      ? [
          {
            icon: "✗",
            count: stats.content.failedPosts,
            label: "failed",
            colour: "#f87171",
          },
        ]
      : []),
    ...(stats.opportunities.length > 0
      ? [
          {
            icon: "💡",
            count: stats.opportunities.length,
            label: "opps",
            colour: "#4ade80",
          },
        ]
      : []),
    ...(stats.orbit.runningAgents > 0
      ? [
          {
            icon: "🤖",
            count: stats.orbit.runningAgents,
            label: "agents",
            colour: "#4ade80",
          },
        ]
      : []),
    ...(systemsDown > 0
      ? [
          {
            icon: "⚠",
            count: systemsDown,
            label: "system down",
            colour: "#f87171",
          },
        ]
      : []),
    ...(stats.github.commitsToday > 0
      ? [
          {
            icon: "⎇",
            count: stats.github.commitsToday,
            label: "commits",
            colour: "#4ade80",
          },
        ]
      : []),
  ];

  const now = new Date();
  const timeLabel = now.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <div
      style={{
        background: "#0a0a0f",
        border: "1px solid #1a1a2e",
        borderRadius: 8,
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
        {chips.map((chip, i) => (
          <span
            key={i}
            style={{
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
            }}
          >
            <span style={{ fontSize: 12, lineHeight: 1 }}>{chip.icon}</span>
            <span style={{ fontWeight: 600 }}>{chip.count}</span>
            <span style={{ opacity: 0.75, fontSize: 10 }}>{chip.label}</span>
          </span>
        ))}
        {chips.length === 0 && (
          <span
            style={{
              fontSize: 11,
              color: "#4ade80",
              fontFamily: "system-ui, sans-serif",
            }}
          >
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
  );
}
