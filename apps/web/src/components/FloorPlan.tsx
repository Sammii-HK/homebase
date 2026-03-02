"use client";

import { useState, useEffect } from "react";
import Room from "./Room";
import { useLiveStats } from "@/hooks/useLiveStats";

export default function FloorPlan() {
  const stats = useLiveStats();

  const rooms = [
    {
      id: "lunary",
      title: "LUNARY",
      subtitle: "OBSERVATORY",
      bg: "#0d0618",
      accent: "#c084fc",
      pattern: `radial-gradient(circle, rgba(192,132,252,0.25) 1px, transparent 1px)`,
      agent: { emoji: "🌙", name: "LUNA", color: "#7c3aed" },
      stats: [
        { label: "MAU", value: stats ? `${stats.lunary.mau}` : "..." },
        { label: "MRR", value: stats ? `£${stats.lunary.mrr.toFixed(2)}` : "..." },
        { label: "ONLINE", value: stats ? `${stats.lunary.activeToday}` : "..." },
      ],
      decoration: (
        <>
          {/* Moon */}
          <div className="absolute top-6 right-6 pulse" style={{ width: 44, height: 44, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, #e9d5ff, #7c3aed)", boxShadow: "0 0 20px #7c3aed, 0 0 40px rgba(124,58,237,0.4)" }} />
          {/* Stars */}
          {[[22,45],[35,28],[55,35],[68,55],[18,68],[75,42]].map(([x,y],i) => (
            <div key={i} className="absolute pulse" style={{ left: `${x}%`, top: `${y}%`, width: 3, height: 3, background: "#e9d5ff", boxShadow: "0 0 4px #e9d5ff" }} />
          ))}
          {/* Telescope */}
          <div className="absolute bottom-12 right-6" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 22, opacity: 0.3, transform: "rotate(-20deg)" }}>🔭</div>
        </>
      ),
    },
    {
      id: "spellcast",
      title: "SPELLCAST",
      subtitle: "COMMAND",
      bg: "#020f1a",
      accent: "#22d3ee",
      pattern: `linear-gradient(rgba(34,211,238,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.07) 1px, transparent 1px)`,
      agent: { emoji: "✍️", name: "CASTER", color: "#0e7490" },
      stats: [
        { label: "TODAY", value: stats ? `${stats.spellcast.postsToday} posts` : "..." },
        { label: "QUEUED", value: stats ? `${stats.spellcast.scheduled}` : "..." },
        { label: "ACCTS", value: stats ? `${stats.spellcast.accounts}` : "..." },
      ],
      decoration: (
        <>
          {/* Monitors */}
          {[
            { l: "62%", t: "18%", w: 52, h: 34 },
            { l: "48%", t: "28%", w: 42, h: 28 },
          ].map((m, i) => (
            <div key={i} className="absolute pixel-border" style={{ left: m.l, top: m.t, width: m.w, height: m.h, background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.25)" }}>
              <div className="blink" style={{ width: 6, height: 6, background: "#22d3ee", margin: "3px auto 0", boxShadow: "0 0 6px #22d3ee" }} />
            </div>
          ))}
          {/* Calendar grid decoration */}
          <div className="absolute" style={{ bottom: "22%", right: "6%", display: "grid", gridTemplateColumns: "repeat(7, 6px)", gap: 2 }}>
            {Array.from({ length: 21 }).map((_, i) => (
              <div key={i} style={{ width: 6, height: 6, background: i < 14 ? "rgba(34,211,238,0.4)" : "rgba(34,211,238,0.1)" }} />
            ))}
          </div>
        </>
      ),
    },
    {
      id: "dev",
      title: "DEV",
      subtitle: "DEN",
      bg: "#030a03",
      accent: "#4ade80",
      pattern: `repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(74,222,128,0.03) 3px, rgba(74,222,128,0.03) 4px)`,
      agent: { emoji: "💻", name: "DEV", color: "#166534" },
      stats: [
        { label: "COMMITS", value: stats ? `${stats.github.commitsToday} today` : "..." },
        { label: "REPOS", value: stats ? `${stats.github.repos}` : "..." },
        { label: "FOLLOWERS", value: stats ? `${stats.github.followers}` : "..." },
      ],
      decoration: (
        <>
          {/* Terminal window */}
          <div className="absolute" style={{ top: "14%", right: "5%", width: 130, background: "rgba(0,0,0,0.7)", border: "1px solid rgba(74,222,128,0.3)" }}>
            <div style={{ background: "rgba(74,222,128,0.15)", padding: "2px 6px", borderBottom: "1px solid rgba(74,222,128,0.2)" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block", boxShadow: "0 0 4px #4ade80" }} />
            </div>
            <div style={{ padding: "6px 8px", fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "rgba(74,222,128,0.7)", lineHeight: 2 }}>
              <div>$ git push</div>
              <div>$ pnpm dev</div>
              <div>$ vercel --prod</div>
              <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                <span>$ </span>
                <span className="blink" style={{ display: "inline-block", width: 5, height: 9, background: "#4ade80" }} />
              </div>
            </div>
          </div>
          {/* GitHub mark */}
          <div className="absolute" style={{ bottom: "18%", right: "8%", fontSize: 20, opacity: 0.2 }}>⌥</div>
        </>
      ),
    },
    {
      id: "meta",
      title: "META",
      subtitle: "ANALYTICS",
      bg: "#0f0820",
      accent: "#f472b6",
      pattern: `radial-gradient(ellipse at 80% 20%, rgba(244,114,182,0.12) 0%, transparent 60%)`,
      agent: { emoji: "📸", name: "META", color: "#9d174d" },
      stats: [
        { label: "IG FOLLOWERS", value: stats ? `${stats.meta.followers.toLocaleString()}` : "..." },
        { label: "REACH/WK", value: stats ? `${(stats.meta.reachThisWeek / 1000).toFixed(1)}k` : "..." },
        { label: "POSTS/WK", value: stats ? `${stats.meta.postsThisWeek}` : "..." },
      ],
      decoration: (
        <>
          {/* Bar chart */}
          <div className="absolute flex items-end gap-1" style={{ top: "22%", right: "6%", height: 50 }}>
            {[30, 55, 40, 70, 45, 80, 60].map((h, i) => (
              <div key={i} style={{ width: 8, height: `${h}%`, background: `rgba(244,114,182,${0.3 + i * 0.07})`, boxShadow: i === 5 ? "0 0 6px #f472b6" : "none" }} />
            ))}
          </div>
          {/* Trending arrow */}
          <div className="absolute pulse" style={{ top: "20%", right: "44%", color: "#f472b6", fontFamily: "'Press Start 2P', monospace", fontSize: 16, opacity: 0.4 }}>↗</div>
          {/* Platform icons */}
          <div className="absolute" style={{ bottom: "20%", right: "6%", display: "flex", gap: 6 }}>
            {["📸", "📘"].map((e, i) => (
              <div key={i} style={{ fontSize: 14, opacity: 0.35 }}>{e}</div>
            ))}
          </div>
        </>
      ),
    },
  ];

  return (
    <div className="w-screen h-screen" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr" }}>
      {rooms.map((r) => (
        <Room key={r.id} config={r} />
      ))}

      {/* Centre crosshair */}
      <div className="fixed inset-0 pointer-events-none z-30" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 12, height: 2, background: "rgba(255,255,255,0.15)" }} />
        <div style={{ width: 2, height: 12, background: "rgba(255,255,255,0.15)", position: "absolute" }} />
      </div>

      {/* Clock — bottom right */}
      <Clock />
    </div>
  );
}

function Clock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="fixed bottom-3 right-4 z-30" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: "rgba(255,255,255,0.2)" }}>
      {time}
    </div>
  );
}

