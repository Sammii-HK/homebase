"use client";

import { authHeaders } from "@/lib/client-auth";
import { useState, useEffect, useCallback } from "react";

const PS2P = "'Press Start 2P', monospace";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BriefingItem {
  priority: "urgent" | "today" | "info" | "done";
  label: string;
  detail: string;
  action?: string;
  count?: number;
}

interface Briefing {
  generatedAt: string;
  items: BriefingItem[];
  allClear: boolean;
  // Legacy fields still present for compatibility
  compiledAt?: string | null;
}

interface Props {
  token: string;
  onOpenApprovalQueue?: () => void;
  onNavigate?: (tab: string) => void;
  inline?: boolean;
}

// ── Colours ───────────────────────────────────────────────────────────────────

const PRIORITY_COLOUR: Record<BriefingItem["priority"], string> = {
  urgent: "#f87171",
  today: "#fbbf24",
  info: "var(--hb-accent)",
  done: "#34d399",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }) + " UTC";
  } catch {
    return "";
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PriorityDot({ priority }: { priority: BriefingItem["priority"] }) {
  const colour = PRIORITY_COLOUR[priority];
  const pulse = priority === "urgent";
  return (
    <div
      style={{
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: colour,
        flexShrink: 0,
        boxShadow: pulse ? `0 0 6px ${colour}` : undefined,
        animation: pulse ? "pulse-dot 1.4s ease-in-out infinite" : undefined,
      }}
    />
  );
}

function ActionItem({
  item,
  index,
  onNavigate,
  onOpenApprovalQueue,
}: {
  item: BriefingItem;
  index: number;
  onNavigate?: (tab: string) => void;
  onOpenApprovalQueue?: () => void;
}) {
  const colour = PRIORITY_COLOUR[item.priority];

  const handleClick = () => {
    if (!item.action) return;
    if (item.action === "approvals" && onOpenApprovalQueue) {
      onOpenApprovalQueue();
    } else if (onNavigate) {
      onNavigate(item.action);
    }
  };

  const clickable = Boolean(item.action && (onNavigate || (item.action === "approvals" && onOpenApprovalQueue)));

  return (
    <div
      onClick={clickable ? handleClick : undefined}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "7px 8px",
        borderRadius: 5,
        background: `${colour}08`,
        border: `1px solid ${colour}20`,
        cursor: clickable ? "pointer" : "default",
        transition: "background 0.15s",
      }}
    >
      {/* Number */}
      <div
        style={{
          fontFamily: PS2P,
          fontSize: 6,
          color: "var(--hb-25)",
          flexShrink: 0,
          paddingTop: 1,
          minWidth: 10,
        }}
      >
        {index + 1}
      </div>

      {/* Dot */}
      <div style={{ paddingTop: 2 }}>
        <PriorityDot priority={item.priority} />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: PS2P,
            fontSize: 7,
            color: colour,
            letterSpacing: 0.5,
            lineHeight: 1.6,
            wordBreak: "break-word",
          }}
        >
          {item.label}
        </div>
        <div
          style={{
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: 11,
            color: "var(--hb-50)",
            marginTop: 2,
            lineHeight: 1.4,
          }}
        >
          {item.detail}
        </div>
      </div>

      {/* Arrow if clickable */}
      {clickable && (
        <div
          style={{
            fontFamily: PS2P,
            fontSize: 6,
            color: "var(--hb-20)",
            flexShrink: 0,
            paddingTop: 2,
          }}
        >
          {"\u25b6"}
        </div>
      )}
    </div>
  );
}

