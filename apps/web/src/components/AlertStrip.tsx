"use client";

import type { Alert } from "@/app/api/alerts/route";

const PS2P = "'Press Start 2P', monospace";

const LEVEL_STYLES = {
  critical: {
    bg: "rgba(239,68,68,0.15)",
    border: "#ef4444",
    dot: "#ef4444",
    text: "rgba(255,255,255,0.9)",
    actionColor: "#ef4444",
  },
  warning: {
    bg: "rgba(251,191,36,0.1)",
    border: "#fbbf24",
    dot: "#fbbf24",
    text: "rgba(255,255,255,0.6)",
    actionColor: "#fbbf24",
  },
};

export default function AlertStrip({
  alerts,
  onTabChange,
}: {
  alerts: Alert[];
  onTabChange?: (tab: "status" | "queue" | "chat") => void;
}) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        animation: "alertFadeIn 0.2s ease-out",
      }}
    >
      <style>{`
        @keyframes alertFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      {alerts.map((alert) => {
        const s = LEVEL_STYLES[alert.level];
        return (
          <div
            key={alert.id}
            style={{
              height: 32,
              background: s.bg,
              borderLeft: `2px solid ${s.border}`,
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              padding: "0 12px",
              gap: 8,
            }}
          >
            {/* Dot indicator */}
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: s.dot,
                flexShrink: 0,
              }}
            />

            {/* Message */}
            <span
              style={{
                fontFamily: PS2P,
                fontSize: 7,
                color: s.text,
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {alert.message}
            </span>

            {/* Action button */}
            {alert.action && (
              <button
                onClick={() => {
                  if (alert.action?.tab && onTabChange) {
                    onTabChange(alert.action.tab);
                  }
                }}
                style={{
                  fontFamily: PS2P,
                  fontSize: 6,
                  color: s.actionColor,
                  background: "none",
                  border: `1px solid ${s.actionColor}`,
                  borderRadius: 2,
                  padding: "2px 6px",
                  cursor: "pointer",
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  flexShrink: 0,
                  opacity: 0.9,
                }}
              >
                {alert.action.label}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
