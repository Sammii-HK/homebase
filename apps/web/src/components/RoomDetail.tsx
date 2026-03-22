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
import ApprovalQueue from "./ApprovalQueue";
import EngagementQueue from "./EngagementQueue";
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
  token: string;
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
      background: alert ? "rgba(239,68,68,0.15)" : "var(--hb-04)",
      border: `1px solid ${alert ? "rgba(239,68,68,0.3)" : "var(--hb-10)"}`,
      padding: "10px 12px",
      borderRadius: 4,
    }}>
      <div style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-45)", marginBottom: 6 }}>{label}</div>
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
      <div style={{ width: 10, height: 10, borderRadius: 2, background: color, border: "1px solid var(--hb-panel-50)", boxShadow: `0 0 8px ${color}` }} />
      <span style={{ fontFamily: PS2P, fontSize: 11, color: "var(--hb-70)" }}>{label}</span>
      <span style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-35)" }}>{status}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{ fontFamily: PS2P, fontSize: 10, color: "var(--hb-40)", marginBottom: 8, letterSpacing: 1 }}>
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
        background: "var(--hb-03)", border: "1px solid var(--hb-08)",
        borderRadius: 4, textDecoration: "none", cursor: "pointer",
      }}
    >
      <div style={{ width: 8, height: 8, borderRadius: 2, background: dotColor, boxShadow: `0 0 6px ${dotColor}` }} />
      <span style={{ fontFamily: PS2P, fontSize: 10, color: "var(--hb-70)", flex: 1 }}>{label}</span>
      <span style={{ fontFamily: PS2P, fontSize: 8, color: "var(--hb-25)" }}>{url.replace(/^https?:\/\//, "")}</span>
    </a>
  );
}

function LoadingState() {
  return (
    <div style={{ textAlign: "center", padding: 20 }}>
      <div style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-30)" }}>LOADING...</div>
    </div>
  );
}

// ── Failed posts list ──

