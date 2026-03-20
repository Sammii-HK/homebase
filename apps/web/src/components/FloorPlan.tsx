"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useActivityStream } from "@/hooks/useActivityStream";
import type { DashboardStats, HeartbeatResponse } from "@/types/dashboard";
import type { ClickTarget, IsleStats } from "./isle/types";
import { IsleRenderer } from "./isle/renderer";
import RoomDetail from "./RoomDetail";

// ── Badge logic (unchanged from original) ──

function getRoomBadge(
  roomKey: string,
  stats: DashboardStats | null,
  heartbeat: HeartbeatResponse | null,
): boolean {
  if (!stats) return false;
  switch (roomKey) {
    case "lunary":
      return stats.health.lunary.status === "down";
    case "spellcast":
      return stats.content.failedPosts > 0 || stats.health.spellcast.status === "down";
    case "dev":
      return (
        heartbeat?.status === "offline" ||
        stats.health.lunary.status === "down" ||
        stats.health.spellcast.status === "down" ||
        stats.health.contentCreator.status === "down"
      );
    case "meta":
      return (
        stats.opportunities.length > 0 ||
        (stats.seo.trend !== null && stats.seo.trend.clicks.pct < -10)
      );
    default:
      return false;
  }
}

// ── FloorPlan — canvas wrapper ──

interface FloorPlanProps {
  stats: DashboardStats | null;
  heartbeat: HeartbeatResponse | null;
}

export default function FloorPlan({ stats, heartbeat }: FloorPlanProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<IsleRenderer | null>(null);
  const activity = useActivityStream();
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const statsRef = useRef(stats);
  statsRef.current = stats;

  // Stable click handler — uses ref so renderer never gets recreated
  const handleClick = useCallback((target: ClickTarget) => {
    if (statsRef.current) setSelectedRoom(target.roomKey);
  }, []);

  // Mount renderer (once)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new IsleRenderer(canvas, handleClick);
    rendererRef.current = renderer;

    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [handleClick]);

  // Resize handler
  useEffect(() => {
    const onResize = () => rendererRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Bridge data to renderer
  useEffect(() => {
    if (!rendererRef.current) return;

    const isleStats: IsleStats = {
      lunary: {
        mau: stats?.lunary.mau ?? 0,
        mrr: stats?.lunary.mrr ?? 0,
        activeToday: stats?.lunary.activeToday ?? 0,
      },
      spellcast: {
        postsToday: stats?.spellcast.postsToday ?? 0,
        scheduled: stats?.spellcast.scheduled ?? 0,
        accounts: stats?.spellcast.accounts ?? 0,
      },
      infra: {
        systemsUp: [
          stats?.health.lunary.status !== "down",
          stats?.health.spellcast.status !== "down",
          stats?.health.contentCreator.status !== "down",
        ].filter(Boolean).length,
        totalSystems: 3,
      },
      meta: {
        followers: stats?.meta.followers ?? 0,
        reachThisWeek: stats?.meta.reachThisWeek ?? 0,
      },
      badges: {
        lunary: getRoomBadge("lunary", stats, heartbeat),
        spellcast: getRoomBadge("spellcast", stats, heartbeat),
        dev: getRoomBadge("dev", stats, heartbeat),
        meta: getRoomBadge("meta", stats, heartbeat),
      },
      hotRooms: activity.hotRooms,
    };

    rendererRef.current.updateData(isleStats);
  }, [stats, heartbeat, activity.hotRooms]);

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          touchAction: "none",
          imageRendering: "pixelated",
        }}
      />
      {selectedRoom && stats && (
        <RoomDetail
          roomId={selectedRoom as "lunary" | "spellcast" | "dev" | "meta"}
          stats={stats}
          heartbeat={heartbeat}
          onClose={() => setSelectedRoom(null)}
        />
      )}
    </>
  );
}
