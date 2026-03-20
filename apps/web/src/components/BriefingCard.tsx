"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

const PS2P = "'Press Start 2P', monospace";

interface Briefing {
  date: string;
  compiledAt: string | null;
  orbitBriefing: Record<string, unknown> | null;
  metrics: { dau: number; mau: number; mrr: number; dauDelta: number; mauDelta: number };
  overnightWork: { drafts_generated: number; editor_approved: number; pending_review: number } | null;
  content: {
    pendingReview: number;
    scheduledToday: number;
    failedPosts: number;
    postsByPlatform: Record<string, number>;
  };
  engagement: { unread: number };
  system: { authStatus: string; agentsOnline: number; lastPipelineRun: string } | null;
  alerts: string[];
  generatedAt: string;
}

interface Props {
  token: string;
  onOpenApprovalQueue?: () => void;
  inline?: boolean;
}

function relativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function isStale(isoDate: string): boolean {
  return Date.now() - new Date(isoDate).getTime() > 24 * 60 * 60 * 1000;
}

function DeltaArrow({ value }: { value: number }) {
  if (value === 0) return null;
  const isUp = value > 0;
  return (
    <span
      style={{
        fontSize: 7,
        fontFamily: PS2P,
        color: isUp ? "#4ade80" : "#f87171",
        marginLeft: 3,
      }}
    >
      {isUp ? "\u25b2" : "\u25bc"}
      {Math.abs(value)}
    </span>
  );
}

function SectionHeader({
  label,
  expanded,
  onToggle,
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontFamily: PS2P,
        fontSize: 7,
        color: "rgba(255,255,255,0.4)",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "4px 0",
        width: "100%",
        textAlign: "left",
        letterSpacing: 1,
      }}
    >
      <span style={{ fontSize: 6, transition: "transform 0.2s", transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}>
        {"\u25b6"}
      </span>
      {label}
    </button>
  );
}

