"use client";

import { useEffect, useState, useCallback } from "react";

interface Deploy {
  id: string;
  project: string;
  url: string;
  state: "READY" | "BUILDING" | "ERROR" | "QUEUED" | "CANCELED" | string;
  createdAt: string;
  commitMessage: string | null;
  branch: string | null;
  duration: number | null;
}

interface Props {
  token: string;
}

const STATE_COLOURS: Record<string, string> = {
  READY: "#4ade80",
  BUILDING: "#facc15",
  ERROR: "#f87171",
  QUEUED: "#60a5fa",
  CANCELED: "#71717a",
};

const STATE_LABEL: Record<string, string> = {
  READY: "READY",
  BUILDING: "BUILDING",
  ERROR: "ERROR",
  QUEUED: "QUEUED",
  CANCELED: "CANCELED",
  INITIALIZING: "INIT",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function truncate(str: string | null, max: number): string {
  if (!str) return "";
  return str.length > max ? str.slice(0, max) + "..." : str;
}

export default function DeployStatus({ token }: Props) {
  const [deploys, setDeploys] = useState<Deploy[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDeploys = useCallback(async () => {
    try {
      const res = await fetch("/api/deploys", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setDeploys(data.deploys ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchDeploys();
    const interval = setInterval(fetchDeploys, 60_000);
    return () => clearInterval(interval);
  }, [fetchDeploys]);

  // Sort building deploys to top
  const sorted = [...deploys].sort((a, b) => {
    if (a.state === "BUILDING" && b.state !== "BUILDING") return -1;
    if (b.state === "BUILDING" && a.state !== "BUILDING") return 1;
    return 0;
  });

  const visible = sorted.slice(0, 5);
  const buildingCount = deploys.filter((d) => d.state === "BUILDING").length;

  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[8px] uppercase tracking-wider text-white/40">
          Deploys
        </p>
        <div className="flex items-center gap-2">
          {buildingCount > 0 && (
            <span
              className="text-[7px] font-bold uppercase animate-pulse"
              style={{ color: STATE_COLOURS.BUILDING }}
            >
              {buildingCount} building
            </span>
          )}
          <span className="text-[8px] text-white/30">{deploys.length}</span>
        </div>
      </div>

      {loading && deploys.length === 0 && (
        <p className="text-[8px] text-white/20">Loading...</p>
      )}

      {!loading && deploys.length === 0 && (
        <p className="text-[8px] text-white/20">No deployments</p>
      )}

      <div className="flex flex-col gap-1.5">
        {visible.map((d) => {
          const colour = STATE_COLOURS[d.state] ?? "#71717a";
          const label = STATE_LABEL[d.state] ?? d.state;
          const isBuilding = d.state === "BUILDING";

          return (
            <a
              key={d.id}
              href={d.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-2 rounded px-1.5 py-1 -mx-1.5 hover:bg-white/[0.04] transition-colors"
            >
              {/* Status dot */}
              <div
                className={`w-2 h-2 rounded-full shrink-0 mt-0.5 ${isBuilding ? "animate-pulse" : ""}`}
                style={{ backgroundColor: colour }}
              />

              <div className="flex-1 min-w-0">
                {/* Project + state badge */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-bold text-white/80 uppercase">
                    {d.project}
                  </span>
                  <span
                    className="text-[6px] font-bold uppercase px-1 py-px rounded"
                    style={{
                      color: colour,
                      backgroundColor: `${colour}20`,
                    }}
                  >
                    {label}
                  </span>
                  {d.branch && (
                    <span className="text-[6px] text-white/25 truncate">
                      {d.branch}
                    </span>
                  )}
                </div>

                {/* Commit message */}
                {d.commitMessage && (
                  <p className="text-[7px] text-white/40 truncate leading-tight mt-0.5">
                    {truncate(d.commitMessage, 60)}
                  </p>
                )}
              </div>

              {/* Time */}
              <span className="text-[7px] text-white/25 shrink-0 mt-0.5">
                {relativeTime(d.createdAt)}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
