"use client";

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
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
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
        headers: { Authorization: `Bearer ${token}` },
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

  // Success flash states
  if (state === "sent") {
    return (
      <div
        style={{
          padding: 16,
          background: "rgba(74,222,128,0.08)",
          border: "1px solid rgba(74,222,128,0.2)",
          borderRadius: 6,
          textAlign: "center",
        }}
      >
        <div style={{ fontFamily: PS2P, fontSize: 9, color: "#4ade80" }}>
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
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 6,
          textAlign: "center",
        }}
      >
        <div style={{ fontFamily: PS2P, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
          DISMISSED
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "14px 16px",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.1)",
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
              ? "rgba(255,255,255,0.1)"
              : `${platformColor}15`,
            padding: "3px 6px",
            borderRadius: 3,
            letterSpacing: 1,
            border: threadsPlatform ? "1px solid rgba(255,255,255,0.2)" : "none",
          }}
        >
          {platformIcon}
        </span>
        <span
          style={{
            fontFamily: PS2P,
            fontSize: 6,
            color: "rgba(255,255,255,0.35)",
            background: "rgba(255,255,255,0.05)",
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
            color: "rgba(255,255,255,0.6)",
          }}
        >
          {item.authorName || item.authorHandle}
        </span>
        {item.authorHandle && item.authorName && (
          <span
            style={{
              fontFamily: PS2P,
              fontSize: 6,
              color: "rgba(255,255,255,0.3)",
            }}
          >
            @{item.authorHandle.replace(/^@/, "")}
          </span>
        )}
        <span
          style={{
            fontFamily: PS2P,
            fontSize: 6,
            color: "rgba(255,255,255,0.2)",
            marginLeft: "auto",
          }}
        >
          {formatRelativeTime(item.createdAt)}
        </span>
      </div>

      {/* Their comment/message content */}
      <div
        style={{
          fontFamily: PS2P,
          fontSize: 8,
          color: "rgba(255,255,255,0.7)",
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
            fontFamily: PS2P,
            fontSize: 7,
            color: "rgba(255,255,255,0.3)",
            lineHeight: 1.5,
            marginBottom: 12,
            padding: "8px 10px",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 4,
            wordBreak: "break-word",
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.15)", marginRight: 6 }}>RE:</span>
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
              color: "rgba(255,255,255,0.25)",
              textDecoration: "underline",
            }}
          >
            View on platform
          </a>
        </div>
      )}

      {/* AI suggested reply (editable textarea) */}
      <textarea
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        placeholder="Type a reply..."
        rows={3}
        style={{
          width: "100%",
          fontFamily: PS2P,
          fontSize: 7,
          lineHeight: 1.6,
          padding: "10px 12px",
          background: "rgba(0,0,0,0.3)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 4,
          color: "#fff",
          outline: "none",
          boxSizing: "border-box",
          resize: "vertical",
          marginBottom: 10,
        }}
      />

      {/* Error display */}
      {error && (
        <div
          style={{
            fontFamily: PS2P,
            fontSize: 7,
            color: "#f87171",
            background: "rgba(239,68,68,0.1)",
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
                ? "rgba(74,222,128,0.05)"
                : "rgba(74,222,128,0.12)",
            border: "1px solid rgba(74,222,128,0.3)",
            borderRadius: 4,
            color:
              state === "sending" || !reply.trim()
                ? "rgba(74,222,128,0.4)"
                : "#4ade80",
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
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 4,
            color:
              state === "skipping"
                ? "rgba(255,255,255,0.3)"
                : "rgba(255,255,255,0.5)",
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
        headers: { Authorization: `Bearer ${token}` },
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
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
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
              color: "rgba(255,255,255,0.4)",
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
              color: "rgba(255,255,255,0.3)",
            }}
          >
            Loading...
          </div>
        ) : error ? (
          <div style={{ fontFamily: PS2P, fontSize: 8, color: "#f87171" }}>
            Error: {error}
          </div>
        ) : count === 0 ? (
          <div
            style={{
              fontFamily: PS2P,
              fontSize: 8,
              color: "rgba(255,255,255,0.3)",
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
                  color: "rgba(255,255,255,0.25)",
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
            color: "rgba(255,255,255,0.3)",
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
            color: "#f87171",
            textAlign: "center",
            padding: 16,
            background: "rgba(239,68,68,0.08)",
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
              color: "rgba(255,255,255,0.5)",
              marginBottom: 8,
            }}
          >
            No unread engagement
          </div>
          <div
            style={{
              fontFamily: PS2P,
              fontSize: 7,
              color: "rgba(255,255,255,0.25)",
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
          headers: { Authorization: `Bearer ${token}` },
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
