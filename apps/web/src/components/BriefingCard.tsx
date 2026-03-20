"use client";

import { useState, useEffect, useCallback } from "react";

const PS2P = "'Press Start 2P', monospace";

interface Briefing {
  date: string;
  orbitBriefing: Record<string, unknown> | null;
  metrics: { dau: number; mau: number; mrr: number };
  content: { pendingReview: number; scheduledToday: number; failedPosts: number };
  engagement: { unread: number };
  alerts: string[];
  generatedAt: string;
}

interface Props {
  token: string;
  onOpenApprovalQueue?: () => void;
}

export default function BriefingCard({ token, onOpenApprovalQueue }: Props) {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  const fetchBriefing = useCallback(async () => {
    try {
      const res = await fetch("/api/briefing", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setBriefing(await res.json());
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // Check if already dismissed today
    const dismissedDate = localStorage.getItem("homebase_briefing_dismissed");
    if (dismissedDate === new Date().toISOString().slice(0, 10)) {
      setDismissed(true);
      setLoading(false);
      return;
    }
    fetchBriefing();
  }, [fetchBriefing]);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("homebase_briefing_dismissed", new Date().toISOString().slice(0, 10));
  };

  if (dismissed || loading || !briefing) return null;

  // Don't show if nothing interesting
  const hasAlerts = briefing.alerts.length > 0;
  const hasPending = briefing.content.pendingReview > 0;
  const hasContent = hasAlerts || hasPending;
  if (!hasContent) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 40,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 80,
        width: "calc(100% - 24px)",
        maxWidth: 420,
        background: "rgba(15,10,30,0.95)",
        border: "1px solid rgba(167,139,250,0.3)",
        borderRadius: 8,
        padding: 16,
        backdropFilter: "blur(12px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontFamily: PS2P, fontSize: 9, color: "#a78bfa", letterSpacing: 1 }}>
          MORNING BRIEFING
        </div>
        <button
          onClick={handleDismiss}
          style={{
            fontFamily: PS2P,
            fontSize: 7,
            color: "rgba(255,255,255,0.35)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px 6px",
          }}
        >
          DISMISS
        </button>
      </div>

      {/* Metrics row */}
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <MetricPill label="DAU" value={briefing.metrics.dau} />
        <MetricPill label="MAU" value={briefing.metrics.mau} />
        <MetricPill label="MRR" value={`£${briefing.metrics.mrr}`} />
      </div>

      {/* Alerts */}
      {briefing.alerts.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {briefing.alerts.map((alert, i) => (
            <div
              key={i}
              style={{
                fontFamily: "system-ui, -apple-system, sans-serif",
                fontSize: 12,
                lineHeight: 1.6,
                color: alert.includes("failed") || alert.includes("No content")
                  ? "#f87171"
                  : alert.includes("approval")
                  ? "#facc15"
                  : "rgba(255,255,255,0.7)",
                paddingLeft: 12,
                position: "relative",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  color: alert.includes("failed") || alert.includes("No content")
                    ? "#f87171"
                    : "#facc15",
                }}
              >
                &bull;
              </span>
              {alert}
            </div>
          ))}
        </div>
      )}

      {/* Content summary */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <ContentChip
          label="Scheduled today"
          value={briefing.content.scheduledToday}
          color="#4ade80"
        />
        <ContentChip
          label="Pending review"
          value={briefing.content.pendingReview}
          color="#facc15"
          onClick={hasPending && onOpenApprovalQueue ? onOpenApprovalQueue : undefined}
        />
        {briefing.content.failedPosts > 0 && (
          <ContentChip
            label="Failed"
            value={briefing.content.failedPosts}
            color="#f87171"
          />
        )}
      </div>

      {/* Engagement */}
      {briefing.engagement.unread > 0 && (
        <div
          style={{
            fontFamily: PS2P,
            fontSize: 8,
            color: "rgba(255,255,255,0.4)",
          }}
        >
          {briefing.engagement.unread} unread engagement items
        </div>
      )}

      {/* Timestamp */}
      <div
        style={{
          fontFamily: PS2P,
          fontSize: 7,
          color: "rgba(255,255,255,0.2)",
          marginTop: 10,
          textAlign: "right",
        }}
      >
        {new Date(briefing.generatedAt).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        flex: 1,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 4,
        padding: "6px 8px",
        textAlign: "center",
      }}
    >
      <div style={{ fontFamily: PS2P, fontSize: 7, color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontFamily: PS2P, fontSize: 13, color: "#fff" }}>{value}</div>
    </div>
  );
}

function ContentChip({
  label,
  value,
  color,
  onClick,
}: {
  label: string;
  value: number;
  color: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1,
        background: `${color}10`,
        border: `1px solid ${color}30`,
        borderRadius: 4,
        padding: "6px 8px",
        textAlign: "center",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={{ fontFamily: PS2P, fontSize: 14, color }}>{value}</div>
      <div style={{ fontFamily: PS2P, fontSize: 6, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>
        {label}
      </div>
    </div>
  );
}
