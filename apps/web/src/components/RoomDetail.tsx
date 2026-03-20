"use client";

import type { DashboardStats, HeartbeatResponse } from "@/types/dashboard";
import Opportunities from "./Opportunities";

type RoomId = "lunary" | "spellcast" | "dev" | "meta";

interface Props {
  roomId: RoomId;
  stats: DashboardStats;
  heartbeat: HeartbeatResponse | null;
  onClose: () => void;
}

function TrendArrow({ value, suffix = "" }: { value?: number; suffix?: string }) {
  if (value === undefined || value === 0) return null;
  const color = value > 0 ? "#4ade80" : "#f87171";
  const arrow = value > 0 ? "\u25B2" : "\u25BC";
  return (
    <span style={{ color, fontSize: 6, marginLeft: 4 }}>
      {arrow} {Math.abs(value).toFixed(1)}{suffix}
    </span>
  );
}

function Stat({ label, value, trend, alert }: { label: string; value: string; trend?: number; alert?: boolean }) {
  return (
    <div style={{
      background: alert ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)",
      border: `1px solid ${alert ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.1)"}`,
      padding: "6px 8px",
    }}>
      <div style={{ fontFamily: "'Press Start 2P'", fontSize: 5, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "'Press Start 2P'", fontSize: 9, color: alert ? "#f87171" : "#fff" }}>
        {value}
        {trend !== undefined && <TrendArrow value={trend} />}
      </div>
    </div>
  );
}

function HealthDot({ status, label }: { status: string; label: string }) {
  const color = status === "ok" ? "#4ade80" : status === "degraded" ? "#facc15" : "#f87171";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 8, height: 8, background: color, border: "1px solid rgba(0,0,0,0.5)", boxShadow: `0 0 6px ${color}` }} />
      <span style={{ fontFamily: "'Press Start 2P'", fontSize: 6, color: "rgba(255,255,255,0.6)" }}>{label}</span>
      <span style={{ fontFamily: "'Press Start 2P'", fontSize: 5, color: "rgba(255,255,255,0.3)" }}>{status}</span>
    </div>
  );
}

function LunaryDetail({ stats }: { stats: DashboardStats }) {
  const trend = stats.trends;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
      <Stat label="MAU" value={String(stats.lunary.mau)} trend={trend?.mau?.delta} />
      <Stat label="DAU" value={String(stats.lunary.activeToday)} trend={trend?.dau?.delta} />
      <Stat label="MRR" value={`\u00A3${stats.lunary.mrr.toFixed(2)}`} trend={trend?.mrr?.delta} />
      <Stat label="SUBSCRIBERS" value={String(stats.lunary.subscribers)} />
      <div style={{ gridColumn: "1 / -1" }}>
        <HealthDot status={stats.health.lunary.status} label="LUNARY" />
        <div style={{ fontFamily: "'Press Start 2P'", fontSize: 5, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>
          {stats.health.lunary.latencyMs}ms latency
        </div>
      </div>
    </div>
  );
}

function SpellcastDetail({ stats }: { stats: DashboardStats }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
      <Stat label="POSTS TODAY" value={String(stats.spellcast.postsToday)} trend={stats.trends?.postsToday?.delta} />
      <Stat label="SCHEDULED TODAY" value={String(stats.content.scheduledToday)} />
      <Stat label="SCHED TOMORROW" value={String(stats.content.scheduledTomorrow)} />
      <Stat label="FAILED" value={String(stats.content.failedPosts)} alert={stats.content.failedPosts > 0} />
      <div style={{ gridColumn: "1 / -1" }}>
        <HealthDot status={stats.health.spellcast.status} label="SPELLCAST" />
      </div>
    </div>
  );
}

