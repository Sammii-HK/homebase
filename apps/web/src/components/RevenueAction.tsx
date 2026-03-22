"use client";

import { authHeaders } from "@/lib/client-auth";
import { useEffect, useState, useCallback } from "react";

interface Props {
  token: string;
}

interface ActionData {
  recommendation: string;
  rationale: string;
  estimatedImpact: string;
  generatedAt: string;
  cached: boolean;
}

export default function RevenueAction({ token }: Props) {
  const [data, setData] = useState<ActionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const fetchAction = useCallback(async (force = false) => {
    try {
      const url = force ? "/api/revenue-action?refresh=1" : "/api/revenue-action";
      const res = await fetch(url, { headers: authHeaders(token ?? "") });
      if (res.status === 503) {
        setUnavailable(true);
        return;
      }
      if (!res.ok) return;
      const d = await res.json() as ActionData;
      setData(d);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAction();
  }, [fetchAction]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAction(true);
  };

  // Hide if API key not configured
  if (unavailable) return null;

  if (loading) {
    return (
      <div
        className="rounded-lg p-3"
        style={{ background: "rgba(52,211,153,0.04)", border: "1px solid rgba(52,211,153,0.15)" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[8px] md:text-[11px]">🧠</span>
          <p className="text-[7px] md:text-[11px] uppercase tracking-wider" style={{ color: "rgba(52,211,153,0.5)" }}>
            AI Recommends
          </p>
        </div>
        <div
          className="h-3 rounded w-3/4 mb-1.5"
          style={{ background: "rgba(52,211,153,0.1)", animation: "pulse 1.5s ease-in-out infinite" }}
        />
        <div
          className="h-2.5 rounded w-1/2"
          style={{ background: "rgba(52,211,153,0.07)", animation: "pulse 1.5s ease-in-out infinite" }}
        />
      </div>
    );
  }

  if (!data) return null;

  const ageHours = Math.round((Date.now() - new Date(data.generatedAt).getTime()) / 3_600_000);

  return (
    <div
      className="rounded-lg p-3"
      style={{ background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.2)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] md:text-sm">🧠</span>
          <p
            className="text-[7px] md:text-[11px] uppercase tracking-wider"
            style={{ color: "#34d399" }}
          >
            AI Recommends
          </p>
          {data.cached && (
            <span
              className="text-[5px] md:text-[9px] px-1 rounded"
              style={{ background: "rgba(52,211,153,0.1)", color: "rgba(52,211,153,0.5)" }}
            >
              {ageHours}h ago
            </span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          title="Refresh recommendation"
          className="text-[8px] md:text-xs opacity-40 hover:opacity-80 transition-opacity"
          style={{ color: "#34d399", background: "none", border: "none", cursor: refreshing ? "not-allowed" : "pointer" }}
        >
          {refreshing ? "..." : "↺"}
        </button>
      </div>

      {/* Recommendation */}
      <p
        className="text-[8px] md:text-xs leading-relaxed mb-2"
        style={{ color: "var(--hb-90)" }}
      >
        {data.recommendation}
      </p>

      {/* Rationale + impact row */}
      <div className="flex items-start gap-3">
        {data.rationale && (
          <p className="flex-1 text-[6px] md:text-[10px] text-white/35 leading-relaxed">
            {data.rationale}
          </p>
        )}
        {data.estimatedImpact && (
          <span
            className="shrink-0 text-[6px] md:text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap"
            style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}
          >
            {data.estimatedImpact}
          </span>
        )}
      </div>
    </div>
  );
}
