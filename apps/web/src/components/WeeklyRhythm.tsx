"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { authHeaders } from "@/lib/client-auth";
import type { WeekDay, WeekResponse } from "@/app/api/stats/week/route";
import type { WeekAheadPost } from "@/app/api/stats/week-ahead/route";

const PS2P = "'Press Start 2P', monospace";

const PLATFORM_COLOURS: Record<string, string> = {
  threads: "#1a1a2a",
  instagram: "#833ab4",
  twitter: "#1da1f2",
  x: "#1da1f2",
  linkedin: "#0077b5",
  bluesky: "#0085ff",
};

function platformColour(platform: string): string {
  return PLATFORM_COLOURS[platform.toLowerCase()] ?? "#444";
}

interface Props {
  token: string;
}

interface Tooltip {
  day: WeekDay;
  x: number;
}

// Group posts by date string "YYYY-MM-DD"
function groupByDay(posts: WeekAheadPost[]): Map<string, WeekAheadPost[]> {
  const map = new Map<string, WeekAheadPost[]>();
  for (const post of posts) {
    const key = post.scheduledFor.slice(0, 10);
    const existing = map.get(key);
    if (existing) {
      existing.push(post);
    } else {
      map.set(key, [post]);
    }
  }
  return map;
}

function formatDayHeader(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export default function WeeklyRhythm({ token }: Props) {
  const [data, setData] = useState<WeekResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  // Expand state
  const [expanded, setExpanded] = useState(false);
  const [aheadPosts, setAheadPosts] = useState<WeekAheadPost[] | null>(null);
  const [aheadLoading, setAheadLoading] = useState(false);
  const cacheRef = useRef<{ data: WeekAheadPost[]; fetchedAt: number } | null>(null);

  const fetchWeek = useCallback(async () => {
    try {
      const res = await fetch("/api/stats/week", {
        headers: authHeaders(token),
        cache: "no-store",
      });
      if (res.ok) {
        const json: WeekResponse = await res.json();
        setData(json);
      }
    } catch {
      // Silently fail — non-critical card
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchAhead = useCallback(async () => {
    // Cache for 60s
    const now = Date.now();
    if (cacheRef.current && now - cacheRef.current.fetchedAt < 60_000) {
      setAheadPosts(cacheRef.current.data);
      return;
    }
    setAheadLoading(true);
    try {
      const res = await fetch("/api/stats/week-ahead", {
        headers: authHeaders(token),
        cache: "no-store",
      });
      if (res.ok) {
        const json: WeekAheadPost[] = await res.json();
        cacheRef.current = { data: json, fetchedAt: Date.now() };
        setAheadPosts(json);
      }
    } catch {
      setAheadPosts([]);
    } finally {
      setAheadLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchWeek();
    const id = setInterval(fetchWeek, 5 * 60_000);
    return () => clearInterval(id);
  }, [fetchWeek]);

  function handleToggle() {
    const next = !expanded;
    setExpanded(next);
    if (next && aheadPosts === null) {
      void fetchAhead();
    }
  }

  const grouped = aheadPosts ? groupByDay(aheadPosts) : new Map<string, WeekAheadPost[]>();
  const sortedDays = Array.from(grouped.keys()).sort();

  return (
    <div
      style={{
        background: "#0a0a0a",
        border: "1px solid var(--hb-08)",
        borderRadius: 6,
        padding: "12px 14px",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontFamily: PS2P,
            fontSize: 8,
            color: "var(--hb-50)",
            letterSpacing: 1,
          }}
        >
          WEEKLY RHYTHM
        </span>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {data && data.gaps > 0 && (
            <span
              style={{
                fontFamily: PS2P,
                fontSize: 6,
                color: "#ef4444",
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: 3,
                padding: "2px 6px",
              }}
            >
              {data.gaps} GAP{data.gaps === 1 ? "" : "S"}
            </span>
          )}
          {data && data.totalReview > 0 && (
            <span
              style={{
                fontFamily: PS2P,
                fontSize: 6,
                color: "#f59e0b",
                background: "rgba(245,158,11,0.1)",
                border: "1px solid rgba(245,158,11,0.25)",
                borderRadius: 3,
                padding: "2px 6px",
              }}
            >
              {data.totalReview} REVIEW
            </span>
          )}
          {/* Expand toggle */}
          <button
            onClick={handleToggle}
            style={{
              background: "none",
              border: "1px solid var(--hb-12)",
              borderRadius: 3,
              color: "var(--hb-40)",
              cursor: "pointer",
              fontFamily: PS2P,
              fontSize: 7,
              padding: "2px 6px",
              lineHeight: 1,
            }}
            title={expanded ? "Collapse week ahead" : "Expand week ahead"}
          >
            {expanded ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {/* 7-day strip */}
      {loading ? (
        <div
          style={{
            height: 72,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: PS2P,
            fontSize: 7,
            color: "var(--hb-20)",
          }}
        >
          loading...
        </div>
      ) : !data ? (
        <div
          style={{
            height: 72,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: PS2P,
            fontSize: 7,
            color: "var(--hb-20)",
          }}
        >
          unavailable
        </div>
      ) : (
        <div style={{ position: "relative" }} data-weekly-strip>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 4,
            }}
          >
            {data.week.map((day) => (
              <DayCell
                key={day.date}
                day={day}
                onEnter={(d, x) => setTooltip({ day: d, x })}
                onLeave={() => setTooltip(null)}
              />
            ))}
          </div>

          {/* Tooltip */}
          {tooltip && (
            <DayTooltip tooltip={tooltip} />
          )}
        </div>
      )}

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 8,
          flexWrap: "wrap",
        }}
      >
        {[
          { color: "#4ade80", label: "published" },
          { color: "#f59e0b", label: "scheduled" },
          { color: "#ef4444", label: "review" },
          { color: "var(--hb-12)", label: "gap" },
        ].map(({ color, label }) => (
          <div
            key={label}
            style={{ display: "flex", alignItems: "center", gap: 4 }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: 1,
                background: color,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: PS2P,
                fontSize: 5,
                color: "var(--hb-25)",
                letterSpacing: 0.5,
              }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Expandable week-ahead list */}
      {expanded && (
        <div
          style={{
            marginTop: 12,
            borderTop: "1px solid var(--hb-06)",
            paddingTop: 10,
          }}
        >
          {aheadLoading ? (
            <WeekAheadSkeleton />
          ) : aheadPosts !== null && aheadPosts.length === 0 ? (
            <p
              style={{
                fontFamily: "monospace",
                fontSize: 11,
                color: "var(--hb-25)",
                margin: 0,
                textAlign: "center",
                padding: "12px 0",
              }}
            >
              Nothing scheduled this week
            </p>
          ) : (
            <div
              style={{
                maxHeight: 280,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {sortedDays.map((day) => {
                const posts = grouped.get(day) ?? [];
                return (
                  <div key={day}>
                    {/* Day header */}
                    <div
                      style={{
                        fontFamily: "monospace",
                        fontSize: 9,
                        color: "var(--hb-30)",
                        letterSpacing: 0.5,
                        marginBottom: 4,
                        textTransform: "uppercase",
                      }}
                    >
                      {formatDayHeader(day)}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {posts.map((post) => (
                        <PostRow key={post.id} post={post} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PostRow({ post }: { post: WeekAheadPost }) {
  const colour = platformColour(post.platform);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "4px 6px",
        background: "var(--hb-03)",
        borderRadius: 4,
      }}
    >
      {/* Time */}
      <span
        style={{
          fontFamily: "monospace",
          fontSize: 10,
          color: "var(--hb-40)",
          flexShrink: 0,
          minWidth: 36,
          paddingTop: 1,
        }}
      >
        {formatTime(post.scheduledFor)}
      </span>

      {/* Content */}
      <span
        style={{
          fontFamily: "monospace",
          fontSize: 10,
          color: "var(--hb-65)",
          flex: 1,
          lineHeight: 1.4,
          wordBreak: "break-word",
        }}
      >
        {post.content}
      </span>

      {/* Platform badge */}
      <span
        style={{
          fontFamily: "monospace",
          fontSize: 8,
          color: "var(--hb-80)",
          background: colour,
          borderRadius: 3,
          padding: "2px 5px",
          flexShrink: 0,
          letterSpacing: 0.3,
          alignSelf: "flex-start",
        }}
      >
        {post.platform || "post"}
      </span>
    </div>
  );
}

function WeekAheadSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "4px 0" }}>
      {[80, 60, 70].map((width, i) => (
        <div
          key={i}
          style={{
            height: 20,
            width: `${width}%`,
            background: "var(--hb-07)",
            borderRadius: 4,
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
      ))}
    </div>
  );
}

function DayCell({
  day,
  onEnter,
  onLeave,
}: {
  day: WeekDay;
  onEnter: (day: WeekDay, x: number) => void;
  onLeave: () => void;
}) {
  const isPast = !day.isToday && !day.hasGap && day.published === 0 && day.scheduled === 0 && day.review === 0;
  const hasActivity = day.published > 0 || day.scheduled > 0 || day.review > 0;

  return (
    <div
      onMouseEnter={(e) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const parentRect = (e.currentTarget as HTMLElement)
          .closest("[data-weekly-strip]")
          ?.getBoundingClientRect();
        const x = parentRect ? rect.left - parentRect.left + rect.width / 2 : rect.left;
        onEnter(day, x);
      }}
      onMouseLeave={onLeave}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        padding: "6px 2px",
        borderRadius: 4,
        border: day.isToday
          ? "1px solid rgba(167,139,250,0.4)"
          : "1px solid transparent",
        background: day.isToday
          ? "rgba(167,139,250,0.05)"
          : "transparent",
        cursor: "default",
        transition: "background 0.1s",
        minHeight: 72,
      }}
    >
      {/* Day label */}
      <span
        style={{
          fontFamily: PS2P,
          fontSize: 6,
          color: day.isToday
            ? "#a78bfa"
            : isPast
            ? "var(--hb-20)"
            : "var(--hb-45)",
          letterSpacing: 0.5,
        }}
      >
        {day.dayLabel}
      </span>

      {/* Dot cluster */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          alignItems: "center",
          flex: 1,
          justifyContent: "center",
        }}
      >
        {!hasActivity && (
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: 1,
              background: day.hasGap
                ? "rgba(239,68,68,0.3)"
                : "var(--hb-08)",
              border: day.hasGap ? "1px solid rgba(239,68,68,0.4)" : "none",
            }}
          />
        )}

        {day.published > 0 && (
          <DotBar count={day.published} color="#4ade80" />
        )}
        {day.scheduled > 0 && (
          <DotBar count={day.scheduled} color="#f59e0b" />
        )}
        {day.review > 0 && (
          <DotBar count={day.review} color="#ef4444" />
        )}
      </div>

      {/* Date number */}
      <span
        style={{
          fontFamily: PS2P,
          fontSize: 5,
          color: "var(--hb-20)",
        }}
      >
        {day.date.slice(8)}
      </span>
    </div>
  );
}

function DotBar({ count, color }: { count: number; color: string }) {
  // Show up to 4 dots; if more, show a filled bar with a count
  const MAX_DOTS = 4;
  if (count <= MAX_DOTS) {
    return (
      <div style={{ display: "flex", gap: 1.5, flexWrap: "wrap", justifyContent: "center", maxWidth: 24 }}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 4,
              height: 4,
              borderRadius: 1,
              background: color,
              opacity: 0.85,
            }}
          />
        ))}
      </div>
    );
  }
  return (
    <div
      style={{
        width: 20,
        height: 6,
        borderRadius: 2,
        background: color,
        opacity: 0.8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        style={{
          fontFamily: PS2P,
          fontSize: 4,
          color: "#000",
          lineHeight: 1,
        }}
      >
        {count}
      </span>
    </div>
  );
}

function DayTooltip({ tooltip }: { tooltip: { day: WeekDay; x: number } }) {
  const { day } = tooltip;

  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        left: "50%",
        transform: "translateX(-50%)",
        background: "#1a1a1a",
        border: "1px solid var(--hb-12)",
        borderRadius: 5,
        padding: "8px 10px",
        zIndex: 20,
        pointerEvents: "none",
        minWidth: 120,
        boxShadow: "0 4px 12px rgba(0,0,0,0.6)",
      }}
    >
      <div
        style={{
          fontFamily: PS2P,
          fontSize: 7,
          color: "var(--hb-70)",
          marginBottom: 6,
          letterSpacing: 0.5,
        }}
      >
        {day.dayLabel} {day.date.slice(5).replace("-", "/")}
        {day.isToday && (
          <span style={{ color: "#a78bfa", marginLeft: 6 }}>TODAY</span>
        )}
      </div>
      <TooltipRow label="published" value={day.published} color="#4ade80" />
      <TooltipRow label="scheduled" value={day.scheduled} color="#f59e0b" />
      <TooltipRow label="review" value={day.review} color="#ef4444" />
      {day.hasGap && (
        <div
          style={{
            fontFamily: PS2P,
            fontSize: 6,
            color: "#ef4444",
            marginTop: 4,
            opacity: 0.8,
          }}
        >
          no content planned
        </div>
      )}
    </div>
  );
}

function TooltipRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  if (value === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginBottom: 3,
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: 1,
          background: color,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: PS2P,
          fontSize: 6,
          color: "var(--hb-50)",
        }}
      >
        {value} {label}
      </span>
    </div>
  );
}
