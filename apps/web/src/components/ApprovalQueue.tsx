"use client";

import { authHeaders } from "@/lib/client-auth";
import { useState, useEffect, useCallback } from "react";

const PS2P = "'Press Start 2P', monospace";

interface ApprovalItem {
  id: string;
  content: string;
  platform: string;
  accountName: string;
  createdAt: string;
  source: "spellcast" | "orbit";
  threadSlides?: string[];
}

const PLATFORM_ICONS: Record<string, string> = {
  instagram: "IG",
  threads: "TH",
  twitter: "X",
  x: "X",
  tiktok: "TT",
  linkedin: "LI",
  facebook: "FB",
  reddit: "RD",
  bluesky: "BS",
  unknown: "??",
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E1306C",
  threads: "#fff",
  twitter: "#1DA1F2",
  x: "#fff",
  tiktok: "#00f2ea",
  linkedin: "#0A66C2",
  facebook: "#1877F2",
  reddit: "#FF4500",
  bluesky: "#0085ff",
  unknown: "#71717a",
};

const REJECT_PRESETS = ["off-brand", "wrong tone", "bad timing", "duplicate"];

type ActionState = "idle" | "confirming-approve" | "confirming-reject" | "loading" | "done" | "error";

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatScheduleTime(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  // Show ET equivalent
  const et = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/New_York" });
  return `${day} ${time} UTC (${et} ET)`;
}