function FailedPostsList({ posts, spellcastUrl }: { posts: FailedPost[]; spellcastUrl?: string }) {
  if (posts.length === 0) {
    return <div style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-30)" }}>No failed posts</div>;
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
              <span style={{ fontFamily: PS2P, fontSize: 7, color: "var(--hb-25)" }}>
                {new Date(post.scheduledFor).toLocaleDateString()}
              </span>
            )}
          </div>
          <div style={{ fontFamily: PS2P, fontSize: 8, color: "var(--hb-50)", marginBottom: 4, lineHeight: 1.4 }}>
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
            <Stat label="DAU (LAST FULL DAY)" value={String(stats.lunary.activeToday)} trend={trend?.dau?.delta} />
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
            <div style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-25)", marginLeft: 18 }}>
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
            <div style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-30)" }}>No funnel data available</div>
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
            <div style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-30)" }}>No feature data available</div>
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
                padding: "8px 10px", background: "var(--hb-04)",
                border: "1px solid var(--hb-10)", borderRadius: 4,
              }}>
                <span style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-60)" }}>{p.plan}</span>
                <span style={{ fontFamily: PS2P, fontSize: 9, color: "#c084fc" }}>{p.count} subs</span>
                <span style={{ fontFamily: PS2P, fontSize: 9, color: "#fff" }}>{"\u00A3"}{p.mrr.toFixed(2)}/mo</span>
              </div>
            ))
          ) : !loading ? (
            <div style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-30)" }}>No revenue data available</div>
          ) : null}
          {deepData?.aiCosts && (
            <div style={{ marginTop: 8 }}>
              <SectionLabel>AI COSTS</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Stat label="GENERATIONS" value={String(deepData.aiCosts.totalGenerations)} />
                <Stat label="EST. COST" value={`£${deepData.aiCosts.estimatedCost.toFixed(2)}`} />
                <Stat label="COST/USER" value={`£${deepData.aiCosts.costPerUser.toFixed(3)}`} />
                <Stat label="REV:COST" value={`${deepData.aiCosts.revenueCostRatio.toFixed(1)}x`} alert={deepData.aiCosts.revenueCostRatio < 2} />
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "SUBS" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {loading && <LoadingState />}
          {deepData?.subscriptionLifecycle ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Stat label="ACTIVE" value={String(deepData.subscriptionLifecycle.active)} />
                <Stat label="TRIAL" value={String(deepData.subscriptionLifecycle.trial)} />
                <Stat label="CANCELLED" value={String(deepData.subscriptionLifecycle.cancelled)} alert={deepData.subscriptionLifecycle.cancelled > 5} />
                <Stat label="CHURN RATE" value={`${deepData.subscriptionLifecycle.churnRate.toFixed(1)}%`} alert={deepData.subscriptionLifecycle.churnRate > 10} />
              </div>
              <Stat label="AVG DURATION" value={`${deepData.subscriptionLifecycle.avgDurationDays.toFixed(0)} days`} />
            </>
          ) : !loading ? (
            <div style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-30)" }}>No subscription data</div>
          ) : null}
          {deepData?.activation && (
            <div style={{ marginTop: 4 }}>
              <SectionLabel>ACTIVATION</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Stat label="TRIAL SIGNUPS" value={String(deepData.activation.trialSignups)} />
                <Stat label="TRIAL CVR" value={`${deepData.activation.trialConversionRate.toFixed(1)}%`} />
                <Stat label="PAID USERS" value={String(deepData.activation.paidUsers)} />
                <Stat label="DAYS TO TRIAL" value={`${deepData.activation.avgDaysToTrial.toFixed(0)}d`} />
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "A/B TESTS" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {loading && <LoadingState />}
          {deepData?.abTests && deepData.abTests.length > 0 ? (
            deepData.abTests.map((t) => {
              const sigColor = t.isSignificant ? "#4ade80" : "#facc15";
              return (
                <div key={t.testName} style={{
                  padding: "10px 12px", background: "var(--hb-04)",
                  border: `1px solid ${t.isSignificant ? "rgba(74,222,128,0.2)" : "var(--hb-10)"}`,
                  borderRadius: 4,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontFamily: PS2P, fontSize: 8, color: "var(--hb-70)" }}>{t.testName}</span>
                    <span style={{ fontFamily: PS2P, fontSize: 7, color: sigColor }}>
                      {t.isSignificant ? "SIGNIFICANT" : `${t.confidence.toFixed(0)}% conf`}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <span style={{ fontFamily: PS2P, fontSize: 8, color: "#c084fc" }}>
                      Winner: {t.bestVariant || "—"}
                    </span>
                    {t.improvement > 0 && (
                      <span style={{ fontFamily: PS2P, fontSize: 8, color: "#4ade80" }}>
                        +{t.improvement.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : !loading ? (
            <div style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-30)" }}>No A/B tests running</div>
          ) : null}
        </div>
      )}

      {tab === "TRAFFIC" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {loading && <LoadingState />}
          {deepData?.attribution && deepData.attribution.length > 0 ? (
            <>
              <SectionLabel>SIGNUP SOURCES</SectionLabel>
              {deepData.attribution.map((a) => (
                <ProgressBar key={a.source} label={a.source} value={a.count} max={deepData.attribution[0].count} color="#c084fc" />
              ))}
            </>
          ) : !loading ? (
            <div style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-30)" }}>No attribution data</div>
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
            <div style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-30)" }}>No calendar data available</div>
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
            <div style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-30)" }}>No velocity data available</div>
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
                <span style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-60)" }}>
                  {deepData.autopilot.enabled ? "ACTIVE" : "OFF"}
                </span>
                {deepData.autopilot.lastRun && (
                  <span style={{ fontFamily: PS2P, fontSize: 7, color: "var(--hb-25)" }}>
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
              <div style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-45)", marginBottom: 6 }}>STATUS</div>
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
                <div style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-25)", marginLeft: 18 }}>{stats.health.lunary.latencyMs}ms</div>
              )}
              <HealthDot status={stats.health.spellcast.status} label="SPELLCAST" />
              {stats.health.spellcast.latencyMs > 0 && (
                <div style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-25)", marginLeft: 18 }}>{stats.health.spellcast.latencyMs}ms</div>
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
              <div style={{ width: 10, height: 10, borderRadius: 2, background: macColor, border: "1px solid var(--hb-panel-50)", boxShadow: `0 0 8px ${macColor}` }} />
              <span style={{ fontFamily: PS2P, fontSize: 11, color: "var(--hb-70)" }}>MAC</span>
              <span style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-35)" }}>{macStatus}</span>
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
                  padding: "8px 10px", background: "var(--hb-03)",
                  border: "1px solid var(--hb-08)", borderRadius: 4,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: statusColor, boxShadow: `0 0 4px ${statusColor}` }} />
                  <span style={{ fontFamily: PS2P, fontSize: 8, color: "var(--hb-70)", flex: 1 }}>{wf.name}</span>
                  <span style={{ fontFamily: PS2P, fontSize: 7, color: "var(--hb-25)" }}>
                    {wf.startedAt ? new Date(wf.startedAt).toLocaleTimeString() : ""}
                  </span>
                </div>
              );
            })
          ) : !loading ? (
            <div style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-30)" }}>No recent workflows</div>
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
            <div style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-30)" }}>No new opportunities</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Orbit detail (tabbed) ──

