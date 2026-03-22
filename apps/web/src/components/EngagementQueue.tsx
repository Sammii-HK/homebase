"use client";

import { authHeaders } from "@/lib/client-auth";
import { useState, useEffect, useCallback } from "react";

const PS2P = "'Press Start 2P', monospace";

interface EngagementItem {
  id: string;
  platform: string;
  type: "comment" | "mention" | "dm";
  authorName: string;
  authorHandle: string;
  content: string;
  postContent: string;
  suggestedReply: string;
  platformUrl: string;
  createdAt: string;
  score?: number;
  source?: "spellcast" | "orbit";
  accountSetId?: string;
  accountName?: string;
}

const PLATFORM_COLORS: Record<string, string> = {
  threads: "#000",
  instagram: "#E1306C",
  x: "#1DA1F2",
  twitter: "#1DA1F2",
  tiktok: "#00f2ea",
  bluesky: "#0085ff",
  reddit: "#FF4500",
  unknown: "#71717a",
};

const PLATFORM_ICONS: Record<string, string> = {
  threads: "TH",
  instagram: "IG",
  x: "X",
  twitter: "X",
  tiktok: "TT",
  bluesky: "BS",
  reddit: "RD",
  unknown: "??",
};

const TYPE_LABELS: Record<string, string> = {
  comment: "COMMENT",
  mention: "MENTION",
  dm: "DM",
};

type CardState = "idle" | "sending" | "skipping" | "sent" | "skipped" | "error";

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

