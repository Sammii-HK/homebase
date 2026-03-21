"use client";

import { useState, useEffect, useCallback } from "react";
import { authHeaders } from "@/lib/client-auth";
import type { WeekDay, WeekResponse } from "@/app/api/stats/week/route";

const PS2P = "'Press Start 2P', monospace";

interface Props {
  token: string;
}

interface Tooltip {
  day: WeekDay;
  x: number;
}

export default function WeeklyRhythm({ token }: Props) {
  const [data, setData] = useState<WeekResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

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

  useEffect(() => {
    fetchWeek();
    const id = setInterval(fetchWeek, 5 * 60_000);
    return () => clearInterval(id);
  }, [fetchWeek]);

  return (
    <div
      style={{
        background: "#0a0a0a",
        border: "1px solid rgba(255,255,255,0.08)",
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
            color: "rgba(255,255,255,0.5)",
            letterSpacing: 1,
          }}
        >
          WEEKLY RHYTHM
        </span>
        {data && (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {data.gaps > 0 && (
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
            {data.totalReview > 0 && (
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
          </div>
        )}
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
            color: "rgba(255,255,255,0.2)",
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
            color: "rgba(255,255,255,0.2)",
          }}
        >
          unavailable
        </div>
      ) : (
        <div style={{ position: "relative" }}>
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
          { color: "rgba(255,255,255,0.12)", label: "gap" },
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
                color: "rgba(255,255,255,0.25)",
                letterSpacing: 0.5,
              }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
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
            ? "rgba(255,255,255,0.2)"
            : "rgba(255,255,255,0.45)",
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
                : "rgba(255,255,255,0.08)",
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
          color: "rgba(255,255,255,0.2)",
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
        border: "1px solid rgba(255,255,255,0.12)",
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
          color: "rgba(255,255,255,0.7)",
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
          color: "rgba(255,255,255,0.5)",
        }}
      >
        {value} {label}
      </span>
    </div>
  );
}