const ORBIT_TABS = ["REVIEW", "AGENTS", "APPROVED", "TRENDING", "SCOUT", "ACTIVITY"];

function OrbitDetail({ deepData, loading, token }: { deepData: OrbitDeepData | null; loading: boolean; token: string }) {
  const [tab, setTab] = useState("REVIEW");

  const AGENT_STATUS_COLORS: Record<string, string> = {
    running: "#facc15", completed: "#4ade80", failed: "#f87171", idle: "#71717a",
  };

  return (
    <div>
      <RoomTabs tabs={ORBIT_TABS} active={tab} accent="#f59e0b" onChange={setTab} />

      {!deepData?.online && !loading && (
        <div style={{ textAlign: "center", padding: 20 }}>
          <div style={{ fontFamily: PS2P, fontSize: 10, color: "#f87171", marginBottom: 8 }}>ORBIT OFFLINE</div>
          <div style={{ fontFamily: PS2P, fontSize: 8, color: "var(--hb-30)" }}>Start Orbit on port 3001</div>
        </div>
      )}

      {tab === "REVIEW" && (
        <ApprovalQueue token={token} />
      )}

      {tab === "AGENTS" && deepData?.online && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {deepData.pipelineRunning && (
            <div style={{ fontFamily: PS2P, fontSize: 8, color: "#facc15", textAlign: "center", padding: 8, background: "rgba(250,204,21,0.08)", borderRadius: 4, marginBottom: 4 }}>
              PIPELINE RUNNING
            </div>
          )}
          {deepData.agents.map((a) => (
            <div key={a.name} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 10px", background: "var(--hb-03)",
              border: "1px solid var(--hb-08)", borderRadius: 4,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: 2,
                background: AGENT_STATUS_COLORS[a.status] ?? "#71717a",
                boxShadow: a.status === "running" ? `0 0 6px ${AGENT_STATUS_COLORS[a.status]}` : "none",
              }} />
              <span style={{ fontFamily: PS2P, fontSize: 8, color: "var(--hb-70)", flex: 1 }}>{a.name}</span>
              <span style={{ fontFamily: PS2P, fontSize: 7, color: "var(--hb-30)" }}>{a.model}</span>
              <span style={{ fontFamily: PS2P, fontSize: 7, color: AGENT_STATUS_COLORS[a.status] ?? "#71717a" }}>{a.status}</span>
            </div>
          ))}
          {loading && <LoadingState />}
        </div>
      )}

      {tab === "APPROVED" && deepData?.online && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {loading && <LoadingState />}
          {deepData.approvedContent.length > 0 ? (
            deepData.approvedContent.map((c, i) => (
              <div key={i} style={{
                padding: "10px 12px", background: "rgba(74,222,128,0.06)",
                border: "1px solid rgba(74,222,128,0.15)", borderRadius: 4,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontFamily: PS2P, fontSize: 7, color: "#f59e0b", textTransform: "uppercase" }}>{c.persona}</span>
                  <span style={{ fontFamily: PS2P, fontSize: 7, color: c.score >= 80 ? "#4ade80" : c.score >= 70 ? "#facc15" : "#f87171" }}>
                    {c.score}/100
                  </span>
                </div>
                <div style={{ fontFamily: PS2P, fontSize: 8, color: "var(--hb-60)", lineHeight: 1.4 }}>{c.title}</div>
                <div style={{ fontFamily: PS2P, fontSize: 7, color: "var(--hb-25)", marginTop: 4 }}>{c.platform}</div>
              </div>
            ))
          ) : !loading ? (
            <div style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-30)" }}>No approved content in queue</div>
          ) : null}
        </div>
      )}

      {tab === "TRENDING" && deepData?.online && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {loading && <LoadingState />}
          {deepData.trendingTopics.length > 0 ? (
            deepData.trendingTopics.map((t, i) => {
              const heatColor = t.heat === "hot" ? "#ef4444" : t.heat === "warm" ? "#f59e0b" : "#60a5fa";
              return (
                <div key={i} style={{
                  padding: "8px 10px", background: "var(--hb-03)",
                  border: "1px solid var(--hb-08)", borderRadius: 4,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontFamily: PS2P, fontSize: 7, color: heatColor, textTransform: "uppercase" }}>{t.heat}</span>
                    <span style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-70)" }}>{t.topic}</span>
                  </div>
                  {t.angle && (
                    <div style={{ fontFamily: PS2P, fontSize: 7, color: "var(--hb-35)", lineHeight: 1.3 }}>{t.angle}</div>
                  )}
                </div>
              );
            })
          ) : !loading ? (
            <div style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-30)" }}>No trending topics</div>
          ) : null}
        </div>
      )}

      {tab === "SCOUT" && deepData?.online && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {loading && <LoadingState />}
          {deepData.scoutTargets.length > 0 ? (
            deepData.scoutTargets.map((t, i) => (
              <div key={i} style={{
                padding: "10px 12px", background: "var(--hb-03)",
                border: "1px solid var(--hb-08)", borderRadius: 4,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontFamily: PS2P, fontSize: 7, color: "#f59e0b" }}>{t.platform} · @{t.author}</span>
                  <span style={{ fontFamily: PS2P, fontSize: 7, color: t.score >= 0.8 ? "#4ade80" : "#facc15" }}>
                    {(t.score * 100).toFixed(0)}%
                  </span>
                </div>
                <div style={{ fontFamily: PS2P, fontSize: 8, color: "var(--hb-50)", lineHeight: 1.3, marginBottom: 6 }}>{t.content}</div>
                {t.draftReply && (
                  <div style={{ fontFamily: PS2P, fontSize: 7, color: "var(--hb-30)", lineHeight: 1.3, borderLeft: "2px solid rgba(245,158,11,0.3)", paddingLeft: 8 }}>
                    {t.draftReply}
                  </div>
                )}
              </div>
            ))
          ) : !loading ? (
            <div style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-30)" }}>No scout targets</div>
          ) : null}
        </div>
      )}

      {tab === "ACTIVITY" && deepData?.online && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {loading && <LoadingState />}
          {deepData.activity.length > 0 ? (
            deepData.activity.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 8, padding: "4px 0", borderBottom: "1px solid var(--hb-04)" }}>
                <span style={{ fontFamily: PS2P, fontSize: 6, color: "var(--hb-20)", minWidth: 40 }}>
                  {a.timestamp ? new Date(a.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                </span>
                <span style={{ fontFamily: PS2P, fontSize: 7, color: "#f59e0b", minWidth: 60 }}>{a.agent}</span>
                <span style={{ fontFamily: PS2P, fontSize: 7, color: "var(--hb-50)" }}>{a.detail || a.action}</span>
              </div>
            ))
          ) : !loading ? (
            <div style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-30)" }}>No recent activity</div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ── Engagement detail (tabbed) ──