function AllClearState({ timestamp }: { timestamp: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "20px 0 14px",
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "#34d399",
          boxShadow: "0 0 14px #34d399",
        }}
      />
      <div
        style={{
          fontFamily: PS2P,
          fontSize: 9,
          color: "#34d399",
          letterSpacing: 1,
        }}
      >
        ALL CLEAR
      </div>
      {timestamp && (
        <div
          style={{
            fontFamily: PS2P,
            fontSize: 6,
            color: "var(--hb-20)",
          }}
        >
          {timestamp}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function BriefingCard({
  token,
  onOpenApprovalQueue,
  onNavigate,
  inline = false,
}: Props) {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const fetchBriefing = useCallback(async () => {
    try {
      const res = await fetch("/api/briefing", {
        headers: authHeaders(token ?? ""),
      });
      if (res.status === 404) {
        setBriefing(null);
        setError(false);
        return;
      }
      if (res.ok) {
        setBriefing(await res.json());
        setError(false);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (inline) {
      fetchBriefing();
      return;
    }
    // Overlay mode — check if already dismissed today
    const dismissedDate = localStorage.getItem("homebase_briefing_dismissed");
    if (dismissedDate === new Date().toISOString().slice(0, 10)) {
      setDismissed(true);
      setLoading(false);
      return;
    }
    fetchBriefing();
  }, [fetchBriefing, inline]);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(
      "homebase_briefing_dismissed",
      new Date().toISOString().slice(0, 10)
    );
  };

  const timestamp = briefing?.generatedAt ? formatTimestamp(briefing.generatedAt) : "";

  // ── Inline (list view) ────────────────────────────────────────────

  if (inline) {
    if (loading) {
      return (
        <div className="bg-white/[0.04] border border-white/10 rounded-lg p-3">
          <p style={{ fontFamily: PS2P }} className="text-[8px] text-white/40 mb-2 tracking-wider">
            MORNING BRIEFING
          </p>
          <p className="text-[8px] text-white/30">Loading...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-white/[0.04] border border-red-500/20 rounded-lg p-3">
          <p style={{ fontFamily: PS2P }} className="text-[8px] text-white/40 mb-2 tracking-wider">
            MORNING BRIEFING
          </p>
          <p className="text-[8px] text-red-400/70">Could not load briefing</p>
        </div>
      );
    }

    if (!briefing) {
      return (
        <div className="bg-white/[0.04] border border-white/10 rounded-lg p-3">
          <p style={{ fontFamily: PS2P }} className="text-[8px] text-white/40 mb-2 tracking-wider">
            MORNING BRIEFING
          </p>
          <p className="text-[8px] text-white/30">No briefing yet today</p>
        </div>
      );
    }

    return (
      <div className="bg-white/[0.04] border border-white/10 rounded-lg p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div style={{ fontFamily: PS2P }} className="text-[8px] text-purple-400 tracking-wider">
            MORNING BRIEFING
          </div>
          {timestamp && (
            <div style={{ fontFamily: PS2P }} className="text-[6px] text-white/25">
              {timestamp}
            </div>
          )}
        </div>

        {/* All clear or item list */}
        {briefing.allClear ? (
          <AllClearState timestamp={timestamp} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {briefing.items.map((item, i) => (
              <ActionItem
                key={i}
                item={item}
                index={i}
                onNavigate={onNavigate}
                onOpenApprovalQueue={onOpenApprovalQueue}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Overlay (pixel view) ──────────────────────────────────────────

  if (dismissed || loading || !briefing) return null;

  // Don't show overlay if nothing needs attention
  const hasUrgent = briefing.items.some(
    (i) => i.priority === "urgent" || i.priority === "today"
  );
  if (!hasUrgent && briefing.allClear) return null;

  return (
    <>
      {/* Pulse keyframe injected once */}
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      <div
        style={{
          position: "fixed",
          top: 40,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 80,
          width: "calc(100% - 24px)",
          maxWidth: 440,
          background: "rgba(15,10,30,0.95)",
          border: "1px solid rgba(167,139,250,0.25)",
          borderRadius: 8,
          padding: 16,
          backdropFilter: "blur(12px)",
          boxShadow: "0 8px 32px var(--hb-panel-60)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontFamily: PS2P,
              fontSize: 9,
              color: "var(--hb-accent)",
              letterSpacing: 1,
            }}
          >
            MORNING BRIEFING
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {timestamp && (
              <span
                style={{
                  fontFamily: PS2P,
                  fontSize: 6,
                  color: "var(--hb-25)",
                }}
              >
                {timestamp}
              </span>
            )}
            <button
              onClick={handleDismiss}
              style={{
                fontFamily: PS2P,
                fontSize: 7,
                color: "var(--hb-35)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px 6px",
              }}
            >
              DISMISS
            </button>
          </div>
        </div>

        {/* All clear or item list */}
        {briefing.allClear ? (
          <AllClearState timestamp={timestamp} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {briefing.items.map((item, i) => (
              <ActionItem
                key={i}
                item={item}
                index={i}
                onNavigate={onNavigate}
                onOpenApprovalQueue={onOpenApprovalQueue}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
