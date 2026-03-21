"use client";

import { useState } from "react";
import type { Alert } from "@/app/api/alerts/route";

const PS2P = "'Press Start 2P', monospace";

// Map from Alert level to visual style
// error = red, warning = amber, info = blue, critical = red (back-compat)
const LEVEL_STYLES: Record<
  string,
  { bg: string; border: string; dot: string; text: string; actionColor: string }
> = {
  critical: {
    bg: "rgba(239,68,68,0.15)",
    border: "#ef4444",
    dot: "#ef4444",
    text: "rgba(255,255,255,0.9)",
    actionColor: "#ef4444",
  },
  error: {
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
  info: {
    bg: "rgba(59,130,246,0.1)",
    border: "#3b82f6",
    dot: "#3b82f6",
    text: "rgba(255,255,255,0.6)",
    actionColor: "#3b82f6",
  },
};

const ALERT_ROW_HEIGHT = 32; // px, matches height style below
const MAX_VISIBLE_ROWS = 3;

export default function AlertStrip({
  alerts,
  onTabChange,
}: {
  alerts: Alert[];
  onTabChange?: (tab: "status" | "queue" | "cast" | "chat") => void;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [retrying, setRetrying] = useState<Set<string>>(new Set());

  const visible = (alerts ?? []).filter((a) => !dismissed.has(a.id));

  if (visible.length === 0) return null;

  async function handleRetry(alertId: string) {
    setRetrying((prev) => new Set(prev).add(alertId));
    try {
      await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry", target: alertId }),
      });
    } catch {
      // Ignore — best-effort retry signal
    } finally {
      setRetrying((prev) => {
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
    }
  }

  function handleDismiss(alertId: string) {
    setDismissed((prev) => new Set(prev).add(alertId));
  }

  const isError = (level: string) => level === "error" || level === "critical";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        maxHeight: ALERT_ROW_HEIGHT * MAX_VISIBLE_ROWS + (MAX_VISIBLE_ROWS - 1) * 2,
        overflowY: visible.length > MAX_VISIBLE_ROWS ? "auto" : "visible",
        animation: "alertFadeIn 0.2s ease-out",
      }}
    >
      <style>{`
        @keyframes alertFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      {visible.map((alert) => {
        const s = LEVEL_STYLES[alert.level] ?? LEVEL_STYLES.warning;
        const isRetrying = retrying.has(alert.id);

        return (
          <div
            key={alert.id}
            style={{
              height: ALERT_ROW_HEIGHT,
              background: s.bg,
              borderLeft: `2px solid ${s.border}`,
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              padding: "0 8px 0 12px",
              gap: 8,
              flexShrink: 0,
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

            {/* Retry button — only for error/critical alerts */}
            {isError(alert.level) && (
              <button
                disabled={isRetrying}
                onClick={() => handleRetry(alert.id)}
                style={{
                  fontFamily: PS2P,
                  fontSize: 6,
                  color: s.actionColor,
                  background: "none",
                  border: `1px solid ${s.actionColor}`,
                  borderRadius: 2,
                  padding: "2px 6px",
                  cursor: isRetrying ? "not-allowed" : "pointer",
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  flexShrink: 0,
                  opacity: isRetrying ? 0.5 : 0.9,
                }}
              >
                {isRetrying ? "..." : "RETRY"}
              </button>
            )}

            {/* Existing action button (tab-navigation) */}
            {alert.action && !isError(alert.level) && (
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

            {/* Dismiss button */}
            <button
              onClick={() => handleDismiss(alert.id)}
              aria-label="Dismiss alert"
              style={{
                fontFamily: PS2P,
                fontSize: 7,
                color: "rgba(255,255,255,0.3)",
                background: "none",
                border: "none",
                padding: "2px 4px",
                cursor: "pointer",
                flexShrink: 0,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
