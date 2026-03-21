"use client";

import { useState, useEffect, useCallback } from "react";
import type { DashboardStats, HeartbeatResponse } from "@/types/dashboard";
import KeyNumbers from "./KeyNumbers";
import ServiceHealth from "./ServiceHealth";
import ContentPipeline from "./ContentPipeline";
import CommandPalette from "./CommandPalette";
import ApprovalQueue from "./ApprovalQueue";
import EngagementQueue from "./EngagementQueue";
import BriefingCard from "./BriefingCard";
import DeployStatus from "./DeployStatus";
import LaunchTracker from "./LaunchTracker";
import ChatPanel from "./ChatPanel";
import AlertStrip from "./AlertStrip";
import FloorPlan from "./FloorPlan";
import type { Alert } from "@/app/api/alerts/route";

const PS2P = "'Press Start 2P', monospace";
const POLL_MS = 60_000;

type TabId = "status" | "queue" | "chat";
type ViewMode = "list" | "pixel";

export default function Dashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [heartbeat, setHeartbeat] = useState<HeartbeatResponse | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [loginSecret, setLoginSecret] = useState("");
  const [loginError, setLoginError] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("status");
  const [isDesktop, setIsDesktop] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  useEffect(() => {
    setToken(localStorage.getItem("homebase_token"));
    // Restore view mode preference
    const saved = localStorage.getItem("homebase_view") as ViewMode | null;
    if (saved === "pixel" || saved === "list") setViewMode(saved);
    setLoading(false);
  }, []);

  // Detect desktop and listen for resize
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const fetchData = useCallback(
    async (t: string) => {
      if (document.hidden) return;
      const headers = { Authorization: `Bearer ${t}` };
      try {
        const [statsRes, hbRes, alertsRes] = await Promise.all([
          fetch("/api/stats", { headers }),
          fetch("/api/heartbeat", { headers }),
          fetch("/api/alerts", { headers }).catch(() => null),
        ]);
        if (statsRes.status === 401) {
          localStorage.removeItem("homebase_token");
          setToken(null);
          return;
        }
        if (statsRes.ok) setStats(await statsRes.json());
        if (hbRes.ok) setHeartbeat(await hbRes.json());
        if (alertsRes?.ok) {
          const alertData = await alertsRes.json();
          setAlerts(alertData.alerts ?? []);
        }
      } catch (e) {
        console.error("[homebase] fetch error:", e);
      }
    },
    []
  );

  useEffect(() => {
    if (!token) return;
    fetchData(token);
    const id = setInterval(() => fetchData(token), POLL_MS);
    const onVis = () => {
      if (!document.hidden) fetchData(token);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [token, fetchData]);

  // Set default tab based on pending items once stats load
  useEffect(() => {
    if (!stats) return;
    const isMobile = window.innerWidth < 768;
    const hasPending = (stats.content?.pendingReview ?? 0) > 0;
    if (isMobile && hasPending) {
      setActiveTab("queue");
    }
  }, [stats]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: loginSecret }),
      });
      if (res.ok) {
        localStorage.setItem("homebase_token", loginSecret);
        setToken(loginSecret);
        setLoginSecret("");
      } else {
        setLoginError("Invalid secret");
      }
    } catch {
      setLoginError("Connection failed");
    }
  };

  const handleRefresh = useCallback(() => {
    if (token) fetchData(token);
  }, [token, fetchData]);

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => {
      const next: ViewMode = prev === "list" ? "pixel" : "list";
      localStorage.setItem("homebase_view", next);
      return next;
    });
  }, []);

  // Keyboard shortcuts: 1/2/3 for tabs, r to refresh, p for pixel toggle
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "1":
          e.preventDefault();
          setActiveTab("status");
          if (viewMode === "pixel") {
            setViewMode("list");
            localStorage.setItem("homebase_view", "list");
          }
          break;
        case "2":
          e.preventDefault();
          setActiveTab("queue");
          if (viewMode === "pixel") {
            setViewMode("list");
            localStorage.setItem("homebase_view", "list");
          }
          break;
        case "3":
          e.preventDefault();
          setActiveTab("chat");
          if (viewMode === "pixel") {
            setViewMode("list");
            localStorage.setItem("homebase_view", "list");
          }
          break;
        case "r":
          e.preventDefault();
          if (token) fetchData(token);
          break;
        case "Escape":
          if (viewMode === "pixel") {
            setViewMode("list");
            localStorage.setItem("homebase_view", "list");
          }
          break;
        case "p":
          e.preventDefault();
          toggleViewMode();
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [token, fetchData, viewMode, toggleViewMode]);

  if (loading) return <div className="min-h-screen bg-black" />;

  if (!token) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="w-full max-w-xs space-y-4">
          <div className="text-center space-y-1">
            <h1 className="text-white text-sm tracking-widest">HOMEBASE</h1>
            <p className="text-white/30 text-[7px]">COMMAND CENTRE</p>
          </div>
          <input
            type="password"
            value={loginSecret}
            onChange={(e) => setLoginSecret(e.target.value)}
            placeholder="Enter secret"
            className="w-full bg-white/5 border border-white/20 rounded px-3 py-2.5 text-white text-[10px] focus:outline-none focus:border-purple-400 transition-colors"
            autoFocus
          />
          {loginError && (
            <p className="text-red-400 text-[8px]">{loginError}</p>
          )}
          <button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-500 text-white rounded px-3 py-2.5 text-[8px] uppercase tracking-widest transition-colors"
          >
            Enter
          </button>
        </form>
      </div>
    );
  }

  const pendingCount = stats?.content?.pendingReview ?? 0;
  const engagementCount = stats?.engagement?.unread ?? 0;
  const queueBadge = pendingCount + engagementCount;

  const TABS: { id: TabId; label: string; icon: string }[] = [
    { id: "status", label: "STATUS", icon: "📊" },
    { id: "queue", label: "QUEUE", icon: "✅" },
    { id: "chat", label: "CHAT", icon: "💬" },
  ];

  const headerHeight = isDesktop ? 52 : 44;
  const sidebarWidth = 200;

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff" }}>
      <style>{`
        @media (min-width: 768px) {
          .hb-status-grid {
            display: grid !important;
            grid-template-columns: 1.5fr 1fr;
            gap: 16px;
            align-items: start;
          }
          .hb-queue-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            align-items: start;
          }
          .hb-content-area {
            max-width: 1100px !important;
            padding: 20px 24px !important;
          }
          .hb-tab-sidebar {
            display: flex !important;
            top: 52px !important;
          }
          .hb-tab-bottom {
            display: none !important;
          }
          .hb-header {
            height: 52px !important;
          }
          .hb-main {
            padding-top: 52px !important;
            padding-left: 200px !important;
            padding-bottom: 0 !important;
          }
          .hb-chat-area {
            max-width: 700px !important;
            margin: 0 auto !important;
          }
          .hb-pixel-view {
            left: 200px !important;
            top: 52px !important;
          }
        }
        @media (max-width: 767px) {
          .hb-tab-sidebar { display: none !important; }
          .hb-status-grid, .hb-queue-grid { display: block !important; }
          .hb-pixel-view {
            left: 0 !important;
            top: 44px !important;
          }
        }
      `}</style>

      {/* Command Palette — always available */}
      <CommandPalette
        stats={stats}
        token={token}
        onOpenRoom={() => {}}
        onOpenApprovalQueue={() => setActiveTab("queue")}
        onOpenEngagementQueue={() => setActiveTab("queue")}
        onRefresh={handleRefresh}
      />

      {/* Header bar */}
      <div
        className="hb-header"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: headerHeight,
          background: "rgba(0,0,0,0.95)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 14px",
          zIndex: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>🏠</span>
          <span
            style={{
              fontFamily: PS2P,
              fontSize: 9,
              color: "rgba(255,255,255,0.85)",
              letterSpacing: 2,
            }}
          >
            HOMEBASE
          </span>
          {alerts.length > 0 && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#ef4444",
                flexShrink: 0,
              }}
            />
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* Pixel art view toggle */}
          <button
            onClick={toggleViewMode}
            title={viewMode === "pixel" ? "List view (P)" : "Pixel art view (P)"}
            style={{
              fontFamily: PS2P,
              fontSize: 6,
              color: viewMode === "pixel" ? "#a78bfa" : "rgba(255,255,255,0.35)",
              background: viewMode === "pixel" ? "rgba(167,139,250,0.1)" : "none",
              border: `1px solid ${viewMode === "pixel" ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.1)"}`,
              borderRadius: 3,
              padding: "4px 8px",
              cursor: "pointer",
              letterSpacing: 0.5,
              display: "flex",
              alignItems: "center",
              gap: 4,
              transition: "all 0.15s",
            }}
          >
            <span style={{ fontSize: 10 }}>🎮</span>
          </button>
          <button
            onClick={handleRefresh}
            title="Refresh (R)"
            style={{
              fontFamily: PS2P,
              fontSize: 6,
              color: "rgba(255,255,255,0.35)",
              background: "none",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 3,
              padding: "4px 8px",
              cursor: "pointer",
              letterSpacing: 0.5,
            }}
          >
            ↻
          </button>
        </div>
      </div>

      {/* Desktop left sidebar */}
      <div
        className="hb-tab-sidebar"
        style={{
          display: "none", // overridden by CSS media query on desktop
          position: "fixed",
          left: 0,
          top: headerHeight,
          bottom: 0,
          width: sidebarWidth,
          background: "rgba(0,0,0,0.95)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          flexDirection: "column",
          zIndex: 30,
        }}
      >
        <div
          style={{
            padding: "16px 12px 8px",
            fontFamily: PS2P,
            fontSize: 7,
            color: "rgba(255,255,255,0.25)",
            letterSpacing: 1.5,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            marginBottom: 4,
          }}
        >
          NAVIGATION
        </div>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id && viewMode === "list";
          const badge = tab.id === "queue" && queueBadge > 0 ? queueBadge : null;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (viewMode === "pixel") {
                  setViewMode("list");
                  localStorage.setItem("homebase_view", "list");
                }
              }}
              style={{
                width: "100%",
                height: 52,
                background: isActive ? "rgba(167,139,250,0.08)" : "none",
                border: "none",
                borderLeft: `3px solid ${isActive ? "#a78bfa" : "transparent"}`,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "0 14px",
                position: "relative",
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>{tab.icon}</span>
              <span
                style={{
                  fontFamily: PS2P,
                  fontSize: 8,
                  letterSpacing: 0.5,
                  color: isActive ? "#a78bfa" : "rgba(255,255,255,0.4)",
                  transition: "color 0.15s",
                }}
              >
                {tab.label}
              </span>
              {badge !== null && (
                <span
                  style={{
                    marginLeft: "auto",
                    background: "#facc15",
                    color: "#000",
                    fontFamily: PS2P,
                    fontSize: 5,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 4px",
                  }}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main content — padded top for header, bottom for tab bar on mobile */}
      <div
        className="hb-main"
        style={{
          paddingTop: headerHeight,
          paddingBottom: 56,
        }}
      >
        {/* PIXEL ART VIEW */}
        {viewMode === "pixel" && (
          <div
            className="hb-pixel-view"
            style={{
              position: "fixed",
              top: headerHeight,
              left: isDesktop ? sidebarWidth : 0,
              right: 0,
              bottom: 0,
            }}
          >
            <FloorPlan
              stats={stats}
              heartbeat={heartbeat}
              token={token}
            />
          </div>
        )}

        {/* LIST VIEW */}
        {viewMode === "list" && (
          <>
            {/* STATUS TAB */}
            {activeTab === "status" && (
              <div
                className="hb-content-area"
                style={{
                  padding: "16px 12px",
                  maxWidth: 520,
                  margin: "0 auto",
                }}
              >
                <AlertStrip
                  alerts={alerts}
                  onTabChange={setActiveTab}
                />
                <div
                  className="hb-status-grid"
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  <div className="hb-status-left" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <BriefingCard
                      token={token}
                      onOpenApprovalQueue={() => setActiveTab("queue")}
                      inline
                    />
                    <KeyNumbers stats={stats} />
                    <LaunchTracker token={token} />
                  </div>
                  <div className="hb-status-right" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <ServiceHealth stats={stats} heartbeat={heartbeat} />
                    <ContentPipeline stats={stats} />
                    <DeployStatus token={token} />
                  </div>
                </div>
                {stats && (
                  <p
                    style={{
                      fontFamily: PS2P,
                      fontSize: 6,
                      color: "rgba(255,255,255,0.2)",
                      textAlign: "center",
                      paddingTop: 12,
                    }}
                  >
                    Updated {new Date(stats.updatedAt).toLocaleTimeString()}
                  </p>
                )}
              </div>
            )}

            {/* QUEUE TAB */}
            {activeTab === "queue" && (
              <div
                className="hb-content-area"
                style={{
                  padding: "16px 12px",
                  maxWidth: 520,
                  margin: "0 auto",
                }}
              >
                <div
                  className="hb-queue-grid"
                  style={{ display: "flex", flexDirection: "column", gap: 16 }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: PS2P,
                        fontSize: 10,
                        color: "#a78bfa",
                        letterSpacing: 1,
                        marginBottom: 12,
                      }}
                    >
                      APPROVAL QUEUE
                    </div>
                    <ApprovalQueue token={token} />
                  </div>
                  <div>
                    <div
                      style={{
                        fontFamily: PS2P,
                        fontSize: 10,
                        color: "#10b981",
                        letterSpacing: 1,
                        marginBottom: 12,
                      }}
                    >
                      ENGAGEMENT QUEUE
                    </div>
                    <EngagementQueue token={token} />
                  </div>
                </div>
              </div>
            )}

            {/* CHAT TAB */}
            {activeTab === "chat" && (
              <div className="hb-chat-area">
                <ChatPanel token={token} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom tab bar (mobile only) */}
      <div
        className="hb-tab-bottom"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: 56,
          background: "rgba(0,0,0,0.95)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          zIndex: 50,
        }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id && viewMode === "list";
          const badge =
            tab.id === "queue" && queueBadge > 0 ? queueBadge : null;

          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (viewMode === "pixel") {
                  setViewMode("list");
                  localStorage.setItem("homebase_view", "list");
                }
              }}
              style={{
                flex: 1,
                height: "100%",
                background: "none",
                border: "none",
                borderTop: isActive
                  ? "2px solid #a78bfa"
                  : "2px solid transparent",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                position: "relative",
                transition: "border-color 0.15s",
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>{tab.icon}</span>
              <span
                style={{
                  fontFamily: PS2P,
                  fontSize: 6,
                  letterSpacing: 0.5,
                  color: isActive ? "#a78bfa" : "rgba(255,255,255,0.3)",
                  transition: "color 0.15s",
                }}
              >
                {tab.label}
              </span>
              {badge !== null && (
                <span
                  style={{
                    position: "absolute",
                    top: 6,
                    right: "calc(50% - 18px)",
                    background: "#facc15",
                    color: "#000",
                    fontFamily: PS2P,
                    fontSize: 5,
                    minWidth: 14,
                    height: 14,
                    borderRadius: 7,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 3px",
                  }}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
