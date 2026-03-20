"use client";

import { useState } from "react";
import type {
  DashboardStats,
  HeartbeatResponse,
  FailedPost,
  SpellcastDeepData,
  LunaryDeepData,
  InfraDeepData,
  OrbitDeepData,
  EngagementDeepData,
} from "@/types/dashboard";
import { useRoomData } from "@/hooks/useRoomData";
import Opportunities from "./Opportunities";
import RoomTabs from "./RoomTabs";
import Sparkline from "./viz/Sparkline";
import ProgressBar from "./viz/ProgressBar";
import MiniCalendar from "./viz/MiniCalendar";
import StatusTimeline from "./viz/StatusTimeline";

type RoomId = "lunary" | "spellcast" | "dev" | "meta" | "orbit" | "engagement";

interface Props {
  roomId: RoomId;
  stats: DashboardStats;
  heartbeat: HeartbeatResponse | null;
  onClose: () => void;
}

// ── Shared primitives ──

const PS2P = "'Press Start 2P', monospace";

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
      <div style={{ fontFamily: PS2P, fontSize: 9, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: PS2P, fontSize: 16, color: alert ? "#f87171" : "#fff" }}>
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
      <span style={{ fontFamily: PS2P, fontSize: 11, color: "rgba(255,255,255,0.7)" }}>{label}</span>
      <span style={{ fontFamily: PS2P, fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{status}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{ fontFamily: PS2P, fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 8, letterSpacing: 1 }}>
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
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 10px",
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 4, textDecoration: "none", cursor: "pointer",
      }}
    >
      <div style={{ width: 8, height: 8, borderRadius: 2, background: dotColor, boxShadow: `0 0 6px ${dotColor}` }} />
      <span style={{ fontFamily: PS2P, fontSize: 10, color: "rgba(255,255,255,0.7)", flex: 1 }}>{label}</span>
      <span style={{ fontFamily: PS2P, fontSize: 8, color: "rgba(255,255,255,0.25)" }}>{url.replace(/^https?:\/\//, "")}</span>
    </a>
  );
}

