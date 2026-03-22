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
import CastQueue from "./CastQueue";
import QuickActions from "./QuickActions";
import SocialStats from "./SocialStats";
import Opportunities from "./Opportunities";
import WeeklyRhythm from "./WeeklyRhythm";
import OrbitLog from "./OrbitLog";
import DigestCard from "./DigestCard";
import QuickComposer from "./QuickComposer";
import TasksWidget from "./TasksWidget";
import type { Alert } from "@/app/api/alerts/route";
import { registerPush } from "@/lib/push";
import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";

const PS2P = "'Press Start 2P', monospace";
const POLL_MS = 60_000;

type TabId = "status" | "queue" | "cast" | "chat";
type ViewMode = "list" | "pixel";

// "cookie" means authenticated via hb_session cookie (no Bearer header needed)
// A hex string means authenticated via legacy Bearer token
function authHeaders(token: string): Record<string, string> {
  if (token === "cookie") return {};
  return { Authorization: `Bearer ${token}` };
}

export default function Dashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [heartbeat, setHeartbeat] = useState<HeartbeatResponse | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [passkeyRegistered, setPasskeyRegistered] = useState<boolean | null>(null);
  const [setupSecret, setSetupSecret] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("status");
  const [isDesktop, setIsDesktop] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // On mount: check for existing session cookie, then fall back to localStorage token
  useEffect(() => {
    async function init() {
      // Check if passkey is registered (affects which button to show)
      try {
        const statusRes = await fetch("/api/auth/status");
        if (statusRes.ok) {
          const { registered } = await statusRes.json();
          setPasskeyRegistered(registered);
        }
      } catch {
        setPasskeyRegistered(false);
      }

      // Check for active session cookie first
      try {
        const sessionRes = await fetch("/api/auth/session");
        if (sessionRes.ok) {
          setToken("cookie");
          setLoading(false);
          registerPush().catch(() => {});
          return;
        }
      } catch {
        // No session cookie
      }

      // Fall back to legacy localStorage token
      const stored = localStorage.getItem("homebase_token");
      setToken(stored);
      setLoading(false);
    }
    init();
  }, []);

  // Restore view mode preference
  useEffect(() => {
    const saved = localStorage.getItem("homebase_view") as ViewMode | null;
    if (saved === "pixel" || saved === "list") setViewMode(saved);
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
      const headers = authHeaders(t);
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

  // Passkey: register (first time setup)
  const handleRegister = async () => {
    if (!setupSecret) {
      setLoginError("Enter the dashboard secret first");
      return;
    }
    setLoginError("");
    setLoginLoading(true);
    try {
      const challengeRes = await fetch("/api/auth/challenge?type=registration");
      if (!challengeRes.ok) throw new Error("Failed to get challenge");
      const options = await challengeRes.json();
      const { _clientId, ...regOptions } = options;

      const attResp = await startRegistration({ optionsJSON: regOptions });

      const verifyRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${setupSecret}`,
        },
        body: JSON.stringify({ ...attResp, _clientId }),
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Registration failed");
      }

      setPasskeyRegistered(true);
      // Automatically sign in after registration
      await handleSignIn();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Registration failed";
      if (!msg.includes("cancelled") && !msg.includes("NotAllowed")) {
        setLoginError(msg);
      }
    } finally {
      setLoginLoading(false);
    }
  };

  // Passkey: authenticate
  const handleSignIn = async () => {
    setLoginError("");
    setLoginLoading(true);
    try {
      const challengeRes = await fetch("/api/auth/challenge");
      if (!challengeRes.ok) throw new Error("Failed to get challenge");
      const options = await challengeRes.json();
      const { _clientId, ...authOptions } = options;

      const assertResp = await startAuthentication({ optionsJSON: authOptions });

      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...assertResp, _clientId }),
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Authentication failed");
      }

      setToken("cookie");
      // Register for push notifications after successful login
      registerPush().catch(() => {});
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Authentication failed";
      if (!msg.includes("cancelled") && !msg.includes("NotAllowed")) {
        setLoginError(msg);
      }
    } finally {
      setLoginLoading(false);
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

  // Keyboard shortcuts: 1/2/3/4 for tabs, r to refresh, p for pixel toggle
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
          setActiveTab("cast");
          if (viewMode === "pixel") {
            setViewMode("list");
            localStorage.setItem("homebase_view", "list");
          }
          break;
        case "4":
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
        <div className="w-full max-w-xs space-y-6">
          <div className="text-center space-y-2">
            <div style={{ fontSize: 36, lineHeight: 1 }}>🏠</div>
            <h1
              style={{
                fontFamily: PS2P,
                fontSize: 11,
                color: "var(--hb-85)",
                letterSpacing: 2,
              }}
            >
              HOMEBASE
            </h1>
            <p
              style={{
                fontFamily: PS2P,
                fontSize: 7,
                color: "var(--hb-60)",
                letterSpacing: 1,
              }}
            >
              COMMAND CENTRE
            </p>
          </div>

          {passkeyRegistered === false ? (
            // First-time setup
            <div className="space-y-3">
              <p
                style={{
                  fontFamily: PS2P,
                  fontSize: 7,
                  color: "var(--hb-60)",
                  textAlign: "center",
                  lineHeight: 1.8,
                }}
              >
                Enter secret to register.
              </p>
              <input
                type="password"
                placeholder="Dashboard secret"
                value={setupSecret}
                onChange={(e) => setSetupSecret(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                style={{
                  width: "100%",
                  background: "var(--hb-05)",
                  border: "1px solid var(--hb-15)",
                  borderRadius: 6,
                  padding: "12px 14px",
                  color: "var(--hb-90)",
                  fontFamily: "system-ui, sans-serif",
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <button
                onClick={handleRegister}
                disabled={loginLoading}
                style={{
                  width: "100%",
                  background: loginLoading ? "rgba(167,139,250,0.3)" : "rgba(167,139,250,0.15)",
                  border: "1px solid rgba(167,139,250,0.4)",
                  borderRadius: 6,
                  padding: "14px 16px",
                  cursor: loginLoading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: 20 }}>🔑</span>
                <span
                  style={{
                    fontFamily: PS2P,
                    fontSize: 8,
                    color: loginLoading ? "rgba(167,139,250,0.5)" : "var(--hb-accent)",
                    letterSpacing: 1,
                  }}
                >
                  {loginLoading ? "SETTING UP..." : "SET UP PASSKEY"}
                </span>
              </button>
            </div>
          ) : (
            // Sign in with passkey
            <div className="space-y-3">
              <button
                onClick={handleSignIn}
                disabled={loginLoading}
                style={{
                  width: "100%",
                  background: loginLoading ? "rgba(167,139,250,0.3)" : "rgba(167,139,250,0.12)",
                  border: "1px solid rgba(167,139,250,0.35)",
                  borderRadius: 6,
                  padding: "16px",
                  cursor: loginLoading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (!loginLoading)
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "rgba(167,139,250,0.2)";
                }}
                onMouseLeave={(e) => {
                  if (!loginLoading)
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "rgba(167,139,250,0.12)";
                }}
              >
                {/* Passkey / Touch ID icon */}
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ opacity: loginLoading ? 0.4 : 1 }}
                >
                  <circle cx="12" cy="8" r="3.5" stroke="var(--hb-accent)" strokeWidth="1.5" />
                  <path
                    d="M5 20c0-3.866 3.134-7 7-7s7 3.134 7 7"
                    stroke="var(--hb-accent)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M18 11l1.5 1.5L22 10"
                    stroke="var(--hb-success)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span
                  style={{
                    fontFamily: PS2P,
                    fontSize: 8,
                    color: loginLoading ? "rgba(167,139,250,0.5)" : "var(--hb-accent)",
                    letterSpacing: 1,
                  }}
                >
                  {loginLoading ? "AUTHENTICATING..." : "SIGN IN WITH PASSKEY"}
                </span>
              </button>
            </div>
          )}

          {loginError && (
            <p
              style={{
                fontFamily: PS2P,
                fontSize: 7,
                color: "var(--hb-error-soft)",
                textAlign: "center",
                letterSpacing: 0.5,
              }}
            >
              {loginError}
            </p>
          )}
        </div>
      </div>
    );
  }

  const pendingCount = stats?.content?.pendingReview ?? 0;
  const engagementCount = stats?.engagement?.unread ?? 0;
  const queueBadge = pendingCount + engagementCount;

  const TABS: { id: TabId; label: string; icon: string }[] = [
    { id: "status", label: "STATUS", icon: "📊" },
    { id: "queue", label: "QUEUE", icon: "✅" },
    { id: "cast", label: "CAST", icon: "💼" },
    { id: "chat", label: "CHAT", icon: "💬" },
  ];

  const headerHeight = isDesktop ? 52 : 44;
  const sidebarWidth = 200;

  return (
    <div style={{ minHeight: "100vh", background: "var(--hb-bg)", color: "var(--hb-90)" }}>
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
          background: "var(--hb-panel-95)",
          borderBottom: "1px solid var(--hb-06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 14px",
          zIndex: 40,
        }}
      >
        {/* Left: brand + health dot */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>🏠</span>
          <span
            style={{
              fontFamily: PS2P,
              fontSize: 9,
              color: "var(--hb-85)",
              letterSpacing: 2,
            }}
          >
            HOMEBASE
          </span>
          {/* System health dot — always visible */}
          {stats?.health && (() => {
            const downCount = Object.values(stats.health).filter(s => s.status === "down").length;
            const degradedCount = Object.values(stats.health).filter(s => s.status === "degraded").length;
            const dotColor = downCount > 0 ? "var(--hb-error-soft)" : degradedCount > 0 ? "var(--hb-warn)" : "var(--hb-success)";
            const pulse = downCount > 0;
            return (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  background: `${dotColor}15`,
                  border: `1px solid ${dotColor}35`,
                  borderRadius: 10,
                  padding: "2px 6px",
                  cursor: "pointer",
                }}
                onClick={() => setActiveTab("status")}
                title="View system health"
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: dotColor,
                    flexShrink: 0,
                    animation: pulse ? "pulse 1.5s ease-in-out infinite" : undefined,
                  }}
                />
                {downCount > 0 && (
                  <span style={{ fontFamily: PS2P, fontSize: 6, color: dotColor, letterSpacing: 0.5 }}>
                    {downCount}↓
                  </span>
                )}
              </span>
            );
          })()}
          {alerts.length > 0 && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--hb-error)",
                flexShrink: 0,
              }}
            />
          )}
        </div>

        {/* Centre: action badges (always visible) */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, justifyContent: "center" }}>
          {(stats?.content.pendingReview ?? 0) > 0 && (
            <button
              onClick={() => setActiveTab("queue")}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)",
                borderRadius: 4, padding: "3px 8px", cursor: "pointer", transition: "all 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(251,191,36,0.2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(251,191,36,0.12)")}
            >
              <span style={{ fontFamily: PS2P, fontSize: 7, color: "var(--hb-warn)", fontWeight: 700 }}>
                {stats!.content.pendingReview}
              </span>
              <span style={{ fontFamily: PS2P, fontSize: 6, color: "rgba(251,191,36,0.65)" }}>REVIEW</span>
            </button>
          )}
          {(stats?.engagement.unread ?? 0) > 0 && (
            <button
              onClick={() => setActiveTab("queue")}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                background: "rgba(133,173,146,0.1)", border: "1px solid rgba(133,173,146,0.25)",
                borderRadius: 4, padding: "3px 8px", cursor: "pointer", transition: "all 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(133,173,146,0.18)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(133,173,146,0.1)")}
            >
              <span style={{ fontFamily: PS2P, fontSize: 7, color: "var(--hb-success)", fontWeight: 700 }}>
                {stats!.engagement.unread}
              </span>
              <span style={{ fontFamily: PS2P, fontSize: 6, color: "rgba(133,173,146,0.65)" }}>ENGAGE</span>
            </button>
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
              color: viewMode === "pixel" ? "var(--hb-accent)" : "var(--hb-60)",
              background: viewMode === "pixel" ? "rgba(167,139,250,0.1)" : "none",
              border: `1px solid ${viewMode === "pixel" ? "rgba(167,139,250,0.4)" : "var(--hb-10)"}`,
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
              color: "var(--hb-60)",
              background: "none",
              border: "1px solid var(--hb-10)",
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
          background: "var(--hb-panel-95)",
          borderRight: "1px solid var(--hb-06)",
          flexDirection: "column",
          zIndex: 30,
        }}
      >
        <div
          style={{
            padding: "16px 12px 8px",
            fontFamily: PS2P,
            fontSize: 7,
            color: "var(--hb-60)",
            letterSpacing: 1.5,
            borderBottom: "1px solid var(--hb-06)",
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
                borderLeft: `3px solid ${isActive ? "var(--hb-accent)" : "transparent"}`,
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
                  color: isActive ? "var(--hb-accent)" : "var(--hb-60)",
                  transition: "color 0.15s",
                }}
              >
                {tab.label}
              </span>
              {badge !== null && (
                <span
                  style={{
                    marginLeft: "auto",
                    background: "var(--hb-warn)",
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
                <DigestCard
                  stats={stats}
                  heartbeat={heartbeat}
                  onOpenApprovalQueue={() => setActiveTab("queue")}
                  onOpenEngagementQueue={() => setActiveTab("queue")}
                />
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
                    <TasksWidget tasks={heartbeat?.heartbeat?.tasks} />
                    <QuickActions
                      token={token}
                      onAction={(action) => {
                        if (action === "sync" && token) fetchData(token);
                      }}
                    />
                    <KeyNumbers stats={stats} />
                    <QuickComposer token={token} />
                    <WeeklyRhythm token={token} />
                    <LaunchTracker token={token} />
                  </div>
                  <div className="hb-status-right" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <ServiceHealth stats={stats} heartbeat={heartbeat} />
                    <ContentPipeline stats={stats} />
                    <SocialStats token={token} />
                    <DeployStatus token={token} />
                    <OrbitLog token={token} />
                  </div>
                </div>
                {stats && (
                  <p
                    style={{
                      fontFamily: PS2P,
                      fontSize: 6,
                      color: "var(--hb-20)",
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
                        color: "var(--hb-accent)",
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
                  <div>
                    <div
                      style={{
                        fontFamily: PS2P,
                        fontSize: 10,
                        color: "var(--hb-accent)",
                        letterSpacing: 1,
                        marginBottom: 12,
                      }}
                    >
                      OPPORTUNITIES
                    </div>
                    <Opportunities opportunities={stats?.opportunities ?? null} token={token} />
                  </div>
                </div>
              </div>
            )}

            {/* CAST TAB */}
            {activeTab === "cast" && (
              <div
                className="hb-content-area"
                style={{
                  padding: "16px 12px",
                  maxWidth: 720,
                  margin: "0 auto",
                }}
              >
                <div
                  style={{
                    fontFamily: PS2P,
                    fontSize: 10,
                    color: "#60a5fa",
                    letterSpacing: 1,
                    marginBottom: 12,
                  }}
                >
                  CAST — JOB PIPELINE
                </div>
                <CastQueue token={token} />
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
          background: "var(--hb-panel-95)",
          borderTop: "1px solid var(--hb-08)",
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
                  color: isActive ? "var(--hb-accent)" : "var(--hb-60)",
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
                    background: "var(--hb-warn)",
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