function EngagementCard({
  item,
  token,
  onDone,
}: {
  item: EngagementItem;
  token: string;
  onDone: () => void;
}) {
  const [state, setState] = useState<CardState>("idle");
  const [reply, setReply] = useState(item.suggestedReply);
  const [error, setError] = useState("");
  const [regenerating, setRegenerating] = useState(false);

  const platformColor = PLATFORM_COLORS[item.platform] ?? PLATFORM_COLORS.unknown;
  const platformIcon = PLATFORM_ICONS[item.platform] ?? PLATFORM_ICONS.unknown;
  // Threads has a black badge -- use white text on dark bg with a visible border
  const threadsPlatform = item.platform === "threads";

  const handleSend = async () => {
    if (!reply.trim()) return;
    setState("sending");
    setError("");
    try {
      const res = await fetch(`/api/engagement-queue/${item.id}/reply`, {
        method: "POST",
        headers: { ...authHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ reply: reply.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Send failed");
        setState("error");
        return;
      }
      setState("sent");
      setTimeout(onDone, 1200);
    } catch {
      setError("Network error");
      setState("error");
    }
  };

  const handleSkip = async () => {
    setState("skipping");
    setError("");
    try {
      const res = await fetch(`/api/engagement-queue/${item.id}/dismiss`, {
        method: "POST",
        headers: authHeaders(token ?? ""),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Dismiss failed");
        setState("error");
        return;
      }
      setState("skipped");
      setTimeout(onDone, 800);
    } catch {
      setError("Network error");
      setState("error");
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    setError("");
    try {
      const suggestUrl = item.accountSetId
        ? `/api/engagement-queue/${item.id}/suggest?accountSetId=${item.accountSetId}`
        : `/api/engagement-queue/${item.id}/suggest`;
      const res = await fetch(suggestUrl, {
        headers: authHeaders(token ?? ""),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.reply) {
          setReply(data.reply);
        } else {
          setError("No suggestion returned");
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to regenerate");
      }
    } catch {
      setError("Network error");
    } finally {
      setRegenerating(false);
    }
  };

  // Success flash states
  if (state === "sent") {
    return (
      <div
        style={{
          padding: 16,
          background: "rgba(133,173,146,0.08)",
          border: "1px solid rgba(133,173,146,0.2)",
          borderRadius: 6,
          textAlign: "center",
        }}
      >
        <div style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-success)" }}>
          REPLY SENT
        </div>
      </div>
    );
  }
  if (state === "skipped") {
    return (
      <div
        style={{
          padding: 16,
          background: "var(--hb-04)",
          border: "1px solid var(--hb-10)",
          borderRadius: 6,
          textAlign: "center",
        }}
      >
        <div style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-60)" }}>
          DISMISSED
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "14px 16px",
        background: "var(--hb-03)",
        border: "1px solid var(--hb-10)",
        borderRadius: 6,
        borderLeft: `3px solid ${threadsPlatform ? "#fff" : platformColor}`,
      }}
    >
      {/* Header: platform badge + type + author + time */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontFamily: PS2P,
            fontSize: 8,
            color: threadsPlatform ? "#fff" : platformColor,
            background: threadsPlatform
              ? "var(--hb-10)"
              : `${platformColor}15`,
            padding: "3px 6px",
            borderRadius: 3,
            letterSpacing: 1,
            border: threadsPlatform ? "1px solid var(--hb-20)" : "none",
          }}
        >
          {platformIcon}
        </span>
        <span
          style={{
            fontFamily: PS2P,
            fontSize: 6,
            color: "var(--hb-60)",
            background: "var(--hb-05)",
            padding: "2px 5px",
            borderRadius: 3,
            textTransform: "uppercase",
          }}
        >
          {TYPE_LABELS[item.type] ?? "COMMENT"}
        </span>
        <span
          style={{
            fontFamily: PS2P,
            fontSize: 7,
            color: "var(--hb-60)",
          }}
        >
          {item.authorName || item.authorHandle}
        </span>
        {item.authorHandle && item.authorName && (
          <span
            style={{
              fontFamily: PS2P,
              fontSize: 6,
              color: "var(--hb-60)",
            }}
          >
            @{item.authorHandle.replace(/^@/, "")}
          </span>
        )}
        <span
          style={{
            fontFamily: PS2P,
            fontSize: 6,
            color: "var(--hb-20)",
            marginLeft: "auto",
          }}
        >
          {formatRelativeTime(item.createdAt)}
        </span>
      </div>

      {/* Their comment/message content */}
      <div
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: 14,
          color: "var(--hb-85)",
          lineHeight: 1.6,
          marginBottom: 10,
          wordBreak: "break-word",
        }}
      >
        {item.content}
      </div>

      {/* Original post they are responding to (truncated) */}
      {item.postContent && (
        <div
          style={{
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: 12,
            color: "var(--hb-60)",
            lineHeight: 1.5,
            marginBottom: 12,
            padding: "8px 10px",
            background: "var(--hb-02)",
            border: "1px solid var(--hb-06)",
            borderRadius: 4,
            wordBreak: "break-word",
          }}
        >
          <span style={{ color: "var(--hb-15)", marginRight: 6 }}>RE:</span>
          {item.postContent.length > 140
            ? item.postContent.slice(0, 140) + "..."
            : item.postContent}
        </div>
      )}

      {/* Platform link */}
      {item.platformUrl && (
        <div style={{ marginBottom: 10 }}>
          <a
            href={item.platformUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: PS2P,
              fontSize: 6,
              color: "var(--hb-60)",
              textDecoration: "underline",
            }}
          >
            View on platform
          </a>
        </div>
      )}

      {/* Replying-as account badge */}
      {item.accountName && (
        <div
          style={{
            fontFamily: PS2P,
            fontSize: 6,
            color: "rgba(96,165,250,0.7)",
            marginBottom: 6,
          }}
        >
          Replying as @{item.accountName}
        </div>
      )}

      {/* AI suggested reply (editable textarea) */}
      <div style={{ position: "relative", marginBottom: 10 }}>
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Type a reply..."
          rows={3}
          style={{
            width: "100%",
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: 14,
            lineHeight: 1.6,
            padding: "10px 12px",
            paddingRight: 40,
            background: "var(--hb-panel-30)",
            border: "1px solid var(--hb-12)",
            borderRadius: 4,
            color: "#fff",
            outline: "none",
            boxSizing: "border-box",
            resize: "vertical",
          }}
        />
        <button
          onClick={handleRegenerate}
          disabled={regenerating || state === "sending" || state === "skipping"}
          title="Regenerate AI suggestion"
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 28,
            height: 28,
            padding: 0,
            background: regenerating
              ? "rgba(96,165,250,0.1)"
              : "rgba(96,165,250,0.15)",
            border: "1px solid rgba(96,165,250,0.3)",
            borderRadius: 4,
            color: regenerating ? "rgba(96,165,250,0.4)" : "#60a5fa",
            cursor: regenerating ? "wait" : "pointer",
            fontFamily: PS2P,
            fontSize: 10,
            lineHeight: "28px",
            textAlign: "center",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {regenerating ? (
            <span style={{ fontSize: 7 }}>...</span>
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </svg>
          )}
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div
          style={{
            fontFamily: PS2P,
            fontSize: 7,
            color: "var(--hb-error-soft)",
            background: "rgba(232,74,125,0.1)",
            padding: "6px 8px",
            borderRadius: 4,
            marginBottom: 10,
          }}
        >
          {error}
        </div>
      )}

      {/* Action buttons: SEND + SKIP */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={handleSend}
          disabled={state === "sending" || state === "skipping" || !reply.trim()}
          style={{
            flex: 1,
            fontFamily: PS2P,
            fontSize: 8,
            padding: "12px",
            background:
              state === "sending"
                ? "rgba(133,173,146,0.05)"
                : "rgba(133,173,146,0.12)",
            border: "1px solid rgba(133,173,146,0.3)",
            borderRadius: 4,
            color:
              state === "sending" || !reply.trim()
                ? "rgba(133,173,146,0.4)"
                : "var(--hb-success)",
            cursor:
              state === "sending" || !reply.trim() ? "not-allowed" : "pointer",
            minHeight: 44,
          }}
        >
          {state === "sending" ? "SENDING..." : "SEND"}
        </button>
        <button
          onClick={handleSkip}
          disabled={state === "sending" || state === "skipping"}
          style={{
            flex: 1,
            fontFamily: PS2P,
            fontSize: 8,
            padding: "12px",
            background: "var(--hb-04)",
            border: "1px solid var(--hb-10)",
            borderRadius: 4,
            color:
              state === "skipping"
                ? "var(--hb-60)"
                : "var(--hb-60)",
            cursor: state === "skipping" ? "wait" : "pointer",
            minHeight: 44,
          }}
        >
          {state === "skipping" ? "SKIPPING..." : "SKIP"}
        </button>
      </div>
    </div>
  );
}