function ApprovalCard({ item, token, onComplete }: { item: ApprovalItem; token: string; onComplete: () => void }) {
  const [state, setState] = useState<ActionState>("idle");
  const [scheduledDate, setScheduledDate] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);

  const platformColor = PLATFORM_COLORS[item.platform] ?? PLATFORM_COLORS.unknown;
  const platformIcon = PLATFORM_ICONS[item.platform] ?? PLATFORM_ICONS.unknown;

  const handleApproveClick = async () => {
    if (state === "confirming-approve") {
      // Actually approve
      setState("loading");
      setError("");
      try {
        const res = await fetch(`/api/approval-queue/${item.id}/approve`, {
          method: "POST",
          headers: { ...authHeaders(token), "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Approve failed");
          setState("error");
          return;
        }
        setScheduledDate(data.scheduledDate);
        setState("done");
        setTimeout(onComplete, 2000);
      } catch {
        setError("Network error");
        setState("error");
      }
      return;
    }

    // First click: fetch the proposed schedule time
    setState("loading");
    try {
      // Preview what time it would be scheduled for
      const res = await fetch(`/api/approval-queue/${item.id}/approve`, {
        method: "POST",
        headers: { ...authHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to get schedule");
        setState("error");
        return;
      }
      setScheduledDate(data.scheduledDate);
      setState("done");
      setTimeout(onComplete, 2000);
    } catch {
      setError("Network error");
      setState("error");
    }
  };

  const handleRejectClick = () => {
    if (state === "confirming-reject") return;
    setState("confirming-reject");
  };

  const handleRejectConfirm = async () => {
    setState("loading");
    setError("");
    try {
      const res = await fetch(`/api/approval-queue/${item.id}/reject`, {
        method: "POST",
        headers: { ...authHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Reject failed");
        setState("error");
        return;
      }
      setState("done");
      setTimeout(onComplete, 1500);
    } catch {
      setError("Network error");
      setState("error");
    }
  };

  const handleCancel = () => {
    setState("idle");
    setRejectReason("");
    setError("");
  };

  if (state === "done") {
    return (
      <div style={{
        padding: "16px",
        background: scheduledDate ? "rgba(74,222,128,0.08)" : "rgba(239,68,68,0.08)",
        border: `1px solid ${scheduledDate ? "rgba(74,222,128,0.2)" : "rgba(239,68,68,0.2)"}`,
        borderRadius: 6,
        textAlign: "center",
      }}>
        <div style={{ fontFamily: PS2P, fontSize: 9, color: scheduledDate ? "#4ade80" : "#f87171" }}>
          {scheduledDate ? "APPROVED" : "REJECTED"}
        </div>
        {scheduledDate && (
          <div style={{ fontFamily: PS2P, fontSize: 7, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>
            {formatScheduleTime(scheduledDate)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      padding: "14px 16px",
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 6,
      borderLeft: `3px solid ${platformColor}`,
    }}>
      {/* Header: platform + account + time */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{
          fontFamily: PS2P,
          fontSize: 8,
          color: platformColor,
          background: `${platformColor}15`,
          padding: "3px 6px",
          borderRadius: 3,
          letterSpacing: 1,
        }}>
          {platformIcon}
        </span>
        {item.accountName && (
          <span style={{ fontFamily: PS2P, fontSize: 7, color: "rgba(255,255,255,0.4)" }}>
            {item.accountName}
          </span>
        )}
        {item.source === "orbit" && (
          <span style={{
            fontFamily: PS2P,
            fontSize: 6,
            color: "#f59e0b",
            background: "rgba(245,158,11,0.1)",
            padding: "2px 5px",
            borderRadius: 3,
          }}>
            ORBIT
          </span>
        )}
        <span style={{ fontFamily: PS2P, fontSize: 6, color: "rgba(255,255,255,0.25)", marginLeft: "auto" }}>
          {formatRelativeTime(item.createdAt)}
        </span>
      </div>

      {/* Content preview */}
      <div style={{
        fontFamily: PS2P,
        fontSize: 8,
        color: "rgba(255,255,255,0.65)",
        lineHeight: 1.5,
        marginBottom: 14,
        wordBreak: "break-word",
      }}>
        {item.content.length > 280 && !expanded
          ? (
            <>
              {item.content.slice(0, 280)}...
              <button
                onClick={() => setExpanded(true)}
                style={{ fontFamily: PS2P, fontSize: 6, color: "rgba(255,255,255,0.3)", cursor: "pointer", background: "none", border: "none", marginLeft: 4 }}
              >
                [expand]
              </button>
            </>
          )
          : (
            <>
              {item.content}
              {item.content.length > 280 && (
                <button
                  onClick={() => setExpanded(false)}
                  style={{ fontFamily: PS2P, fontSize: 6, color: "rgba(255,255,255,0.3)", cursor: "pointer", background: "none", border: "none", marginLeft: 4 }}
                >
                  [collapse]
                </button>
              )}
            </>
          )
        }
      </div>

      {/* Thread slides indicator */}
      {item.threadSlides && item.threadSlides.length > 0 && (
        <div style={{ fontFamily: PS2P, fontSize: 6, color: "rgba(255,255,255,0.3)", marginTop: 4, marginBottom: 10 }}>
          +{item.threadSlides.length} thread slides
        </div>
      )}

      {/* Error display */}
      {error && (
        <div style={{
          fontFamily: PS2P,
          fontSize: 7,
          color: "#f87171",
          background: "rgba(239,68,68,0.1)",
          padding: "6px 8px",
          borderRadius: 4,
          marginBottom: 10,
        }}>
          {error}
        </div>
      )}

      {/* Reject reason input */}
      {state === "confirming-reject" && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
            {REJECT_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => setRejectReason(preset)}
                style={{
                  fontFamily: PS2P,
                  fontSize: 6,
                  padding: "5px 8px",
                  background: rejectReason === preset ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${rejectReason === preset ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 3,
                  color: rejectReason === preset ? "#f87171" : "rgba(255,255,255,0.5)",
                  cursor: "pointer",
                }}
              >
                {preset}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Custom reason (optional)"
            style={{
              width: "100%",
              fontFamily: PS2P,
              fontSize: 7,
              padding: "8px 10px",
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 4,
              color: "#fff",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8 }}>
        {state === "confirming-reject" ? (
          <>
            <button
              onClick={handleRejectConfirm}
              disabled={state === ("loading" as ActionState)}
              style={{
                flex: 1,
                fontFamily: PS2P,
                fontSize: 8,
                padding: "12px",
                background: "rgba(239,68,68,0.15)",
                border: "1px solid rgba(239,68,68,0.4)",
                borderRadius: 4,
                color: "#f87171",
                cursor: "pointer",
                minHeight: 44,
              }}
            >
              CONFIRM REJECT
            </button>
            <button
              onClick={handleCancel}
              style={{
                fontFamily: PS2P,
                fontSize: 8,
                padding: "12px 16px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 4,
                color: "rgba(255,255,255,0.5)",
                cursor: "pointer",
                minHeight: 44,
              }}
            >
              CANCEL
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleApproveClick}
              disabled={state === "loading"}
              style={{
                flex: 1,
                fontFamily: PS2P,
                fontSize: 8,
                padding: "12px",
                background: state === "loading" ? "rgba(74,222,128,0.05)" : "rgba(74,222,128,0.12)",
                border: "1px solid rgba(74,222,128,0.3)",
                borderRadius: 4,
                color: state === "loading" ? "rgba(74,222,128,0.5)" : "#4ade80",
                cursor: state === "loading" ? "wait" : "pointer",
                minHeight: 44,
              }}
            >
              {state === "loading" ? "SCHEDULING..." : "APPROVE"}
            </button>
            <button
              onClick={handleRejectClick}
              disabled={state === "loading"}
              style={{
                flex: 1,
                fontFamily: PS2P,
                fontSize: 8,
                padding: "12px",
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 4,
                color: "#f87171",
                cursor: state === "loading" ? "wait" : "pointer",
                minHeight: 44,
              }}
            >
              REJECT
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface Props {
  token?: string;
  /** Compact mode for embedding in list view */
  compact?: boolean;
}

type ApproveAllState = "idle" | "confirming" | "running" | "done";
type AutoApproveState = "idle" | "running" | "done";

export default function ApprovalQueue({ token: tokenProp, compact }: Props) {
  const token = tokenProp ?? (typeof window !== "undefined" ? localStorage.getItem("homebase_token") ?? "" : "");
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [autoApprovedCount, setAutoApprovedCount] = useState(0);
  const [approveAllState, setApproveAllState] = useState<ApproveAllState>("idle");
  const [approveAllProgress, setApproveAllProgress] = useState<{ current: number; total: number } | null>(null);
  const [approveAllSummary, setApproveAllSummary] = useState<string | null>(null);
  const [autoApproveState, setAutoApproveState] = useState<AutoApproveState>("idle");
  const [autoApproveSummary, setAutoApproveSummary] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/approval-queue", {
        headers: authHeaders(token ?? ""),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setItems(data.items ?? []);
      setAutoApprovedCount(data.autoApproved ?? 0);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchQueue();
    // Poll every 2 minutes
    const id = setInterval(fetchQueue, 120_000);
    return () => clearInterval(id);
  }, [fetchQueue]);

  const handleComplete = () => {
    // Refresh the queue after an action
    setTimeout(fetchQueue, 500);
  };

  const handleApproveAllClick = () => {
    if (approveAllState === "confirming") {
      // Cancel
      setApproveAllState("idle");
      return;
    }
    setApproveAllState("confirming");
  };

  const handleApproveAllConfirm = async () => {
    const snapshot = [...items];
    const total = snapshot.length;
    setApproveAllState("running");
    setApproveAllProgress({ current: 0, total });
    setApproveAllSummary(null);

    let approved = 0;
    for (let i = 0; i < snapshot.length; i++) {
      setApproveAllProgress({ current: i + 1, total });
      try {
        const res = await fetch(`/api/approval-queue/${snapshot[i].id}/approve`, {
          method: "POST",
          headers: { ...authHeaders(token), "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (res.ok) approved++;
      } catch {
        // Continue even if one fails
      }
    }

    setApproveAllState("done");
    setApproveAllSummary(`APPROVED ${approved}/${total}`);
    setTimeout(() => {
      setApproveAllState("idle");
      setApproveAllProgress(null);
      setApproveAllSummary(null);
      fetchQueue();
    }, 2000);
  };

  const handleAutoApprove = async () => {
    setAutoApproveState("running");
    setAutoApproveSummary(null);
    try {
      const res = await fetch("/api/approval-queue/auto-approve", {
        method: "POST",
        headers: { ...authHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ threshold: 80 }),
      });
      const data = await res.json();
      if (res.ok) {
        setAutoApproveSummary(`APPROVED ${data.approved} POSTS`);
      } else {
        setAutoApproveSummary("AUTO-APPROVE FAILED");
      }
    } catch {
      setAutoApproveSummary("NETWORK ERROR");
    }
    setAutoApproveState("done");
    setTimeout(() => {
      setAutoApproveState("idle");
      setAutoApproveSummary(null);
      fetchQueue();
    }, 2500);
  };

  // Badge count for external use
  const count = items.length;

  if (compact) {
    return (
      <div className="bg-white/[0.04] border border-white/10 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[8px] md:text-xs uppercase tracking-wider text-white/40">
            Approval Queue
          </p>
          {count > 0 && (
            <span className="text-[8px] md:text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded px-1.5 py-0.5">
              {count}
            </span>
          )}
        </div>
        {loading ? (
          <div className="text-[8px] md:text-xs text-white/30 animate-pulse">Loading...</div>
        ) : error ? (
          <div className="text-[8px] md:text-xs text-red-400">Error: {error}</div>
        ) : count === 0 ? (
          <div className="text-[8px] md:text-xs text-white/30">Nothing to review</div>
        ) : (
          <div className="space-y-2">
            {items.slice(0, 3).map((item) => (
              <ApprovalCard key={item.id} item={item} token={token} onComplete={handleComplete} />
            ))}
            {count > 3 && (
              <div className="text-[7px] md:text-[11px] text-white/25 text-center">
                +{count - 3} more
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Full view (for Orbit HQ room)
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {loading && (
        <div style={{ fontFamily: PS2P, fontSize: 9, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: 20 }}>
          Loading queue...
        </div>
      )}

      {error && (
        <div style={{
          fontFamily: PS2P, fontSize: 8, color: "#f87171",
          textAlign: "center", padding: 16,
          background: "rgba(239,68,68,0.08)", borderRadius: 4,
        }}>
          Failed to load: {error}
        </div>
      )}

      {!loading && !error && count === 0 && (
        <div style={{ textAlign: "center", padding: 24 }}>
          <div style={{ fontFamily: PS2P, fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>
            Nothing to review
          </div>
          <div style={{ fontFamily: PS2P, fontSize: 7, color: "rgba(255,255,255,0.25)" }}>
            Your agents are working on it
          </div>
        </div>
      )}

      {/* Auto-approved notice */}
      {!loading && !error && autoApprovedCount > 0 && (
        <div style={{
          fontFamily: PS2P,
          fontSize: 7,
          color: "#4ade80",
          padding: "6px 10px",
          background: "rgba(74,222,128,0.06)",
          border: "1px solid rgba(74,222,128,0.15)",
          borderRadius: 4,
        }}>
          ✓ {autoApprovedCount} post{autoApprovedCount === 1 ? "" : "s"} auto-approved
        </div>
      )}

      {/* Approve All button — shown when 2+ items and not loading */}
      {!loading && !error && count >= 2 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {approveAllState === "done" ? (
            <div style={{
              flex: 1,
              fontFamily: PS2P,
              fontSize: 9,
              color: "#4ade80",
              background: "rgba(74,222,128,0.08)",
              border: "1px solid rgba(74,222,128,0.2)",
              borderRadius: 4,
              padding: "14px",
              textAlign: "center",
            }}>
              {approveAllSummary}
            </div>
          ) : approveAllState === "running" ? (
            <div style={{
              flex: 1,
              fontFamily: PS2P,
              fontSize: 9,
              color: "rgba(74,222,128,0.5)",
              background: "rgba(74,222,128,0.05)",
              border: "1px solid rgba(74,222,128,0.3)",
              borderRadius: 4,
              padding: "14px",
              textAlign: "center",
            }}>
              {approveAllProgress
                ? `APPROVING ${approveAllProgress.current}/${approveAllProgress.total}...`
                : "APPROVING..."}
            </div>
          ) : approveAllState === "confirming" ? (
            <>
              <button
                onClick={handleApproveAllConfirm}
                style={{
                  flex: 1,
                  fontFamily: PS2P,
                  fontSize: 9,
                  padding: "14px",
                  background: "rgba(74,222,128,0.18)",
                  border: "1px solid rgba(74,222,128,0.45)",
                  borderRadius: 4,
                  color: "#4ade80",
                  cursor: "pointer",
                  minHeight: 48,
                }}
              >
                APPROVE ALL ({count})?
              </button>
              <button
                onClick={handleApproveAllClick}
                style={{
                  fontFamily: PS2P,
                  fontSize: 8,
                  padding: "14px 16px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 4,
                  color: "rgba(255,255,255,0.5)",
                  cursor: "pointer",
                  minHeight: 48,
                }}
              >
                CANCEL
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleApproveAllClick}
                style={{
                  flex: 1,
                  fontFamily: PS2P,
                  fontSize: 9,
                  padding: "14px",
                  background: "rgba(74,222,128,0.12)",
                  border: "1px solid rgba(74,222,128,0.3)",
                  borderRadius: 4,
                  color: "#4ade80",
                  cursor: "pointer",
                  minHeight: 48,
                }}
              >
                APPROVE ALL ({count})
              </button>
              {autoApproveState === "done" ? (
                <div style={{
                  fontFamily: PS2P,
                  fontSize: 7,
                  color: "#4ade80",
                  background: "rgba(74,222,128,0.08)",
                  border: "1px solid rgba(74,222,128,0.2)",
                  borderRadius: 4,
                  padding: "14px 12px",
                  textAlign: "center",
                  whiteSpace: "nowrap",
                }}>
                  {autoApproveSummary}
                </div>
              ) : (
                <button
                  onClick={handleAutoApprove}
                  disabled={autoApproveState === "running"}
                  style={{
                    fontFamily: PS2P,
                    fontSize: 8,
                    padding: "14px 12px",
                    background: autoApproveState === "running"
                      ? "rgba(96,165,250,0.05)"
                      : "rgba(96,165,250,0.1)",
                    border: "1px solid rgba(96,165,250,0.3)",
                    borderRadius: 4,
                    color: autoApproveState === "running"
                      ? "rgba(96,165,250,0.4)"
                      : "#60a5fa",
                    cursor: autoApproveState === "running" ? "wait" : "pointer",
                    minHeight: 48,
                    whiteSpace: "nowrap",
                  }}
                >
                  {autoApproveState === "running" ? "..." : "AUTO \u226580"}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {items.map((item) => (
        <ApprovalCard key={item.id} item={item} token={token} onComplete={handleComplete} />
      ))}
    </div>
  );
}

/** Utility hook to get the pending count for badge display */
export function useApprovalCount(token: string | null): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!token) return;

    const fetchCount = async () => {
      try {
        const res = await fetch("/api/approval-queue", {
          headers: authHeaders(token ?? ""),
        });
        if (res.ok) {
          const data = await res.json();
          setCount(data.count ?? 0);
        }
      } catch {
        // Silently fail
      }
    };

    fetchCount();
    const id = setInterval(fetchCount, 120_000);
    return () => clearInterval(id);
  }, [token]);

  return count;
}
