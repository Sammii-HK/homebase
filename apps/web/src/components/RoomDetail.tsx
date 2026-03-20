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
    <span style={{ color, fontSize: 11, marginLeft: 6 }}>
      {arrow} {Math.abs(value).toFixed(1)}{suffix}
    </span>
  );
}

function Stat({ label, value, trend, alert }: { label: string; value: string; trend?: number; alert?: boolean }) {
  return (
    <div style={{
      background: alert ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)",
      border: `1px solid ${alert ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.1)"}`,
      padding: "10px 12px",
      borderRadius: 4,
    }}>
      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 16, color: alert ? "#f87171" : "#fff" }}>
        {value}
        {trend !== undefined && <TrendArrow value={trend} />}
      </div>
    </div>
  );
}

function HealthDot({ status, label }: { status: string; label: string }) {
  const color = status === "ok" ? "#4ade80" : status === "degraded" ? "#facc15" : "#f87171";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 10, height: 10, borderRadius: 2, background: color, border: "1px solid rgba(0,0,0,0.5)", boxShadow: `0 0 8px ${color}` }} />
      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 11, color: "rgba(255,255,255,0.7)" }}>{label}</span>
      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{status}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 8, letterSpacing: 1 }}>
      {children}
    </div>
  );
}

function SystemLink({ label, url, status }: { label: string; url: string; status?: "ok" | "degraded" | "down" | "unknown" }) {
  const dotColor = status === "ok" ? "#4ade80" : status === "degraded" ? "#facc15" : status === "down" ? "#f87171" : "#71717a";
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 4,
        textDecoration: "none",
        cursor: "pointer",
      }}
    >
      <div style={{ width: 8, height: 8, borderRadius: 2, background: dotColor, boxShadow: `0 0 6px ${dotColor}` }} />
      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: "rgba(255,255,255,0.7)", flex: 1 }}>{label}</span>
      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: "rgba(255,255,255,0.25)" }}>{url.replace(/^https?:\/\//, "")}</span>
    </a>
  );
}

function LunaryDetail({ stats }: { stats: DashboardStats }) {
  const trend = stats.trends;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      <Stat label="MAU" value={String(stats.lunary.mau)} trend={trend?.mau?.delta} />
      <Stat label="DAU" value={String(stats.lunary.activeToday)} trend={trend?.dau?.delta} />
      <Stat label="MRR" value={`\u00A3${stats.lunary.mrr.toFixed(2)}`} trend={trend?.mrr?.delta} />
      <Stat label="SUBSCRIBERS" value={String(stats.lunary.subscribers)} />
      <div style={{ gridColumn: "1 / -1", marginTop: 4 }}>
        <HealthDot status={stats.health.lunary.status} label="LUNARY" />
        {stats.health.lunary.latencyMs > 0 && (
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "rgba(255,255,255,0.25)", marginTop: 4, marginLeft: 18 }}>
            {stats.health.lunary.latencyMs}ms latency
          </div>
        )}
      </div>
    </div>
  );
}

function SpellcastDetail({ stats }: { stats: DashboardStats }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      <Stat label="POSTS TODAY" value={String(stats.spellcast.postsToday)} trend={stats.trends?.postsToday?.delta} />
      <Stat label="SCHEDULED TODAY" value={String(stats.content.scheduledToday)} />
      <Stat label="SCHED TOMORROW" value={String(stats.content.scheduledTomorrow)} />
      <Stat label="FAILED" value={String(stats.content.failedPosts)} alert={stats.content.failedPosts > 0} />
      <div style={{ gridColumn: "1 / -1", marginTop: 4 }}>
        <HealthDot status={stats.health.spellcast.status} label="SPELLCAST" />
      </div>
    </div>
  );
}