interface Props {
  token: string;
  /** Compact mode: show count + first 2 items only */
  compact?: boolean;
}

export default function EngagementQueue({ token, compact }: Props) {
  const [items, setItems] = useState<EngagementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/engagement-queue", {
        headers: authHeaders(token ?? ""),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setItems(data.items ?? []);
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

  const handleItemDone = () => {
    // Refresh queue after an action completes
    setTimeout(fetchQueue, 500);
  };

  const count = items.length;

  // Compact mode: count badge + first 2 items
  if (compact) {
    return (
      <div
        style={{
          background: "var(--hb-04)",
          border: "1px solid var(--hb-10)",
          borderRadius: 8,
          padding: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontFamily: PS2P,
              fontSize: 8,
              color: "var(--hb-60)",
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Engagement Queue
          </span>
          {count > 0 && (
            <span
              style={{
                fontFamily: PS2P,
                fontSize: 8,
                background: "rgba(96,165,250,0.2)",
                color: "#60a5fa",
                border: "1px solid rgba(96,165,250,0.3)",
                borderRadius: 3,
                padding: "2px 6px",
              }}
            >
              {count}
            </span>
          )}
        </div>

        {loading ? (
          <div
            style={{
              fontFamily: PS2P,
              fontSize: 8,
              color: "var(--hb-60)",
            }}
          >
            Loading...
          </div>
        ) : error ? (
          <div style={{ fontFamily: PS2P, fontSize: 8, color: "var(--hb-error-soft)" }}>
            Error: {error}
          </div>
        ) : count === 0 ? (
          <div
            style={{
              fontFamily: PS2P,
              fontSize: 8,
              color: "var(--hb-60)",
            }}
          >
            No unread engagement
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.slice(0, 2).map((item) => (
              <EngagementCard
                key={item.id}
                item={item}
                token={token}
                onDone={handleItemDone}
              />
            ))}
            {count > 2 && (
              <div
                style={{
                  fontFamily: PS2P,
                  fontSize: 7,
                  color: "var(--hb-60)",
                  textAlign: "center",
                }}
              >
                +{count - 2} more
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Full mode: all items
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {loading && (
        <div
          style={{
            fontFamily: PS2P,
            fontSize: 9,
            color: "var(--hb-60)",
            textAlign: "center",
            padding: 20,
          }}
        >
          Loading engagement...
        </div>
      )}

      {error && (
        <div
          style={{
            fontFamily: PS2P,
            fontSize: 8,
            color: "var(--hb-error-soft)",
            textAlign: "center",
            padding: 16,
            background: "rgba(232,74,125,0.08)",
            borderRadius: 4,
          }}
        >
          Failed to load: {error}
        </div>
      )}

      {!loading && !error && count === 0 && (
        <div style={{ textAlign: "center", padding: 24 }}>
          <div
            style={{
              fontFamily: PS2P,
              fontSize: 10,
              color: "var(--hb-60)",
              marginBottom: 8,
            }}
          >
            No unread engagement
          </div>
          <div
            style={{
              fontFamily: PS2P,
              fontSize: 7,
              color: "var(--hb-60)",
            }}
          >
            All caught up
          </div>
        </div>
      )}

      {items.map((item) => (
        <EngagementCard
          key={item.id}
          item={item}
          token={token}
          onDone={handleItemDone}
        />
      ))}
    </div>
  );
}

/** Utility hook to get the engagement count for badge display */
export function useEngagementCount(token: string | null): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!token) return;

    const fetchCount = async () => {
      try {
        const res = await fetch("/api/engagement-queue", {
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
