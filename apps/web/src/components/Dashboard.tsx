"use client";

import { useState, useEffect, useCallback } from "react";
import type { DashboardStats, HeartbeatResponse } from "@/types/dashboard";
import StatusBar from "./StatusBar";
import KeyNumbers from "./KeyNumbers";
import ServiceHealth from "./ServiceHealth";
import ContentPipeline from "./ContentPipeline";
import Opportunities from "./Opportunities";
import SEOSnapshot from "./SEOSnapshot";
import FloorPlan from "./FloorPlan";
import CommandPalette from "./CommandPalette";
import AlertFeed from "./AlertFeed";
import RoomDetail from "./RoomDetail";
import ApprovalQueue from "./ApprovalQueue";
import BriefingCard from "./BriefingCard";

const POLL_MS = 60_000;

type ViewMode = "pixel" | "list";

export default function Dashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [heartbeat, setHeartbeat] = useState<HeartbeatResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginSecret, setLoginSecret] = useState("");
  const [loginError, setLoginError] = useState("");
  const [view, setView] = useState<ViewMode>("pixel");
  const [selectedRoom, setSelectedRoom] = useState<"lunary" | "spellcast" | "dev" | "meta" | "orbit" | "engagement" | null>(null);
  const [showApprovalQueue, setShowApprovalQueue] = useState(false);

  useEffect(() => {
    setToken(localStorage.getItem("homebase_token"));
    setView((localStorage.getItem("homebase_view") as ViewMode) || "pixel");
    setLoading(false);
  }, []);

  const toggleView = () => {
    const next = view === "pixel" ? "list" : "pixel";
    setView(next);
    localStorage.setItem("homebase_view", next);
  };

  const fetchData = useCallback(
    async (t: string) => {
      if (document.hidden) return;
      const headers = { Authorization: `Bearer ${t}` };
      try {
        const [statsRes, hbRes] = await Promise.all([
          fetch("/api/stats", { headers }),
          fetch("/api/heartbeat", { headers }),
        ]);
        if (statsRes.status === 401) {
          localStorage.removeItem("homebase_token");
          setToken(null);
          return;
        }
        if (statsRes.ok) setStats(await statsRes.json());
        if (hbRes.ok) setHeartbeat(await hbRes.json());
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

  const handleOpenRoom = useCallback((room: "lunary" | "spellcast" | "dev" | "meta" | "orbit" | "engagement") => {
    setSelectedRoom(room);
  }, []);

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

  return (
    <div className="min-h-screen bg-black text-white">
      <StatusBar stats={stats} heartbeat={heartbeat} />

      {/* Top-right controls */}
      <div style={{ position: "fixed", top: 42, right: 8, zIndex: 40, display: "flex", gap: 4, alignItems: "center" }}>
        {/* Room dock — quick access to all rooms */}
        {view === "pixel" && (
          <>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setShowApprovalQueue(true); }}
              style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: 6,
                color: "#a78bfa",
                background: "rgba(0,0,0,0.8)",
                border: `1px solid rgba(167,139,250,0.4)`,
                padding: "4px 8px",
                cursor: "pointer",
                borderRadius: 3,
                position: "relative",
              }}
            >
              APPROVE
              {stats?.content.pendingReview ? (
                <span style={{
                  position: "absolute", top: -4, right: -4,
                  background: "#facc15", color: "#000",
                  fontFamily: "'Press Start 2P', monospace", fontSize: 5,
                  width: 14, height: 14, borderRadius: 7,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {stats.content.pendingReview}
                </span>
              ) : null}
            </button>
            {([
              { id: "orbit" as const, label: "ORBIT", color: "#f59e0b" },
              { id: "engagement" as const, label: "ENGAGE", color: "#10b981" },
            ]).map((room) => (
              <button
                key={room.id}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); handleOpenRoom(room.id); }}
                style={{
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: 6,
                  color: room.color,
                  background: "rgba(0,0,0,0.8)",
                  border: `1px solid ${room.color}40`,
                  padding: "4px 8px",
                  cursor: "pointer",
                  borderRadius: 3,
                }}
              >
                {room.label}
              </button>
            ))}
          </>
        )}
        <button
          onClick={toggleView}
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 6,
            color: "rgba(255,255,255,0.5)",
            background: "rgba(0,0,0,0.7)",
            border: "1px solid rgba(255,255,255,0.2)",
            padding: "4px 8px",
            cursor: "pointer",
          }}
        >
          {view === "pixel" ? "LIST" : "PIXEL"}
        </button>
      </div>

      {/* Command Palette — always available */}
      <CommandPalette
        stats={stats}
        token={token}
        onOpenRoom={handleOpenRoom}
        onOpenApprovalQueue={() => setShowApprovalQueue(true)}
        onRefresh={handleRefresh}
      />

      {/* Morning Briefing — shows once per day if there's something to act on */}
      <BriefingCard token={token} onOpenApprovalQueue={() => setShowApprovalQueue(true)} />

      {/* Approval Queue — full screen overlay */}
      {showApprovalQueue && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(8px)",
            overflowY: "auto",
            padding: "48px 12px 24px",
          }}
        >
          <div style={{ maxWidth: 480, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 12, color: "#a78bfa", letterSpacing: 1 }}>
                APPROVAL QUEUE
              </div>
              <button
                onClick={() => setShowApprovalQueue(false)}
                style={{
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: 8,
                  color: "rgba(255,255,255,0.5)",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  padding: "6px 12px",
                  borderRadius: 3,
                  cursor: "pointer",
                }}
              >
                CLOSE
              </button>
            </div>
            <ApprovalQueue token={token} />
          </div>
        </div>
      )}

      {/* Alert Feed — pixel view only */}
      {view === "pixel" && (
        <AlertFeed stats={stats} heartbeat={heartbeat} token={token} onOpenRoom={handleOpenRoom} onOpenApprovalQueue={() => setShowApprovalQueue(true)} onRefresh={handleRefresh} />
      )}

      {/* Rooms without pixel art desks — rendered at dashboard level */}
      {selectedRoom && ["orbit", "engagement"].includes(selectedRoom) && stats && (
        <RoomDetail
          roomId={selectedRoom as "orbit" | "engagement"}
          stats={stats}
          heartbeat={heartbeat}
          token={token}
          onClose={() => setSelectedRoom(null)}
        />
      )}

      {view === "pixel" ? (
        /* Pixel art view — full screen grid */
        <div style={{ position: "fixed", inset: 0, top: 32 }}>
          <FloorPlan stats={stats} heartbeat={heartbeat} token={token} selectedRoom={selectedRoom} onRoomChange={setSelectedRoom} />
        </div>
      ) : (
        /* Data list view — scrollable cards */
        <div className="px-3 pt-14 pb-8 space-y-3 max-w-lg mx-auto">
          <BriefingCard token={token} onOpenApprovalQueue={() => setShowApprovalQueue(true)} inline />
          <KeyNumbers stats={stats} />
          <ServiceHealth stats={stats} heartbeat={heartbeat} />
          <ApprovalQueue token={token} compact />
          <ContentPipeline stats={stats} />
          <Opportunities stats={stats} />
          <SEOSnapshot stats={stats} />
          {stats && (
            <p className="text-[7px] text-white/25 text-center pt-2">
              Updated {new Date(stats.updatedAt).toLocaleTimeString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
