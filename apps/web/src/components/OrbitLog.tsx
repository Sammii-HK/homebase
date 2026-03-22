"use client";

import { useState, useEffect, useCallback } from "react";
import { authHeaders } from "@/lib/client-auth";
import type { OrbitLogResponse, OrbitLogEntryType } from "@/app/api/orbit-log/route";

const PS2P = "'Press Start 2P', monospace";

interface Props {
  token: string;
}

function formatRelative(ts: string): string {
  if (!ts) return "";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const TYPE_CONFIG: Record<
  OrbitLogEntryType,
  { color: string; bg: string; icon: string; label: string }
> = {
  content_generated: {
    color: "#4ade80",
    bg: "rgba(74,222,128,0.1)",
    icon: "✦",
    label: "GENERATED",
  },
  post_scheduled: {
    color: "#60a5fa",
    bg: "rgba(96,165,250,0.1)",
    icon: "◈",
    label: "SCHEDULED",
  },
  engagement_replied: {
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.1)",
    icon: "↩",
    label: "REPLIED",
  },
  error: {
    color: "#ef4444",
    bg: "rgba(239,68,68,0.1)",
    icon: "✕",
    label: "ERROR",
  },
  info: {
    color: "var(--hb-40)",
    bg: "var(--hb-05)",
    icon: "·",
    label: "INFO",
  },
};

export default function OrbitLog({ token }: Props) {
  const [data, setData] = useState<OrbitLogResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLog = useCallback(async () => {
    try {
      const res = await fetch("/api/orbit-log", {
        headers: authHeaders(token),
        cache: "no-store",
      });
      if (res.ok) {
        const json: OrbitLogResponse = await res.json();
        setData(json);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchLog();
    const id = setInterval(fetchLog, 5 * 60_000);
    return () => clearInterval(id);
  }, [fetchLog]);

  const isQuiet = data && data.orbitLog.length === 0;
  const isOffline = !loading && !data;

  return (
    <div
      style={{
        background: "#0a0a0a",
        border: "1px solid var(--hb-08)",
        borderRadius: 6,
        padding: "12px 14px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontFamily: PS2P,
              fontSize: 8,
              color: "var(--hb-50)",
              letterSpacing: 1,
            }}
          >
            ORBIT LOG
          </span>
          {/* Online indicator */}
          {!loading && (
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background:
                  isOffline || isQuiet ? "var(--hb-15)" : "#4ade80",
                boxShadow:
                  !isOffline && !isQuiet
                    ? "0 0 4px rgba(74,222,128,0.5)"
                    : "none",
              }}
            />
          )}
        </div>

        {/* Stats row */}
        {data && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {data.generatedToday > 0 && (
              <span
                style={{
                  fontFamily: PS2P,
                  fontSize: 6,
                  color: "#4ade80",
                  background: "rgba(74,222,128,0.08)",
                  border: "1px solid rgba(74,222,128,0.2)",
                  borderRadius: 3,
                  padding: "2px 6px",
                }}
              >
                +{data.generatedToday} TODAY
              </span>
            )}
            {data.errorsToday > 0 && (
              <span
                style={{
                  fontFamily: PS2P,
                  fontSize: 6,
                  color: "#ef4444",
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: 3,
                  padding: "2px 6px",
                }}
              >
                {data.errorsToday} ERR
              </span>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div
          style={{
            fontFamily: PS2P,
            fontSize: 7,
            color: "var(--hb-20)",
            textAlign: "center",
            padding: "16px 0",
          }}
        >
          loading...
        </div>
      ) : isOffline ? (
        <OfflineState />
      ) : isQuiet ? (
        <QuietState lastActive={data?.lastActive ?? null} />
      ) : (
        <LogFeed entries={data!.orbitLog} />
      )}
    </div>
  );
}

function OfflineState() {
  return (
    <div
      style={{
        padding: "14px 0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 4,
          background: "var(--hb-04)",
          border: "1px solid var(--hb-08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: PS2P,
          fontSize: 11,
          color: "var(--hb-15)",
        }}
      >
        ○
      </div>
      <span
        style={{
          fontFamily: PS2P,
          fontSize: 7,
          color: "var(--hb-25)",
          letterSpacing: 0.5,
        }}
      >
        ORBIT OFFLINE
      </span>
      <span
        style={{
          fontFamily: PS2P,
          fontSize: 6,
          color: "var(--hb-15)",
        }}
      >
        No agent activity detected
      </span>
    </div>
  );
}

function QuietState({ lastActive }: { lastActive: string | null }) {
  return (
    <div
      style={{
        padding: "14px 0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span
        style={{
          fontFamily: PS2P,
          fontSize: 8,
          color: "var(--hb-30)",
        }}
      >
        Orbit has been quiet
      </span>
      {lastActive && (
        <span
          style={{
            fontFamily: PS2P,
            fontSize: 6,
            color: "var(--hb-18)",
          }}
        >
          Last active {formatRelative(lastActive)}
        </span>
      )}
      {!lastActive && (
        <span
          style={{
            fontFamily: PS2P,
            fontSize: 6,
            color: "var(--hb-18)",
          }}
        >
          No recent activity in the last 24h
        </span>
      )}
    </div>
  );
}

function LogFeed({
  entries,
}: {
  entries: OrbitLogResponse["orbitLog"];
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        maxHeight: 280,
        overflowY: "auto",
      }}
    >
      {entries.map((entry, i) => {
        const cfg = TYPE_CONFIG[entry.type] ?? TYPE_CONFIG.info;
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              padding: "7px 8px",
              borderRadius: 4,
              background: cfg.bg,
              border: `1px solid ${cfg.color}18`,
            }}
          >
            {/* Type badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                flexShrink: 0,
                paddingTop: 1,
              }}
            >
              <span
                style={{
                  fontFamily: PS2P,
                  fontSize: 9,
                  color: cfg.color,
                  lineHeight: 1,
                  width: 10,
                  textAlign: "center",
                }}
              >
                {cfg.icon}
              </span>
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "system-ui, -apple-system, sans-serif",
                  fontSize: 12,
                  color: "var(--hb-75)",
                  lineHeight: 1.4,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {entry.summary}
              </div>
              {entry.count !== undefined && (
                <span
                  style={{
                    fontFamily: PS2P,
                    fontSize: 5,
                    color: cfg.color,
                    opacity: 0.7,
                  }}
                >
                  {entry.count} items
                </span>
              )}
            </div>

            {/* Timestamp */}
            {entry.ts && (
              <span
                style={{
                  fontFamily: PS2P,
                  fontSize: 5,
                  color: "var(--hb-20)",
                  flexShrink: 0,
                  paddingTop: 2,
                  whiteSpace: "nowrap",
                }}
              >
                {formatRelative(entry.ts)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
