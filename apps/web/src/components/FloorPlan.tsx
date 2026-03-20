"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useActivityStream } from "@/hooks/useActivityStream";
import type { DashboardStats, HeartbeatResponse } from "@/types/dashboard";
import type { ClickTarget, IsleStats, BadgeInfo } from "./isle/types";
import { IsleRenderer } from "./isle/renderer";
import RoomDetail from "./RoomDetail";

// ── Badge logic (numeric counts) ──

function getRoomBadge(
  roomKey: string,
  stats: DashboardStats | null,
  heartbeat: HeartbeatResponse | null,
): BadgeInfo {
  if (!stats) return { alert: false };
  switch (roomKey) {
    case "lunary":
      return { alert: stats.health.lunary.status === "down" };
    case "spellcast": {
      const failed = stats.content.failedPosts;
      return { alert: failed > 0 || stats.health.spellcast.status === "down", count: failed || undefined };
    }
    case "dev": {
      const down = [
        stats.health.lunary.status === "down",
        stats.health.spellcast.status === "down",
        stats.health.contentCreator.status === "down",
      ].filter(Boolean).length;
      return {
        alert: heartbeat?.status === "offline" || down > 0,
        count: down || undefined,
      };
    }
    case "meta": {
      const opps = stats.opportunities.length;
      return {
        alert: opps > 0 || (stats.seo.trend !== null && stats.seo.trend.clicks.pct < -10),
        count: opps || undefined,
      };
    }
    default:
      return { alert: false };
  }
}

// ── FloorPlan — canvas wrapper ──

type RoomId = "lunary" | "spellcast" | "dev" | "meta" | "orbit" | "engagement";

interface FloorPlanProps {
  stats: DashboardStats | null;
  heartbeat: HeartbeatResponse | null;
  token: string;
  selectedRoom?: RoomId | null;
  onRoomChange?: (room: RoomId | null) => void;
}

export default function FloorPlan({ stats, heartbeat, token, selectedRoom: externalRoom, onRoomChange }: FloorPlanProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<IsleRenderer | null>(null);
  const activity = useActivityStream();
  const [internalRoom, setInternalRoom] = useState<string | null>(null);
  const statsRef = useRef(stats);
  statsRef.current = stats;

  // Use external state if provided, otherwise fall back to internal
  const selectedRoom = externalRoom !== undefined ? externalRoom : internalRoom;
  const setSelectedRoom = onRoomChange ?? setInternalRoom;

  // Stable click handler — uses ref so renderer never gets recreated
  const handleClick = useCallback((target: ClickTarget) => {
    if (statsRef.current) {
      if (onRoomChange) onRoomChange(target.roomKey);
      else setInternalRoom(target.roomKey);
    }
  }, [onRoomChange]);

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
      engagement: {
        unread: stats?.engagement.unread ?? 0,
        total: stats?.engagement.total ?? 0,
      },
      orbit: {
        online: stats?.orbit?.online ?? false,
        runningAgents: stats?.orbit?.runningAgents ?? 0,
        errorAgents: stats?.orbit?.errorAgents ?? 0,
        pipelineRunning: stats?.orbit?.pipelineRunning ?? false,
      },
      content: {
        pendingReview: stats?.content.pendingReview ?? 0,
        failedPosts: stats?.content.failedPosts ?? 0,
        scheduledToday: stats?.content.scheduledToday ?? 0,
        scheduledTomorrow: stats?.content.scheduledTomorrow ?? 0,
      },
      seo: {
        clicks: stats?.seo.clicks ?? 0,
        impressions: stats?.seo.impressions ?? 0,
        ctr: stats?.seo.ctr ?? 0,
      },
      github: {
        commitsToday: stats?.github.commitsToday ?? 0,
      },
      badges: {
        lunary: getRoomBadge("lunary", stats, heartbeat),
        spellcast: getRoomBadge("spellcast", stats, heartbeat),
        dev: getRoomBadge("dev", stats, heartbeat),
        meta: getRoomBadge("meta", stats, heartbeat),
      } as Record<string, import("./isle/types").BadgeInfo>,
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
          roomId={selectedRoom as RoomId}
          stats={stats}
          heartbeat={heartbeat}
          token={token}
          onClose={() => setSelectedRoom(null)}
        />
      )}
    </>
  );
}