function LoadingState() {
  return (
    <div style={{ textAlign: "center", padding: 20 }}>
      <div style={{ fontFamily: PS2P, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>LOADING...</div>
    </div>
  );
}

// ── Failed posts list ──

function FailedPostsList({ posts, spellcastUrl }: { posts: FailedPost[]; spellcastUrl?: string }) {
  if (posts.length === 0) {
    return <div style={{ fontFamily: PS2P, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>No failed posts</div>;
  }

  const PLATFORM_COLORS: Record<string, string> = {
    threads: "#fff", instagram: "#f472b6", twitter: "#60a5fa", x: "#60a5fa",
    tiktok: "#22d3ee", linkedin: "#93c5fd", reddit: "#fb923c",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {posts.map((post) => (
        <div
          key={post.id}
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 4, padding: "8px 10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ fontFamily: PS2P, fontSize: 7, color: PLATFORM_COLORS[post.platform] ?? "#999", textTransform: "uppercase" }}>
              {post.platform}
            </span>
            {post.scheduledFor && (
              <span style={{ fontFamily: PS2P, fontSize: 7, color: "rgba(255,255,255,0.25)" }}>
                {new Date(post.scheduledFor).toLocaleDateString()}
              </span>
            )}
          </div>
          <div style={{ fontFamily: PS2P, fontSize: 8, color: "rgba(255,255,255,0.5)", marginBottom: 4, lineHeight: 1.4 }}>
            {post.content || "No content preview"}
          </div>
          <div style={{ fontFamily: PS2P, fontSize: 7, color: "#f87171" }}>
            {post.error}
          </div>
          {spellcastUrl && (
            <a
              href={`${spellcastUrl}/posts/${post.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block", marginTop: 6,
                fontFamily: PS2P, fontSize: 7, color: "#22d3ee",
                textDecoration: "none",
              }}
            >
              OPEN IN SPELLCAST
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Lunary detail (tabbed) ──

const LUNARY_TABS = ["OVERVIEW", "FUNNEL", "FEATURES", "REVENUE", "SUBS", "A/B TESTS", "TRAFFIC"];

function LunaryDetail({ stats, deepData, loading }: { stats: DashboardStats; deepData: LunaryDeepData | null; loading: boolean }) {
  const [tab, setTab] = useState("OVERVIEW");
  const trend = stats.trends;

  return (
    <div>
      <RoomTabs tabs={LUNARY_TABS} active={tab} accent="#c084fc" onChange={setTab} />

      {tab === "OVERVIEW" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Stat label="MAU" value={String(stats.lunary.mau)} trend={trend?.mau?.delta} />
            <Stat label="DAU" value={String(stats.lunary.activeToday)} trend={trend?.dau?.delta} />
            <Stat label="MRR" value={`\u00A3${stats.lunary.mrr.toFixed(2)}`} trend={trend?.mrr?.delta} />
            <Stat label="SUBSCRIBERS" value={String(stats.lunary.subscribers)} />
          </div>
          {deepData?.dauSeries && deepData.dauSeries.length > 1 && (
            <div>
              <SectionLabel>DAU (7D)</SectionLabel>
              <Sparkline data={deepData.dauSeries.map(d => d.value)} color="#c084fc" showDots />
            </div>
          )}
          <HealthDot status={stats.health.lunary.status} label="LUNARY" />
          {stats.health.lunary.latencyMs > 0 && (
            <div style={{ fontFamily: PS2P, fontSize: 9, color: "rgba(255,255,255,0.25)", marginLeft: 18 }}>
              {stats.health.lunary.latencyMs}ms latency
            </div>
          )}
          {loading && <LoadingState />}
        </div>
      )}

      {tab === "FUNNEL" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {loading && <LoadingState />}
          {deepData?.conversions && deepData.conversions.length > 0 ? (
            deepData.conversions.map((step) => (
              <ProgressBar key={step.step} label={step.step} value={step.count} max={deepData.conversions[0].count} color="#c084fc" />
            ))
          ) : !loading ? (
            <div style={{ fontFamily: PS2P, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>No funnel data available</div>
          ) : null}
        </div>
      )}

      {tab === "FEATURES" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {loading && <LoadingState />}
          {deepData?.featureAdoption && deepData.featureAdoption.length > 0 ? (
            deepData.featureAdoption.map((f) => (
              <ProgressBar key={f.feature} label={f.feature} value={f.users} max={stats.lunary.mau || 1} color="#c084fc" />
            ))
          ) : !loading ? (
            <div style={{ fontFamily: PS2P, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>No feature data available</div>
          ) : null}
        </div>
      )}

      {tab === "REVENUE" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {loading && <LoadingState />}
          {deepData?.revenue && deepData.revenue.length > 0 ? (
            deepData.revenue.map((p) => (
              <div key={p.plan} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 10px", background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4,
              }}>
                <span style={{ fontFamily: PS2P, fontSize: 9, color: "rgba(255,255,255,0.6)" }}>{p.plan}</span>
                <span style={{ fontFamily: PS2P, fontSize: 9, color: "#c084fc" }}>{p.count} subs</span>
                <span style={{ fontFamily: PS2P, fontSize: 9, color: "#fff" }}>{"\u00A3"}{p.mrr.toFixed(2)}/mo</span>
              </div>
            ))
          ) : !loading ? (
            <div style={{ fontFamily: PS2P, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>No revenue data available</div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ── Spellcast detail (tabbed) ──

const SPELLCAST_TABS = ["OVERVIEW", "FAILED", "CALENDAR", "VELOCITY"];

function SpellcastDetail({ stats, deepData, loading }: { stats: DashboardStats; deepData: SpellcastDeepData | null; loading: boolean }) {
  const [tab, setTab] = useState("OVERVIEW");

  // Use deep data failed posts if available, fall back to stats
  const failedPosts = deepData?.failedPosts ?? stats.content.failedPostDetails ?? [];

  return (
    <div>
      <RoomTabs tabs={SPELLCAST_TABS} active={tab} accent="#22d3ee" onChange={setTab} />

      {tab === "OVERVIEW" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Stat label="POSTS TODAY" value={String(stats.spellcast.postsToday)} trend={stats.trends?.postsToday?.delta} />
            <Stat label="SCHEDULED TODAY" value={String(stats.content.scheduledToday)} />
            <Stat label="SCHED TOMORROW" value={String(stats.content.scheduledTomorrow)} />
            <Stat label="FAILED" value={String(stats.content.failedPosts)} alert={stats.content.failedPosts > 0} />
          </div>
          {stats.spellcast.queueDepth > 0 && (
            <ProgressBar label="48H QUEUE" value={stats.spellcast.queueDepth} max={20} color="#22d3ee" />
          )}
          {deepData?.engagement && deepData.engagement.unread > 0 && (
            <Stat label="UNREAD ENGAGEMENT" value={String(deepData.engagement.unread)} alert />
          )}
          <HealthDot status={stats.health.spellcast.status} label="SPELLCAST" />
          {loading && <LoadingState />}
        </div>
      )}

      {tab === "FAILED" && (
        <div>
          <FailedPostsList posts={failedPosts} spellcastUrl="https://spellcast.sammii.dev" />
          {loading && <LoadingState />}
        </div>
      )}

      {tab === "CALENDAR" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {loading && <LoadingState />}
          {deepData?.calendar ? (
            <MiniCalendar days={deepData.calendar} />
          ) : !loading ? (
            <div style={{ fontFamily: PS2P, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>No calendar data available</div>
          ) : null}
          {deepData?.queueByDay && deepData.queueByDay.length > 0 && (
            <div>
              <SectionLabel>QUEUE BY DAY</SectionLabel>
              <Sparkline data={deepData.queueByDay.map(d => d.count)} color="#22d3ee" width={200} height={40} showDots />
            </div>
          )}
        </div>
      )}

      {tab === "VELOCITY" && (
        <div>
          {loading && <LoadingState />}
          {deepData?.velocity && deepData.velocity.length > 0 ? (
            <div>
              <SectionLabel>POST VELOCITY (48H)</SectionLabel>
              <Sparkline data={deepData.velocity.map(d => d.count)} color="#22d3ee" width={200} height={50} />
            </div>
          ) : !loading ? (
            <div style={{ fontFamily: PS2P, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>No velocity data available</div>
          ) : null}
          {deepData?.autopilot && (
            <div style={{ marginTop: 12 }}>
              <SectionLabel>AUTOPILOT</SectionLabel>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: 2,
                  background: deepData.autopilot.enabled ? "#4ade80" : "#71717a",
                  boxShadow: deepData.autopilot.enabled ? "0 0 6px #4ade80" : "none",
                }} />
                <span style={{ fontFamily: PS2P, fontSize: 9, color: "rgba(255,255,255,0.6)" }}>
                  {deepData.autopilot.enabled ? "ACTIVE" : "OFF"}
                </span>
                {deepData.autopilot.lastRun && (
                  <span style={{ fontFamily: PS2P, fontSize: 7, color: "rgba(255,255,255,0.25)" }}>
                    Last: {new Date(deepData.autopilot.lastRun).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Dev detail (tabbed) ──

const DEV_TABS = ["SERVICES", "WORKFLOWS", "LINKS"];

function DevDetail({ stats, heartbeat, deepData, loading }: {
  stats: DashboardStats;
  heartbeat: HeartbeatResponse | null;
  deepData: InfraDeepData | null;
  loading: boolean;
}) {
  const [tab, setTab] = useState("SERVICES");
  const macStatus = heartbeat?.status ?? "no-data";
  const macColor = macStatus === "online" ? "#4ade80" : macStatus === "offline" ? "#f87171" : "#71717a";
  const systemsUp = [
    stats.health.lunary.status !== "down",
    stats.health.spellcast.status !== "down",
    stats.health.contentCreator.status !== "down",
  ].filter(Boolean).length;
  const allHealthy = systemsUp === 3;

  return (
    <div>
      <RoomTabs tabs={DEV_TABS} active={tab} accent="#4ade80" onChange={setTab} />

      {tab === "SERVICES" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Stat label="SYSTEMS" value={`${systemsUp}/3 UP`} alert={systemsUp < 3} />
            <div style={{
              background: allHealthy ? "rgba(74,222,128,0.08)" : "rgba(239,68,68,0.15)",
              border: `1px solid ${allHealthy ? "rgba(74,222,128,0.2)" : "rgba(239,68,68,0.3)"}`,
              padding: "10px 12px", borderRadius: 4,
            }}>
              <div style={{ fontFamily: PS2P, fontSize: 9, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>STATUS</div>
              <div style={{ fontFamily: PS2P, fontSize: 16, color: allHealthy ? "#4ade80" : "#f87171" }}>
                {allHealthy ? "ALL OK" : "ALERT"}
              </div>
            </div>
          </div>
          <div>
            <SectionLabel>SERVICES</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <HealthDot status={stats.health.lunary.status} label="LUNARY" />
              {stats.health.lunary.latencyMs > 0 && (
                <div style={{ fontFamily: PS2P, fontSize: 9, color: "rgba(255,255,255,0.25)", marginLeft: 18 }}>{stats.health.lunary.latencyMs}ms</div>
              )}
              <HealthDot status={stats.health.spellcast.status} label="SPELLCAST" />
              {stats.health.spellcast.latencyMs > 0 && (
                <div style={{ fontFamily: PS2P, fontSize: 9, color: "rgba(255,255,255,0.25)", marginLeft: 18 }}>{stats.health.spellcast.latencyMs}ms</div>
              )}
              <HealthDot status={stats.health.contentCreator.status} label="CONTENT CREATOR" />
            </div>
          </div>
          {deepData?.healthHistory && deepData.healthHistory.length > 0 && (
            <StatusTimeline segments={deepData.healthHistory} service="lunary" />
          )}
          <div>
            <SectionLabel>WORKSTATION</SectionLabel>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: macColor, border: "1px solid rgba(0,0,0,0.5)", boxShadow: `0 0 8px ${macColor}` }} />
              <span style={{ fontFamily: PS2P, fontSize: 11, color: "rgba(255,255,255,0.7)" }}>MAC</span>
              <span style={{ fontFamily: PS2P, fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{macStatus}</span>
            </div>
          </div>
          <div>
            <SectionLabel>PIPELINE</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <Stat label="FAILED" value={String(stats.content.failedPosts)} alert={stats.content.failedPosts > 0} />
              <Stat label="TODAY" value={String(stats.content.scheduledToday)} />
              <Stat label="TMRW" value={String(stats.content.scheduledTomorrow)} />
            </div>
          </div>
          {loading && <LoadingState />}
        </div>
      )}

      {tab === "WORKFLOWS" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {loading && <LoadingState />}
          {deepData?.recentWorkflows && deepData.recentWorkflows.length > 0 ? (
            deepData.recentWorkflows.map((wf) => {
              const statusColor = wf.status === "success" ? "#4ade80" : wf.status === "error" ? "#f87171" : wf.status === "running" ? "#facc15" : "#71717a";
              return (
                <div key={wf.id} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 10px", background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: statusColor, boxShadow: `0 0 4px ${statusColor}` }} />
                  <span style={{ fontFamily: PS2P, fontSize: 8, color: "rgba(255,255,255,0.7)", flex: 1 }}>{wf.name}</span>
                  <span style={{ fontFamily: PS2P, fontSize: 7, color: "rgba(255,255,255,0.25)" }}>
                    {wf.startedAt ? new Date(wf.startedAt).toLocaleTimeString() : ""}
                  </span>
                </div>
              );
            })
          ) : !loading ? (
            <div style={{ fontFamily: PS2P, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>No recent workflows</div>
          ) : null}
        </div>
      )}

      {tab === "LINKS" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <SystemLink label="n8n" url="http://localhost:5678" status="unknown" />
          <SystemLink label="WINDMILL" url="http://localhost:8100" status="unknown" />
          <SystemLink label="CONTENT CREATOR" url="https://content.sammii.dev" status={stats.health.contentCreator.status} />
          <SystemLink label="OPEN WEBUI" url="http://localhost:8080" status="unknown" />
        </div>
      )}
    </div>
  );
}

// ── Meta detail (tabbed) ──

const META_TABS = ["SEO", "OPPORTUNITIES"];

function MetaDetail({ stats }: { stats: DashboardStats }) {
  const [tab, setTab] = useState("SEO");
  const seoTrend = stats.seo.trend;

  return (
    <div>
      <RoomTabs tabs={META_TABS} active={tab} accent="#f472b6" onChange={setTab} />

      {tab === "SEO" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Stat label="IMPRESSIONS (7D)" value={stats.seo.impressions.toLocaleString()} trend={seoTrend?.impressions.pct} />
          <Stat label="CLICKS (7D)" value={String(stats.seo.clicks)} trend={seoTrend?.clicks.pct} />
          <Stat label="CTR" value={`${(stats.seo.ctr * 100).toFixed(1)}%`} />
          <Stat label="AVG POSITION" value={stats.seo.position.toFixed(1)} />
        </div>
      )}

      {tab === "OPPORTUNITIES" && (
        <div>
          {stats.opportunities.length > 0 ? (
            <Opportunities stats={stats} />
          ) : (
            <div style={{ fontFamily: PS2P, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>No new opportunities</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main room detail panel ──

const ROOM_TITLES: Record<RoomId, { title: string; accent: string }> = {
  lunary: { title: "LUNARY OBSERVATORY", accent: "#c084fc" },
  spellcast: { title: "SPELLCAST COMMAND", accent: "#22d3ee" },
  dev: { title: "DEV DEN", accent: "#4ade80" },
  meta: { title: "META ANALYTICS", accent: "#f472b6" },
};

export default function RoomDetail({ roomId, stats, heartbeat, onClose }: Props) {
  const { title, accent } = ROOM_TITLES[roomId];
  const deepRoomId = roomId === "dev" ? "infra" : roomId === "meta" ? null : roomId;
  const { data: deepData, loading } = useRoomData(deepRoomId);

  return (
    <>
      {/* Backdrop */}
      <div
        className="room-detail-backdrop"
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
          zIndex: 45,
        }}
      />
      {/* Panel */}
      <div
        className="room-detail-panel"
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, height: "60%",
          background: "rgba(10,10,15,0.96)",
          border: "2px solid rgba(255,255,255,0.1)", borderBottom: "none",
          borderRadius: "12px 12px 0 0", zIndex: 46,
          overflowY: "auto", padding: "16px 18px 28px",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div className="room-title" style={{ color: accent, fontSize: 16, fontFamily: PS2P }}>{title}</div>
          <button
            onClick={onClose}
            style={{
              fontFamily: PS2P, fontSize: 12,
              color: "rgba(255,255,255,0.5)", background: "none",
              border: "1px solid rgba(255,255,255,0.2)",
              padding: "6px 12px", borderRadius: 4, cursor: "pointer",
            }}
          >
            X
          </button>
        </div>

        {/* Content */}
        {roomId === "lunary" && <LunaryDetail stats={stats} deepData={deepData as LunaryDeepData | null} loading={loading} />}
        {roomId === "spellcast" && <SpellcastDetail stats={stats} deepData={deepData as SpellcastDeepData | null} loading={loading} />}
        {roomId === "dev" && <DevDetail stats={stats} heartbeat={heartbeat} deepData={deepData as InfraDeepData | null} loading={loading} />}
        {roomId === "meta" && <MetaDetail stats={stats} />}

        {/* Updated timestamp */}
        <div style={{ fontFamily: PS2P, fontSize: 9, color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: 16 }}>
          Updated {new Date(stats.updatedAt).toLocaleTimeString()}
        </div>
      </div>
    </>
  );
}
