"use client";

import { authHeaders } from "@/lib/client-auth";
import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from "react";

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

export interface ApprovalCardHandle {
  triggerApprove: () => void;
  triggerReject: () => void;
}

interface ApprovalCardProps {
  item: ApprovalItem;
  token: string;
  onComplete: () => void;
  onDismiss?: (id: string) => void;
  isSelected?: boolean;
}

const ApprovalCard = forwardRef<ApprovalCardHandle, ApprovalCardProps>(function ApprovalCard(
  { item, token, onComplete, onDismiss, isSelected },
  ref
) {
  const [state, setState] = useState<ActionState>("idle");
  const [scheduledDate, setScheduledDate] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);

  // Swipe gesture state
  const touchStartXRef = useRef<number | null>(null);
  const [swipeDelta, setSwipeDelta] = useState(0);
  const [isSnapping, setIsSnapping] = useState(false);

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

  // Swipe gesture helpers
  const snapBack = () => {
    setIsSnapping(true);
    setSwipeDelta(0);
    setTimeout(() => setIsSnapping(false), 200);
  };

  const triggerSwipeApprove = async () => {
    snapBack();
    // Small delay so the snap-back animation plays before the card disappears
    await new Promise((r) => setTimeout(r, 150));
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
  };

  const triggerSwipeReject = async () => {
    snapBack();
    await new Promise((r) => setTimeout(r, 150));
    setState("loading");
    setError("");
    try {
      const res = await fetch(`/api/approval-queue/${item.id}/reject`, {
        method: "POST",
        headers: { ...authHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({}),
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

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (state !== "idle" && state !== "error") return;
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartXRef.current === null) return;
    const delta = e.touches[0].clientX - touchStartXRef.current;
    // Clamp to ±120px
    const clamped = Math.max(-120, Math.min(120, delta));
    setSwipeDelta(clamped);
  };

  const handleTouchEnd = () => {
    if (touchStartXRef.current === null) return;
    touchStartXRef.current = null;

    if (swipeDelta > 60) {
      void triggerSwipeApprove();
    } else if (swipeDelta < -60) {
      void triggerSwipeReject();
    } else {
      snapBack();
    }
  };

  const handleDismissOrbit = async () => {
    setState("loading");
    setError("");
    try {
      await fetch(`/api/approval-queue/${item.id}/dismiss-orbit`, {
        method: "POST",
        headers: authHeaders(token),
      });
    } catch {
      // Best effort — optimistic removal regardless
    }
    onDismiss?.(item.id);
  };

  // Expose imperative approve/reject for keyboard shortcut use
  useImperativeHandle(ref, () => ({
    triggerApprove: () => {
      if (state === "idle" || state === "error") {
        void handleApproveClick();
      }
    },
    triggerReject: () => {
      if (state === "idle" || state === "error") {
        void triggerSwipeReject();
      }
    },
  }));

  if (state === "done") {
    return (
      <div style={{
        padding: "16px",
        background: scheduledDate ? "rgba(133,173,146,0.08)" : "rgba(232,74,125,0.08)",
        border: `1px solid ${scheduledDate ? "rgba(133,173,146,0.2)" : "rgba(232,74,125,0.2)"}`,
        borderRadius: 6,
        textAlign: "center",
      }}>
        <div style={{ fontFamily: PS2P, fontSize: 9, color: scheduledDate ? "var(--hb-success)" : "var(--hb-error-soft)" }}>
          {scheduledDate ? "APPROVED" : "REJECTED"}
        </div>
        {scheduledDate && (
          <div style={{ fontFamily: PS2P, fontSize: 7, color: "var(--hb-60)", marginTop: 6 }}>
            {formatScheduleTime(scheduledDate)}
          </div>
        )}
      </div>
    );
  }

  // Swipe overlay visibility
  const showApproveOverlay = swipeDelta > 30;
  const showRejectOverlay = swipeDelta < -30;

  // Selection highlight: override left border when selected
  const borderLeftStyle = isSelected
    ? "3px solid rgba(167,139,250,0.6)"
    : `3px solid ${platformColor}`;
  const backgroundStyle = isSelected
    ? "rgba(167,139,250,0.07)"
    : "var(--hb-03)";

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        position: "relative",
        padding: "16px 16px",
        background: backgroundStyle,
        border: "1px solid var(--hb-10)",
        borderRadius: 6,
        borderLeft: borderLeftStyle,
        transform: `translateX(${swipeDelta}px)`,
        transition: isSnapping ? "transform 0.2s ease-out" : "none",
        touchAction: "pan-y",
        userSelect: "none",
        overflow: "hidden",
      }}
    >
      {/* Swipe-right approve overlay */}
      {showApproveOverlay && (
        <div style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: `${Math.min(swipeDelta * 1.5, 80)}px`,
          background: `rgba(133,173,146,${Math.min((swipeDelta - 30) / 90, 0.35)})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingRight: 12,
          borderRadius: "0 6px 6px 0",
          pointerEvents: "none",
          zIndex: 1,
        }}>
          <span style={{
            fontFamily: PS2P,
            fontSize: 14,
            color: "var(--hb-success)",
            opacity: Math.min((swipeDelta - 30) / 60, 1),
          }}>✓</span>
        </div>
      )}
      {/* Swipe-left reject overlay */}
      {showRejectOverlay && (
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: `${Math.min(-swipeDelta * 1.5, 80)}px`,
          background: `rgba(232,74,125,${Math.min((-swipeDelta - 30) / 90, 0.35)})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          paddingLeft: 12,
          borderRadius: "6px 0 0 6px",
          pointerEvents: "none",
          zIndex: 1,
        }}>
          <span style={{
            fontFamily: PS2P,
            fontSize: 14,
            color: "var(--hb-error-soft)",
            opacity: Math.min((-swipeDelta - 30) / 60, 1),
          }}>✗</span>
        </div>
      )}
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
          <span style={{ fontFamily: PS2P, fontSize: 7, color: "var(--hb-60)" }}>
            {item.accountName}
          </span>
        )}
        {item.source === "orbit" && (
          <span style={{
            fontFamily: PS2P,
            fontSize: 6,
            color: "var(--hb-warn)",
            background: "rgba(217,141,237,0.1)",
            padding: "2px 5px",
            borderRadius: 3,
          }}>
            ORBIT
          </span>
        )}
        <span style={{ fontFamily: PS2P, fontSize: 6, color: "var(--hb-60)", marginLeft: "auto" }}>
          {formatRelativeTime(item.createdAt)}
        </span>
        {item.source === "orbit" && onDismiss && (
          <button
            onClick={handleDismissOrbit}
            disabled={state === "loading"}
            title="Dismiss this Orbit draft"
            style={{
              fontFamily: PS2P,
              fontSize: 9,
              lineHeight: 1,
              padding: "2px 6px",
              background: "transparent",
              border: "1px solid var(--hb-12)",
              borderRadius: 3,
              color: "var(--hb-60)",
              cursor: state === "loading" ? "wait" : "pointer",
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Content preview */}
      <div style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: 14,
        color: "var(--hb-80)",
        lineHeight: 1.6,
        marginBottom: 14,
        wordBreak: "break-word",
      }}>
        {item.content.length > 280 && !expanded
          ? (
            <>
              {item.content.slice(0, 280)}...
              <button
                onClick={() => setExpanded(true)}
                style={{ fontFamily: PS2P, fontSize: 6, color: "var(--hb-60)", cursor: "pointer", background: "none", border: "none", marginLeft: 4 }}
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
                  style={{ fontFamily: PS2P, fontSize: 6, color: "var(--hb-60)", cursor: "pointer", background: "none", border: "none", marginLeft: 4 }}
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
        <div style={{ fontFamily: "system-ui, -apple-system, sans-serif", fontSize: 12, color: "var(--hb-60)", marginTop: 4, marginBottom: 10 }}>
          +{item.threadSlides.length} thread slides
        </div>
      )}

      {/* Error display */}
      {error && (
        <div style={{
          fontFamily: PS2P,
          fontSize: 7,
          color: "var(--hb-error-soft)",
          background: "rgba(232,74,125,0.1)",
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
                  background: rejectReason === preset ? "rgba(232,74,125,0.2)" : "var(--hb-05)",
                  border: `1px solid ${rejectReason === preset ? "rgba(232,74,125,0.4)" : "var(--hb-10)"}`,
                  borderRadius: 3,
                  color: rejectReason === preset ? "var(--hb-error-soft)" : "var(--hb-60)",
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
              background: "var(--hb-panel-30)",
              border: "1px solid var(--hb-10)",
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
                background: "rgba(232,74,125,0.15)",
                border: "1px solid rgba(232,74,125,0.4)",
                borderRadius: 4,
                color: "var(--hb-error-soft)",
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
                background: "var(--hb-05)",
                border: "1px solid var(--hb-10)",
                borderRadius: 4,
                color: "var(--hb-60)",
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
                background: state === "loading" ? "rgba(133,173,146,0.05)" : "rgba(133,173,146,0.12)",
                border: "1px solid rgba(133,173,146,0.3)",
                borderRadius: 4,
                color: state === "loading" ? "rgba(133,173,146,0.5)" : "var(--hb-success)",
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
                background: "rgba(232,74,125,0.08)",
                border: "1px solid rgba(232,74,125,0.2)",
                borderRadius: 4,
                color: "var(--hb-error-soft)",
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
});

interface Props {
  token?: string;
  /** Compact mode for embedding in list view */
  compact?: boolean;
}

type ApproveAllState = "idle" | "confirming" | "running" | "done";
type AutoApproveState = "idle" | "running" | "done";

type ClearOrbitState = "idle" | "running" | "done";

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
  const [clearOrbitState, setClearOrbitState] = useState<ClearOrbitState>("idle");

  // Keyboard navigation state
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isHoverDevice, setIsHoverDevice] = useState(false);
  const cardRefs = useRef<(ApprovalCardHandle | null)[]>([]);

  // Detect hover-capable device once on mount
  useEffect(() => {
    setIsHoverDevice(window.matchMedia("(hover: hover)").matches);
  }, []);

  // Initialise selectedIndex to 0 when items first load
  useEffect(() => {
    if (items.length > 0 && selectedIndex === null) {
      setSelectedIndex(0);
    } else if (items.length === 0) {
      setSelectedIndex(null);
    }
  }, [items.length]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Keyboard shortcut handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip when focus is on a text input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const count = items.length;
      if (count === 0) return;

      const current = selectedIndex ?? 0;

      switch (e.key) {
        case "ArrowDown":
        case "j":
        case "J":
          e.preventDefault();
          setSelectedIndex(Math.min(current + 1, count - 1));
          break;
        case "ArrowUp":
        case "k":
        case "K":
          e.preventDefault();
          setSelectedIndex(Math.max(current - 1, 0));
          break;
        case "Escape":
          setSelectedIndex(null);
          break;
        case "ArrowRight":
        case "a":
        case "A": {
          e.preventDefault();
          const cardRef = cardRefs.current[current];
          if (cardRef) {
            cardRef.triggerApprove();
            // Auto-advance: move to next post after action, or stay at last
            const next = current < count - 1 ? current + 1 : count - 1;
            setTimeout(() => setSelectedIndex(next), 300);
          }
          break;
        }
        case "ArrowLeft":
        case "r":
        case "R": {
          e.preventDefault();
          const cardRef = cardRefs.current[current];
          if (cardRef) {
            cardRef.triggerReject();
            const next = current < count - 1 ? current + 1 : count - 1;
            setTimeout(() => setSelectedIndex(next), 300);
          }
          break;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [items.length, selectedIndex]);

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

  const handleDismissOrbitItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearOrbitDrafts = async () => {
    const orbitItems = items.filter((item) => item.source === "orbit");
    if (orbitItems.length === 0) return;
    setClearOrbitState("running");
    await Promise.allSettled(
      orbitItems.map((item) =>
        fetch(`/api/approval-queue/${item.id}/dismiss-orbit`, {
          method: "POST",
          headers: authHeaders(token),
        })
      )
    );
    setItems((prev) => prev.filter((item) => item.source !== "orbit"));
    setClearOrbitState("done");
    setTimeout(() => setClearOrbitState("idle"), 2000);
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
              <ApprovalCard
                key={item.id}
                item={item}
                token={token}
                onComplete={handleComplete}
                onDismiss={item.source === "orbit" ? handleDismissOrbitItem : undefined}
              />
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
      {/* Keyboard hint bar — only on hover-capable (non-touch) devices */}
      {isHoverDevice && !loading && count > 0 && (
        <div style={{
          fontFamily: "monospace",
          fontSize: 10,
          color: "var(--hb-20)",
          textAlign: "center",
          letterSpacing: "0.04em",
          padding: "4px 0 2px",
        }}>
          ← reject · → approve · ↓↑ navigate
        </div>
      )}

      {loading && (
        <div style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-60)", textAlign: "center", padding: 20 }}>
          Loading queue...
        </div>
      )}

      {error && (
        <div style={{
          fontFamily: PS2P, fontSize: 8, color: "var(--hb-error-soft)",
          textAlign: "center", padding: 16,
          background: "rgba(232,74,125,0.08)", borderRadius: 4,
        }}>
          Failed to load: {error}
        </div>
      )}

      {!loading && !error && count === 0 && (
        <div style={{ textAlign: "center", padding: 24 }}>
          <div style={{ fontFamily: PS2P, fontSize: 10, color: "var(--hb-60)", marginBottom: 8 }}>
            Nothing to review
          </div>
          <div style={{ fontFamily: PS2P, fontSize: 7, color: "var(--hb-60)" }}>
            Your agents are working on it
          </div>
        </div>
      )}

      {/* Auto-approved notice */}
      {!loading && !error && autoApprovedCount > 0 && (
        <div style={{
          fontFamily: PS2P,
          fontSize: 7,
          color: "var(--hb-success)",
          padding: "6px 10px",
          background: "rgba(133,173,146,0.06)",
          border: "1px solid rgba(133,173,146,0.15)",
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
              color: "var(--hb-success)",
              background: "rgba(133,173,146,0.08)",
              border: "1px solid rgba(133,173,146,0.2)",
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
              color: "rgba(133,173,146,0.5)",
              background: "rgba(133,173,146,0.05)",
              border: "1px solid rgba(133,173,146,0.3)",
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
                  background: "rgba(133,173,146,0.18)",
                  border: "1px solid rgba(133,173,146,0.45)",
                  borderRadius: 4,
                  color: "var(--hb-success)",
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
                  background: "var(--hb-05)",
                  border: "1px solid var(--hb-10)",
                  borderRadius: 4,
                  color: "var(--hb-60)",
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
                  background: "rgba(133,173,146,0.12)",
                  border: "1px solid rgba(133,173,146,0.3)",
                  borderRadius: 4,
                  color: "var(--hb-success)",
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
                  color: "var(--hb-success)",
                  background: "rgba(133,173,146,0.08)",
                  border: "1px solid rgba(133,173,146,0.2)",
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

      {/* Clear Orbit Drafts button — shown when there are orbit items */}
      {!loading && !error && items.some((item) => item.source === "orbit") && (
        <button
          onClick={handleClearOrbitDrafts}
          disabled={clearOrbitState === "running"}
          style={{
            fontFamily: PS2P,
            fontSize: 8,
            padding: "10px 14px",
            background: clearOrbitState === "done"
              ? "rgba(217,141,237,0.08)"
              : clearOrbitState === "running"
              ? "rgba(217,141,237,0.04)"
              : "rgba(217,141,237,0.1)",
            border: "1px solid rgba(217,141,237,0.3)",
            borderRadius: 4,
            color: clearOrbitState === "running"
              ? "rgba(217,141,237,0.4)"
              : clearOrbitState === "done"
              ? "var(--hb-success)"
              : "var(--hb-warn)",
            cursor: clearOrbitState === "running" ? "wait" : "pointer",
            alignSelf: "flex-start",
          }}
        >
          {clearOrbitState === "running"
            ? "CLEARING..."
            : clearOrbitState === "done"
            ? "CLEARED"
            : "CLEAR ORBIT DRAFTS"}
        </button>
      )}

      {items.map((item, index) => (
        <ApprovalCard
          key={item.id}
          ref={(el) => { cardRefs.current[index] = el; }}
          item={item}
          token={token}
          onComplete={handleComplete}
          onDismiss={item.source === "orbit" ? handleDismissOrbitItem : undefined}
          isSelected={selectedIndex === index}
        />
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