function DevDetail({ stats, heartbeat }: { stats: DashboardStats; heartbeat: HeartbeatResponse | null }) {
  const macStatus = heartbeat?.status ?? "no-data";
  const macColor = macStatus === "online" ? "#4ade80" : macStatus === "offline" ? "#f87171" : "#71717a";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
      <Stat label="COMMITS TODAY" value={String(stats.github.commitsToday)} />
      <Stat label="REPOS" value={String(stats.github.repos)} />
      <Stat label="FOLLOWERS" value={String(stats.github.followers)} />
      <div style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.1)",
        padding: "6px 8px",
      }}>
        <div style={{ fontFamily: "'Press Start 2P'", fontSize: 5, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>MAC</div>
        <div style={{ fontFamily: "'Press Start 2P'", fontSize: 9, color: macColor }}>{macStatus.toUpperCase()}</div>
      </div>
      <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 4 }}>
        <HealthDot status={stats.health.lunary.status} label="LUNARY" />
        <HealthDot status={stats.health.spellcast.status} label="SPELLCAST" />
        <HealthDot status={stats.health.contentCreator.status} label="CONTENT" />
      </div>
    </div>
  );
}

function MetaDetail({ stats }: { stats: DashboardStats }) {
  const seoTrend = stats.seo.trend;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <Stat label="IMPRESSIONS (7D)" value={stats.seo.impressions.toLocaleString()} trend={seoTrend?.impressions.pct} />
        <Stat label="CLICKS (7D)" value={String(stats.seo.clicks)} trend={seoTrend?.clicks.pct} />
        <Stat label="CTR" value={`${(stats.seo.ctr * 100).toFixed(1)}%`} />
        <Stat label="AVG POSITION" value={stats.seo.position.toFixed(1)} />
      </div>
      {stats.opportunities.length > 0 && (
        <div>
          <div style={{ fontFamily: "'Press Start 2P'", fontSize: 6, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>OPPORTUNITIES</div>
          <Opportunities stats={stats} />
        </div>
      )}
    </div>
  );
}

const ROOM_TITLES: Record<RoomId, { title: string; accent: string }> = {
  lunary: { title: "LUNARY OBSERVATORY", accent: "#c084fc" },
  spellcast: { title: "SPELLCAST COMMAND", accent: "#22d3ee" },
  dev: { title: "DEV DEN", accent: "#4ade80" },
  meta: { title: "META ANALYTICS", accent: "#f472b6" },
};

export default function RoomDetail({ roomId, stats, heartbeat, onClose }: Props) {
  const { title, accent } = ROOM_TITLES[roomId];

  return (
    <>
      {/* Backdrop */}
      <div
        className="room-detail-backdrop"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          zIndex: 45,
        }}
      />
      {/* Panel */}
      <div
        className="room-detail-panel"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: "60%",
          background: "rgba(10,10,15,0.96)",
          border: "2px solid rgba(255,255,255,0.1)",
          borderBottom: "none",
          borderRadius: "8px 8px 0 0",
          zIndex: 46,
          overflowY: "auto",
          padding: "12px 14px 24px",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div className="room-title" style={{ color: accent, fontSize: 10 }}>{title}</div>
          <button
            onClick={onClose}
            style={{
              fontFamily: "'Press Start 2P'",
              fontSize: 8,
              color: "rgba(255,255,255,0.4)",
              background: "none",
              border: "1px solid rgba(255,255,255,0.15)",
              padding: "4px 8px",
              cursor: "pointer",
            }}
          >
            X
          </button>
        </div>
        {/* Content */}
        {roomId === "lunary" && <LunaryDetail stats={stats} />}
        {roomId === "spellcast" && <SpellcastDetail stats={stats} />}
        {roomId === "dev" && <DevDetail stats={stats} heartbeat={heartbeat} />}
        {roomId === "meta" && <MetaDetail stats={stats} />}
        {/* Updated timestamp */}
        <div style={{ fontFamily: "'Press Start 2P'", fontSize: 5, color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: 12 }}>
          Updated {new Date(stats.updatedAt).toLocaleTimeString()}
        </div>
      </div>
    </>
  );
}