const ENGAGEMENT_TABS = ["REPLY QUEUE", "INBOX", "DISCOVERY", "A/B TESTS", "COMPETITORS"];

const PLATFORM_COLORS: Record<string, string> = {
  threads: "#fff", instagram: "#f472b6", twitter: "#60a5fa", x: "#60a5fa",
  tiktok: "#22d3ee", linkedin: "#93c5fd", reddit: "#fb923c", bluesky: "#60a5fa",
};

function EngagementDetail({ deepData, loading, token }: { deepData: EngagementDeepData | null; loading: boolean; token: string }) {
  const [tab, setTab] = useState("REPLY QUEUE");

  return (
    <div>
      <RoomTabs tabs={ENGAGEMENT_TABS} active={tab} accent="#10b981" onChange={setTab} />

      {tab === "REPLY QUEUE" && (
        <EngagementQueue token={token} />
      )}

      {tab === "INBOX" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {deepData?.stats && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 4 }}>
              <Stat label="UNREAD" value={String(deepData.stats.unread)} alert={deepData.stats.unread > 5} />
              <Stat label="REPLIED" value={String(deepData.stats.replied)} />
              <Stat label="TOTAL" value={String(deepData.stats.total)} />
            </div>
          )}
          {deepData?.stats?.byPlatform && Object.keys(deepData.stats.byPlatform).length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
              {Object.entries(deepData.stats.byPlatform).map(([platform, count]) => (
                <span key={platform} style={{ fontFamily: PS2P, fontSize: 7, color: PLATFORM_COLORS[platform] ?? "#999" }}>
                  {platform}: {count}
                </span>
              ))}
            </div>
          )}
          {loading && <LoadingState />}
          {deepData?.items && deepData.items.length > 0 ? (
            deepData.items.map((item) => (
              <a
                key={item.id}
                href={item.platformUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block", textDecoration: "none",
                  padding: "8px 10px",
                  background: item.status === "unread" ? "rgba(16,185,129,0.06)" : "var(--hb-03)",
                  border: `1px solid ${item.status === "unread" ? "rgba(16,185,129,0.15)" : "var(--hb-08)"}`,
                  borderRadius: 4,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontFamily: PS2P, fontSize: 7, color: PLATFORM_COLORS[item.platform] ?? "#999", textTransform: "uppercase" }}>
                    {item.platform}
                  </span>
                  <span style={{ fontFamily: PS2P, fontSize: 7, color: "var(--hb-35)" }}>{item.type}</span>
                  <span style={{ fontFamily: PS2P, fontSize: 7, color: "#10b981" }}>@{item.authorHandle}</span>
                </div>
                <div style={{ fontFamily: PS2P, fontSize: 8, color: "var(--hb-60)", lineHeight: 1.4 }}>{item.content}</div>
                {item.publishedAt && (
                  <div style={{ fontFamily: PS2P, fontSize: 6, color: "var(--hb-20)", marginTop: 4 }}>
                    {new Date(item.publishedAt).toLocaleString()}
                  </div>
                )}
              </a>
            ))
          ) : !loading ? (
            <div style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-30)" }}>Inbox clear</div>
          ) : null}
        </div>
      )}

      {tab === "DISCOVERY" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {loading && <LoadingState />}
          {deepData?.discoveryItems && deepData.discoveryItems.length > 0 ? (
            deepData.discoveryItems.map((d) => (
              <a key={d.id} href={d.url} target="_blank" rel="noopener noreferrer" style={{
                display: "block", textDecoration: "none",
                padding: "8px 10px", background: "var(--hb-03)",
                border: "1px solid var(--hb-08)", borderRadius: 4,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontFamily: PS2P, fontSize: 7, color: PLATFORM_COLORS[d.platform] ?? "#999" }}>{d.platform} · @{d.author}</span>
                  <span style={{ fontFamily: PS2P, fontSize: 7, color: d.score >= 0.7 ? "#4ade80" : "#facc15" }}>
                    {(d.score * 100).toFixed(0)}%
                  </span>
                </div>
                <div style={{ fontFamily: PS2P, fontSize: 8, color: "var(--hb-50)", lineHeight: 1.3 }}>{d.content}</div>
              </a>
            ))
          ) : !loading ? (
            <div style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-30)" }}>No new discoveries</div>
          ) : null}
        </div>
      )}

      {tab === "A/B TESTS" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {loading && <LoadingState />}
          {deepData?.abTests && deepData.abTests.length > 0 ? (
            deepData.abTests.map((t) => {
              const statusColor = t.status === "completed" ? "#4ade80" : t.status === "active" ? "#facc15" : "#71717a";
              return (
                <div key={t.id} style={{
                  padding: "10px 12px", background: "var(--hb-04)",
                  border: `1px solid var(--hb-10)`, borderRadius: 4,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontFamily: PS2P, fontSize: 7, color: statusColor, textTransform: "uppercase" }}>{t.status}</span>
                    <span style={{ fontFamily: PS2P, fontSize: 7, color: "var(--hb-30)" }}>optimising: {t.metric}</span>
                  </div>
                  <div style={{ fontFamily: PS2P, fontSize: 8, color: "var(--hb-60)", lineHeight: 1.3, marginBottom: 4 }}>
                    {t.originalContent}
                  </div>
                  {t.winnerMetrics && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {Object.entries(t.winnerMetrics).slice(0, 4).map(([k, v]) => (
                        <span key={k} style={{ fontFamily: PS2P, fontSize: 7, color: "#10b981" }}>
                          {k}: {typeof v === "number" ? (v as number).toFixed(1) : String(v)}
                        </span>
                      ))}
                    </div>
                  )}
                  {t.evaluatedAt && (
                    <div style={{ fontFamily: PS2P, fontSize: 6, color: "var(--hb-20)", marginTop: 4 }}>
                      Evaluated: {new Date(t.evaluatedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              );
            })
          ) : !loading ? (
            <div style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-30)" }}>No A/B tests</div>
          ) : null}
        </div>
      )}

      {tab === "COMPETITORS" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {loading && <LoadingState />}
          {deepData?.competitors && deepData.competitors.length > 0 ? (
            deepData.competitors.map((c) => (
              <div key={c.id} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 10px", background: "var(--hb-03)",
                border: "1px solid var(--hb-08)", borderRadius: 4,
              }}>
                <span style={{ fontFamily: PS2P, fontSize: 7, color: PLATFORM_COLORS[c.platform] ?? "#999", textTransform: "uppercase" }}>{c.platform}</span>
                <span style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-70)", flex: 1 }}>{c.name}</span>
                <span style={{ fontFamily: PS2P, fontSize: 8, color: "var(--hb-40)" }}>@{c.handle}</span>
              </div>
            ))
          ) : !loading ? (
            <div style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-30)" }}>No competitors tracked</div>
          ) : null}
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
  orbit: { title: "ORBIT HQ", accent: "#f59e0b" },
  engagement: { title: "ENGAGEMENT", accent: "#10b981" },
};

export default function RoomDetail({ roomId, stats, heartbeat, token, onClose }: Props) {
  const { title, accent } = ROOM_TITLES[roomId];
  const deepRoomId = roomId === "dev" ? "infra" : roomId === "meta" ? null : roomId === "orbit" ? "orbit" : roomId === "engagement" ? "engagement" : roomId;
  const { data: deepData, loading } = useRoomData(deepRoomId);

  return (
    <>
      {/* Backdrop */}
      <div
        className="room-detail-backdrop"
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "var(--hb-panel-60)",
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
          border: "2px solid var(--hb-10)", borderBottom: "none",
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
              color: "var(--hb-50)", background: "none",
              border: "1px solid var(--hb-20)",
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
        {roomId === "orbit" && <OrbitDetail deepData={deepData as OrbitDeepData | null} loading={loading} token={token} />}
        {roomId === "engagement" && <EngagementDetail deepData={deepData as EngagementDeepData | null} loading={loading} token={token} />}

        {/* Updated timestamp */}
        <div style={{ fontFamily: PS2P, fontSize: 9, color: "var(--hb-20)", textAlign: "center", marginTop: 16 }}>
          Updated {new Date(stats.updatedAt).toLocaleTimeString()}
        </div>
      </div>
    </>
  );
}