function DevDetail({ stats, heartbeat }: { stats: DashboardStats; heartbeat: HeartbeatResponse | null }) {
  const macStatus = heartbeat?.status ?? "no-data";
  const macColor = macStatus === "online" ? "#4ade80" : macStatus === "offline" ? "#f87171" : "#71717a";
  const systemsUp = [
    stats.health.lunary.status !== "down",
    stats.health.spellcast.status !== "down",
    stats.health.contentCreator.status !== "down",
  ].filter(Boolean).length;
  const allHealthy = systemsUp === 3;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* System overview */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Stat label="SYSTEMS" value={`${systemsUp}/3 UP`} alert={systemsUp < 3} />
        <div style={{
          background: allHealthy ? "rgba(74,222,128,0.08)" : "rgba(239,68,68,0.15)",
          border: `1px solid ${allHealthy ? "rgba(74,222,128,0.2)" : "rgba(239,68,68,0.3)"}`,
          padding: "10px 12px",
          borderRadius: 4,
        }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>STATUS</div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 16, color: allHealthy ? "#4ade80" : "#f87171" }}>
            {allHealthy ? "ALL OK" : "ALERT"}
          </div>
        </div>
      </div>

      {/* Service health */}
      <div>
        <SectionLabel>SERVICES</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <HealthDot status={stats.health.lunary.status} label="LUNARY" />
          {stats.health.lunary.latencyMs > 0 && (
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "rgba(255,255,255,0.25)", marginLeft: 18 }}>
              {stats.health.lunary.latencyMs}ms
            </div>
          )}
          <HealthDot status={stats.health.spellcast.status} label="SPELLCAST" />
          {stats.health.spellcast.latencyMs > 0 && (
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "rgba(255,255,255,0.25)", marginLeft: 18 }}>
              {stats.health.spellcast.latencyMs}ms
            </div>
          )}
          <HealthDot status={stats.health.contentCreator.status} label="CONTENT CREATOR" />
        </div>
      </div>

      {/* Workstation */}
      <div>
        <SectionLabel>WORKSTATION</SectionLabel>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: macColor, border: "1px solid rgba(0,0,0,0.5)", boxShadow: `0 0 8px ${macColor}` }} />
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 11, color: "rgba(255,255,255,0.7)" }}>MAC</span>
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{macStatus}</span>
        </div>
      </div>

      {/* Pipeline */}
      <div>
        <SectionLabel>PIPELINE</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <Stat label="FAILED" value={String(stats.content.failedPosts)} alert={stats.content.failedPosts > 0} />
          <Stat label="TODAY" value={String(stats.content.scheduledToday)} />
          <Stat label="TMRW" value={String(stats.content.scheduledTomorrow)} />
        </div>
      </div>

      {/* System links */}
      <div>
        <SectionLabel>ORCHESTRATION</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <SystemLink label="n8n" url="http://localhost:5678" status="unknown" />
          <SystemLink label="WINDMILL" url="http://localhost:8100" status="unknown" />
          <SystemLink label="CONTENT CREATOR" url="https://content.sammii.dev" status={stats.health.contentCreator.status} />
          <SystemLink label="OPEN WEBUI" url="http://localhost:8080" status="unknown" />
        </div>
      </div>
    </div>
  );
}

function MetaDetail({ stats }: { stats: DashboardStats }) {
  const seoTrend = stats.seo.trend;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Stat label="IMPRESSIONS (7D)" value={stats.seo.impressions.toLocaleString()} trend={seoTrend?.impressions.pct} />
        <Stat label="CLICKS (7D)" value={String(stats.seo.clicks)} trend={seoTrend?.clicks.pct} />
        <Stat label="CTR" value={`${(stats.seo.ctr * 100).toFixed(1)}%`} />
        <Stat label="AVG POSITION" value={stats.seo.position.toFixed(1)} />
      </div>
      {stats.opportunities.length > 0 && (
        <div>
          <SectionLabel>OPPORTUNITIES</SectionLabel>
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
          borderRadius: "12px 12px 0 0",
          zIndex: 46,
          overflowY: "auto",
          padding: "16px 18px 28px",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div className="room-title" style={{ color: accent, fontSize: 16, fontFamily: "'Press Start 2P', monospace" }}>{title}</div>
          <button
            onClick={onClose}
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 12,
              color: "rgba(255,255,255,0.5)",
              background: "none",
              border: "1px solid rgba(255,255,255,0.2)",
              padding: "6px 12px",
              borderRadius: 4,
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
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: 16 }}>
          Updated {new Date(stats.updatedAt).toLocaleTimeString()}
        </div>
      </div>
    </>
  );
}
