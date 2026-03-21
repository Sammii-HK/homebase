"use client";

import { useEffect, useState, useCallback } from "react";
import type { LaunchTrackerData, LaunchProduct, LaunchStatus } from "@/types/dashboard";

interface Props {
  token: string;
}

const POLL_MS = 86_400_000; // daily

const STATUS_DOT: Record<LaunchStatus, string> = {
  live: "#4ade80",
  building: "#f59e0b",
  ready: "#3b82f6",
  "not-started": "rgba(255,255,255,0.2)",
  paused: "#f87171",
};

const STATUS_LABEL: Record<LaunchStatus, string> = {
  live: "LIVE",
  building: "BUILDING",
  ready: "READY",
  "not-started": "NOT STARTED",
  paused: "PAUSED",
};

function progressPct(product: LaunchProduct): number {
  if (product.milestones.length === 0) return 0;
  return Math.round(
    (product.milestones.filter((m) => m.done).length / product.milestones.length) * 100
  );
}

export default function LaunchTracker({ token }: Props) {
  const [data, setData] = useState<LaunchTrackerData | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/stats/launch", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      setData(await res.json());
    } catch {
      // silent
    }
  }, [token]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, POLL_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  if (!data) return null;

  const { products, summary } = data;
  const liveCount = summary.byStatus.live ?? 0;
  const buildingCount = summary.byStatus.building ?? 0;

  return (
    <div data-launch-tracker className="bg-white/[0.04] border border-white/10 rounded-lg p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[8px] md:text-xs md:text-xs uppercase tracking-wider text-white/40">
          Launch Tracker
        </p>
        <p className="text-[7px] md:text-[11px] md:text-[11px] text-white/30">
          {liveCount} live · {buildingCount} building
        </p>
      </div>

      {/* Priority action */}
      <div
        className="rounded px-2 py-1.5 mb-2"
        style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}
      >
        <p className="text-[7px] md:text-[11px] md:text-[11px] text-amber-400">
          <span className="text-white/40 mr-1">NEXT:</span>
          {summary.priorityAction}
        </p>
      </div>

      {/* Product rows */}
      <div className="flex flex-col gap-2">
        {products.map((product) => {
          const pct = progressPct(product);
          const dotColour = STATUS_DOT[product.status];
          const isTemp = product.category === "temp";

          const row = (
            <div
              key={product.id}
              className={`group ${isTemp ? "opacity-50" : ""}`}
            >
              {/* Top line: dot + name + status + metric */}
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-2 h-2 rounded-full shrink-0 ${product.status === "building" ? "animate-pulse" : ""}`}
                  style={{ backgroundColor: dotColour }}
                />
                <span
                  className="text-[8px] md:text-xs md:text-xs font-bold uppercase"
                  style={{ color: product.color }}
                >
                  {product.name}
                </span>
                <span
                  className="text-[6px] md:text-[10px] md:text-sm md:text-[10px] md:text-sm md:text-sm uppercase px-1 py-px rounded"
                  style={{
                    color: dotColour,
                    background: `${dotColour}20`,
                  }}
                >
                  {STATUS_LABEL[product.status]}
                </span>
                {isTemp && (
                  <span className="text-[6px] md:text-[10px] md:text-sm md:text-[10px] md:text-sm md:text-sm uppercase px-1 py-px rounded bg-white/10 text-white/30">
                    TEMP
                  </span>
                )}
                <span className="flex-1" />
                {product.liveMetric && (
                  <span className="text-[7px] md:text-[11px] md:text-[11px] text-white/50 shrink-0">
                    {product.liveMetric}
                  </span>
                )}
              </div>

              {/* Progress bar + percentage + next action */}
              <div className="flex items-center gap-1.5 mt-1 ml-3.5">
                {/* Bar */}
                <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: dotColour,
                      opacity: 0.7,
                    }}
                  />
                </div>
                <span className="text-[7px] md:text-[11px] md:text-[11px] text-white/30 w-6 text-right shrink-0">
                  {pct}%
                </span>
              </div>

              {/* Next action */}
              <p className="text-[7px] md:text-[11px] md:text-[11px] text-white/40 mt-0.5 ml-3.5 truncate">
                {product.nextAction}
              </p>
            </div>
          );

          if (product.url) {
            return (
              <a
                key={product.id}
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:bg-white/[0.03] rounded -mx-1 px-1 py-0.5 transition-colors"
              >
                {row}
              </a>
            );
          }

          return row;
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/[0.06]">
        <span className="text-[7px] md:text-[11px] md:text-[11px] text-white/30">
          Total MRR: £{summary.totalMRR.toFixed(2)}
        </span>
        <span className="text-[7px] md:text-[11px] md:text-[11px] text-white/30">
          Next revenue: {summary.nextRevenue}
        </span>
      </div>
    </div>
  );
}