export default function BriefingCard({ token, onOpenApprovalQueue, inline = false }: Props) {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Collapsible section state — expanded by default on first load of the day
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return { metrics: true, overnight: true, schedule: true, system: true };
    const lastExpanded = localStorage.getItem("homebase_briefing_expanded_date");
    const today = new Date().toISOString().slice(0, 10);
    const isFirstToday = lastExpanded !== today;
    if (isFirstToday) {
      localStorage.setItem("homebase_briefing_expanded_date", today);
    }
    return {
      metrics: isFirstToday,
      overnight: isFirstToday,
      schedule: isFirstToday,
      system: isFirstToday,
    };
  });

  const toggleSection = useCallback((key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const fetchBriefing = useCallback(async () => {
    try {
      const res = await fetch("/api/briefing", {
        headers: { Authorization: `Bearer ${token}` },
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
      // Inline mode (list view) — always fetch, no dismiss logic
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
    localStorage.setItem("homebase_briefing_dismissed", new Date().toISOString().slice(0, 10));
  };

  const stale = useMemo(() => {
    if (!briefing?.compiledAt) return false;
    return isStale(briefing.compiledAt);
  }, [briefing?.compiledAt]);

  // Inline mode — render as a card in list view
  if (inline) {
    if (loading) {
      return (
        <div className="bg-white/[0.04] border border-white/10 rounded-lg p-3">
          <p className="text-[8px] uppercase tracking-wider text-white/40 mb-2">
            Morning Briefing
          </p>
          <p className="text-[8px] text-white/30">Loading...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-white/[0.04] border border-red-500/20 rounded-lg p-3">
          <p className="text-[8px] uppercase tracking-wider text-white/40 mb-2">
            Morning Briefing
          </p>
          <p className="text-[8px] text-red-400/70">Could not load briefing</p>
        </div>
      );
    }

    if (!briefing) {
      return (
        <div className="bg-white/[0.04] border border-white/10 rounded-lg p-3">
          <p className="text-[8px] uppercase tracking-wider text-white/40 mb-2">
            Morning Briefing
          </p>
          <p className="text-[8px] text-white/30">No briefing yet today</p>
        </div>
      );
    }

    return (
      <div className={`bg-white/[0.04] border rounded-lg p-3 ${stale ? "border-amber-500/30" : "border-purple-500/20"}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <p className="text-[8px] uppercase tracking-wider text-purple-400">
              Morning Briefing
            </p>
            {stale && (
              <span className="text-[6px] text-amber-400 uppercase tracking-wider">Stale</span>
            )}
          </div>
          {briefing.compiledAt && (
            <span className="text-[7px] text-white/25">{relativeTime(briefing.compiledAt)}</span>
          )}
        </div>

        {/* Metrics */}
        <SectionHeader label="METRICS" expanded={expandedSections.metrics} onToggle={() => toggleSection("metrics")} />
        {expandedSections.metrics && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            <MetricBox label="DAU" value={briefing.metrics.dau} delta={briefing.metrics.dauDelta} />
            <MetricBox label="MAU" value={briefing.metrics.mau} delta={briefing.metrics.mauDelta} />
            <MetricBox label="MRR" value={`\u00a3${briefing.metrics.mrr}`} delta={0} />
          </div>
        )}

        {/* Overnight work */}
        {briefing.overnightWork && (
          <>
            <SectionHeader label="OVERNIGHT" expanded={expandedSections.overnight} onToggle={() => toggleSection("overnight")} />
            {expandedSections.overnight && (
              <div className="mb-3">
                <OvernightSummary work={briefing.overnightWork} onOpenApprovalQueue={onOpenApprovalQueue} />
              </div>
            )}
          </>
        )}

        {/* Today's schedule */}
        <SectionHeader label="TODAY" expanded={expandedSections.schedule} onToggle={() => toggleSection("schedule")} />
        {expandedSections.schedule && (
          <div className="mb-3">
            <ScheduleSummary content={briefing.content} />
          </div>
        )}

        {/* System status */}
        {briefing.system && (
          <>
            <SectionHeader label="SYSTEM" expanded={expandedSections.system} onToggle={() => toggleSection("system")} />
            {expandedSections.system && (
              <div className="mb-2">
                <SystemStatus system={briefing.system} />
              </div>
            )}
          </>
        )}

        {/* Alerts */}
        {briefing.alerts.length > 0 && (
          <div className="mt-2 pt-2 border-t border-white/5">
            {briefing.alerts.map((alert, i) => (
              <AlertLine key={i} alert={alert} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Overlay mode — floating card for pixel view
  if (dismissed || loading || !briefing) return null;

  // Don't show overlay if nothing interesting
  const hasAlerts = briefing.alerts.length > 0;
  const hasPending = briefing.content.pendingReview > 0;
  const hasOvernightWork = briefing.overnightWork && (
    briefing.overnightWork.drafts_generated > 0 ||
    briefing.overnightWork.editor_approved > 0 ||
    briefing.overnightWork.pending_review > 0
  );
  const hasContent = hasAlerts || hasPending || hasOvernightWork;
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
        border: stale ? "1px solid rgba(251,191,36,0.3)" : "1px solid rgba(167,139,250,0.3)",
        borderRadius: 8,
        padding: 16,
        backdropFilter: "blur(12px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontFamily: PS2P, fontSize: 9, color: "#a78bfa", letterSpacing: 1 }}>
            MORNING BRIEFING
          </div>
          {stale && (
            <span style={{ fontFamily: PS2P, fontSize: 6, color: "#fbbf24", letterSpacing: 1 }}>STALE</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {briefing.compiledAt && (
            <span style={{ fontFamily: PS2P, fontSize: 6, color: "rgba(255,255,255,0.25)" }}>
              {relativeTime(briefing.compiledAt)}
            </span>
          )}
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
      </div>

      {/* Metrics row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <MetricPill label="DAU" value={briefing.metrics.dau} delta={briefing.metrics.dauDelta} />
        <MetricPill label="MAU" value={briefing.metrics.mau} delta={briefing.metrics.mauDelta} />
        <MetricPill label="MRR" value={`\u00a3${briefing.metrics.mrr}`} delta={0} />
      </div>

      {/* Overnight work */}
      {briefing.overnightWork && hasOvernightWork && (
        <div style={{ marginBottom: 12 }}>
          <OvernightSummary work={briefing.overnightWork} onOpenApprovalQueue={onOpenApprovalQueue} overlay />
        </div>
      )}

      {/* Alerts */}
      {briefing.alerts.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {briefing.alerts.map((alert, i) => (
            <AlertLine key={i} alert={alert} />
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

      {/* Platform breakdown */}
      {Object.keys(briefing.content.postsByPlatform).length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {Object.entries(briefing.content.postsByPlatform).map(([platform, count]) => (
            <span
              key={platform}
              style={{
                fontFamily: PS2P,
                fontSize: 6,
                color: "rgba(255,255,255,0.5)",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 3,
                padding: "3px 6px",
              }}
            >
              {platform} {count}
            </span>
          ))}
        </div>
      )}

      {/* System status */}
      {briefing.system && (
        <SystemStatus system={briefing.system} overlay />
      )}

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

/* ── Sub-components ──────────────────────────────────────────────── */

function MetricPill({ label, value, delta }: { label: string; value: string | number; delta: number }) {
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
      <div style={{ fontFamily: PS2P, fontSize: 13, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {value}
        <DeltaArrow value={delta} />
      </div>
    </div>
  );
}

function MetricBox({ label, value, delta }: { label: string; value: string | number; delta: number }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded p-2 text-center">
      <p className="text-[6px] text-white/35 mb-1" style={{ fontFamily: PS2P }}>{label}</p>
      <div className="flex items-center justify-center">
        <p className="text-sm text-white" style={{ fontFamily: PS2P }}>{value}</p>
        <DeltaArrow value={delta} />
      </div>
    </div>
  );
}

function OvernightSummary({
  work,
  onOpenApprovalQueue,
  overlay = false,
}: {
  work: { drafts_generated: number; editor_approved: number; pending_review: number };
  onOpenApprovalQueue?: () => void;
  overlay?: boolean;
}) {
  const items = [
    { label: "Drafts generated", value: work.drafts_generated },
    { label: "Editor approved", value: work.editor_approved },
    { label: "Pending review", value: work.pending_review, action: work.pending_review > 0 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: overlay ? "system-ui, -apple-system, sans-serif" : undefined,
            fontSize: overlay ? 12 : 11,
            color: "rgba(255,255,255,0.6)",
          }}
          className={overlay ? undefined : "text-[11px] text-white/60"}
        >
          <span>{item.label}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: item.value > 0 ? "#fff" : "rgba(255,255,255,0.3)", fontFamily: PS2P, fontSize: overlay ? 11 : 10 }}>
              {item.value}
            </span>
            {item.action && onOpenApprovalQueue && (
              <button
                onClick={onOpenApprovalQueue}
                style={{
                  fontFamily: PS2P,
                  fontSize: 6,
                  color: "#facc15",
                  background: "rgba(250,204,21,0.1)",
                  border: "1px solid rgba(250,204,21,0.2)",
                  borderRadius: 3,
                  padding: "2px 5px",
                  cursor: "pointer",
                }}
              >
                REVIEW
              </button>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

function ScheduleSummary({ content }: { content: Briefing["content"] }) {
  const platforms = Object.entries(content.postsByPlatform);

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-white text-sm" style={{ fontFamily: PS2P }}>{content.scheduledToday}</span>
        <span className="text-[8px] text-white/50">posts scheduled</span>
      </div>
      {platforms.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {platforms.map(([platform, count]) => (
            <span
              key={platform}
              className="text-[7px] text-white/40 bg-white/[0.03] border border-white/[0.06] rounded px-1.5 py-0.5"
            >
              {platform} {count}
            </span>
          ))}
        </div>
      )}
      {content.failedPosts > 0 && (
        <p className="text-[8px] text-red-400 mt-1">{content.failedPosts} failed</p>
      )}
    </div>
  );
}

function SystemStatus({ system, overlay = false }: { system: NonNullable<Briefing["system"]>; overlay?: boolean }) {
  const authOk = system.authStatus === "ok";

  if (overlay) {
    return (
      <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              background: authOk ? "#4ade80" : "#f87171",
            }}
          />
          <span style={{ fontFamily: PS2P, fontSize: 7, color: "rgba(255,255,255,0.4)" }}>
            Auth {system.authStatus}
          </span>
        </div>
        <span style={{ fontFamily: PS2P, fontSize: 7, color: "rgba(255,255,255,0.4)" }}>
          {system.agentsOnline} agent{system.agentsOnline !== 1 ? "s" : ""} online
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${authOk ? "bg-green-500" : "bg-red-500 animate-pulse"}`} />
        <span className="text-[7px] text-white/40">Auth {system.authStatus}</span>
      </div>
      <span className="text-[7px] text-white/40">
        {system.agentsOnline} agent{system.agentsOnline !== 1 ? "s" : ""} online
      </span>
    </div>
  );
}

function AlertLine({ alert }: { alert: string }) {
  const isError = alert.includes("failed") || alert.includes("No content");
  const isWarning = alert.includes("approval") || alert.includes("waiting");

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: 12,
        lineHeight: 1.6,
        color: isError ? "#f87171" : isWarning ? "#facc15" : "rgba(255,255,255,0.7)",
        paddingLeft: 12,
        position: "relative",
      }}
    >
      <span
        style={{
          position: "absolute",
          left: 0,
          color: isError ? "#f87171" : "#facc15",
        }}
      >
        &bull;
      </span>
      {alert}
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
