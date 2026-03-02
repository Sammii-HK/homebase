"use client";

import { useState, useEffect } from "react";
import AgentSprite from "./AgentSprite";
import { useLiveStats } from "@/hooks/useLiveStats";

// ── Room decoration components ────────────────────────────────────────────

function LunaryDecor() {
  return <>
    {/* Moon */}
    <div className="absolute pulse" style={{ top: 12, right: 16, width: 48, height: 48, borderRadius: "50%", background: "radial-gradient(circle at 38% 35%, #e9d5ff 0%, #a78bfa 40%, #7c3aed 100%)", boxShadow: "0 0 24px #7c3aed, 0 0 48px rgba(124,58,237,0.3)" }} />
    {/* Stars */}
    {[[14,44],[22,26],[40,30],[58,38],[70,20],[78,50],[10,70],[32,62]].map(([x,y],i) => (
      <div key={i} className="absolute pulse" style={{ left: `${x}%`, top: `${y}%`, width: i%3===0?4:3, height: i%3===0?4:3, background: "#e9d5ff", boxShadow: "0 0 5px #c4b5fd", animationDelay: `${i*0.3}s` }} />
    ))}
    {/* Telescope */}
    <div className="absolute" style={{ bottom: 58, right: 18, opacity: 0.55 }}>
      <svg width="28" height="32" viewBox="0 0 28 32" style={{ imageRendering: "pixelated" }}>
        <rect x="12" y="0" width="4" height="18" fill="#a78bfa" />
        <rect x="8" y="4" width="12" height="6" fill="#7c3aed" />
        <rect x="4" y="8" width="8" height="4" fill="#6d28d9" />
        <rect x="10" y="18" width="2" height="8" fill="#8b5cf6" />
        <rect x="8" y="26" width="12" height="4" fill="#7c3aed" />
      </svg>
    </div>
    {/* Star chart desk */}
    <div className="absolute" style={{ bottom: 58, left: 14, width: 60, height: 40, background: "rgba(124,58,237,0.15)", border: "1px solid rgba(167,139,250,0.3)" }}>
      <div style={{ padding: "4px 5px" }}>
        {[70,45,85,55,60].map((w, i) => (
          <div key={i} style={{ width: `${w}%`, height: 2, background: `rgba(196,181,253,${0.2+i*0.06})`, marginBottom: 3 }} />
        ))}
      </div>
    </div>
    {/* Bookshelf */}
    <div className="absolute" style={{ bottom: 58, left: 84, display: "flex", gap: 2 }}>
      {["#7c3aed","#6d28d9","#a78bfa","#8b5cf6","#4c1d95"].map((c,i) => (
        <div key={i} style={{ width: 8, height: 28+i*4, background: c, border: "1px solid rgba(255,255,255,0.1)" }} />
      ))}
    </div>
    {/* Floor checkerboard */}
    <div className="absolute inset-0 -z-10" style={{
      backgroundImage: "linear-gradient(45deg,rgba(91,33,182,0.12) 25%,transparent 25%),linear-gradient(-45deg,rgba(91,33,182,0.12) 25%,transparent 25%),linear-gradient(45deg,transparent 75%,rgba(91,33,182,0.12) 75%),linear-gradient(-45deg,transparent 75%,rgba(91,33,182,0.12) 75%)",
      backgroundSize: "20px 20px",
      backgroundPosition: "0 0,0 10px,10px -10px,-10px 0px"
    }} />
  </>;
}

function SpellcastDecor() {
  return <>
    {/* 3 monitors */}
    {[
      { l: "52%", t: "14%", w: 70, h: 46, bright: true },
      { l: "58%", t: "36%", w: 56, h: 36, bright: false },
    ].map((m, i) => (
      <div key={i} className="absolute" style={{ left: m.l, top: m.t, width: m.w, height: m.h, background: m.bright ? "rgba(6,182,212,0.08)" : "rgba(6,182,212,0.04)", border: `1px solid rgba(34,211,238,${m.bright?0.4:0.2})`, boxShadow: m.bright ? "0 0 12px rgba(34,211,238,0.15)" : "none" }}>
        <div style={{ height: 8, background: m.bright ? "rgba(34,211,238,0.15)" : "rgba(34,211,238,0.08)", borderBottom: "1px solid rgba(34,211,238,0.2)", display: "flex", alignItems: "center", padding: "0 4px", gap: 3 }}>
          {["#4ade80","#facc15","#f87171"].map((c,j) => <div key={j} style={{ width: 5, height: 5, background: c, opacity: 0.7 }} />)}
        </div>
        <div style={{ padding: "4px 5px" }}>
          {[80,55,70,40,65].slice(0, m.bright?5:3).map((w,j) => (
            <div key={j} style={{ width:`${w}%`, height:2, background:`rgba(34,211,238,${0.25+j*0.05})`, marginBottom: 3 }} />
          ))}
          <div className="blink" style={{ width: 5, height: 8, background: "#22d3ee", marginTop: 2 }} />
        </div>
      </div>
    ))}
    {/* Desk */}
    <div className="absolute" style={{ bottom: 56, left: 10, right: 10, height: 10, background: "rgba(14,116,144,0.4)", border: "1px solid rgba(34,211,238,0.25)" }} />
    {/* Calendar grid */}
    <div className="absolute" style={{ bottom: 72, left: 14, display: "grid", gridTemplateColumns: "repeat(7, 8px)", gap: 2 }}>
      {Array.from({ length: 28 }).map((_, i) => (
        <div key={i} style={{ width: 8, height: 8, background: i < 19 ? `rgba(34,211,238,${0.2+Math.random()*0.4})` : "rgba(34,211,238,0.07)", boxShadow: i < 19 && i%3===0 ? "0 0 4px rgba(34,211,238,0.5)" : "none" }} />
      ))}
    </div>
    {/* Status lights */}
    <div className="absolute" style={{ top: 14, right: 14, display: "flex", flexDirection: "column", gap: 4 }}>
      {[["#4ade80","LIVE"],["#facc15","SCHED"],["#f472b6","IG"]].map(([c,l]) => (
        <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div className="pulse" style={{ width: 6, height: 6, background: c, boxShadow: `0 0 6px ${c}` }} />
          <span style={{ fontFamily: "'Press Start 2P'", fontSize: 5, color: "rgba(255,255,255,0.3)" }}>{l}</span>
        </div>
      ))}
    </div>
    {/* Floor */}
    <div className="absolute inset-0 -z-10" style={{
      backgroundImage: "linear-gradient(rgba(6,182,212,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(6,182,212,0.06) 1px,transparent 1px)",
      backgroundSize: "16px 16px"
    }} />
  </>;
}

function DevDecor() {
  return <>
    {/* Big terminal */}
    <div className="absolute" style={{ top: "12%", right: "4%", width: 148, background: "rgba(0,0,0,0.75)", border: "1px solid rgba(74,222,128,0.35)", boxShadow: "0 0 16px rgba(74,222,128,0.1)" }}>
      <div style={{ background: "rgba(74,222,128,0.12)", padding: "3px 8px", borderBottom: "1px solid rgba(74,222,128,0.2)", display: "flex", alignItems: "center", gap: 3 }}>
        {["#f87171","#facc15","#4ade80"].map((c,i) => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: c, opacity: 0.8 }} />)}
        <span style={{ fontFamily: "'Press Start 2P'", fontSize: 5, color: "rgba(74,222,128,0.5)", marginLeft: 4 }}>zsh</span>
      </div>
      <div style={{ padding: "6px 8px", fontFamily: "'Press Start 2P'", fontSize: 5, color: "rgba(74,222,128,0.75)", lineHeight: 2.2 }}>
        <div><span style={{ color: "rgba(74,222,128,0.4)" }}>~$</span> git push</div>
        <div style={{ color: "rgba(74,222,128,0.5)" }}>↳ origin/main ✓</div>
        <div><span style={{ color: "rgba(74,222,128,0.4)" }}>~$</span> vercel --prod</div>
        <div style={{ color: "rgba(74,222,128,0.5)" }}>↳ deployed ✓</div>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <span style={{ color: "rgba(74,222,128,0.4)" }}>~$</span>
          <span className="blink" style={{ display: "inline-block", width: 6, height: 10, background: "#4ade80" }} />
        </div>
      </div>
    </div>
    {/* Desk */}
    <div className="absolute" style={{ bottom: 56, left: 10, right: 10, height: 10, background: "rgba(22,101,52,0.4)", border: "1px solid rgba(74,222,128,0.2)" }} />
    {/* Keyboard */}
    <div className="absolute" style={{ bottom: 70, left: 16, display: "grid", gridTemplateColumns: "repeat(12, 7px)", gap: 1.5 }}>
      {Array.from({ length: 36 }).map((_, i) => (
        <div key={i} style={{ width: 7, height: 6, background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.1)" }} />
      ))}
    </div>
    {/* Coffee mug */}
    <div className="absolute" style={{ bottom: 74, left: 10 }}>
      <svg width="14" height="16" viewBox="0 0 14 16" style={{ imageRendering: "pixelated" }}>
        <rect x="1" y="4" width="9" height="10" fill="rgba(74,222,128,0.3)" />
        <rect x="0" y="4" width="1" height="10" fill="rgba(74,222,128,0.2)" />
        <rect x="10" y="4" width="1" height="10" fill="rgba(74,222,128,0.2)" />
        <rect x="1" y="14" width="9" height="2" fill="rgba(74,222,128,0.2)" />
        <rect x="10" y="6" width="3" height="5" fill="rgba(74,222,128,0.15)" />
        <rect x="2" y="2" width="7" height="2" fill="rgba(74,222,128,0.4)" />
      </svg>
    </div>
    {/* Bookshelf */}
    <div className="absolute" style={{ bottom: 56, right: 4, display: "flex", gap: 2, alignItems: "flex-end" }}>
      {[32,28,36,24,30,26].map((h,i) => (
        <div key={i} style={{ width: 8, height: h, background: `rgba(74,222,128,${0.15+i*0.04})`, border: "1px solid rgba(74,222,128,0.1)" }} />
      ))}
    </div>
    {/* Floor scanlines */}
    <div className="absolute inset-0 -z-10" style={{
      background: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(74,222,128,0.025) 3px,rgba(74,222,128,0.025) 4px)"
    }} />
  </>;
}

function MetaDecor() {
  return <>
    {/* Ring light */}
    <div className="absolute pulse" style={{ top: "10%", right: "8%", width: 56, height: 56, borderRadius: "50%", border: "4px solid rgba(244,114,182,0.5)", boxShadow: "0 0 20px rgba(244,114,182,0.3), inset 0 0 20px rgba(244,114,182,0.05)" }} />
    <div className="absolute" style={{ top: "calc(10% + 20px)", right: "calc(8% + 20px)", width: 16, height: 16, borderRadius: "50%", background: "rgba(244,114,182,0.8)", boxShadow: "0 0 12px rgba(244,114,182,0.6)" }} />
    {/* Camera on tripod */}
    <div className="absolute" style={{ bottom: 62, right: 20 }}>
      <svg width="36" height="44" viewBox="0 0 36 44" style={{ imageRendering: "pixelated" }}>
        <rect x="8" y="4" width="20" height="14" fill="rgba(244,114,182,0.6)" />
        <rect x="12" y="6" width="12" height="10" fill="rgba(244,114,182,0.3)" rx="1" />
        <rect x="14" y="7" width="8" height="8" fill="rgba(253,164,175,0.4)" rx="1" />
        <rect x="22" y="6" width="4" height="4" fill="rgba(244,114,182,0.4)" />
        <rect x="17" y="18" width="2" height="10" fill="rgba(244,114,182,0.4)" />
        <rect x="10" y="28" width="6" height="2" fill="rgba(244,114,182,0.3)" />
        <rect x="20" y="28" width="6" height="2" fill="rgba(244,114,182,0.3)" />
        <rect x="8" y="30" width="4" height="12" fill="rgba(244,114,182,0.25)" />
        <rect x="24" y="30" width="4" height="12" fill="rgba(244,114,182,0.25)" />
      </svg>
    </div>
    {/* Analytics chart */}
    <div className="absolute" style={{ top: "18%", left: "6%", width: 110, height: 70, background: "rgba(157,23,77,0.12)", border: "1px solid rgba(244,114,182,0.2)" }}>
      <div style={{ padding: "4px 6px 0", fontFamily: "'Press Start 2P'", fontSize: 5, color: "rgba(244,114,182,0.5)" }}>REACH</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, padding: "4px 8px", height: 50 }}>
        {[22,38,30,55,42,70,58].map((h,i) => (
          <div key={i} style={{ flex: 1, height: `${h}%`, background: `rgba(244,114,182,${0.2+i*0.07})`, boxShadow: i===5?"0 0 6px rgba(244,114,182,0.5)":"none" }} />
        ))}
      </div>
    </div>
    {/* Desk */}
    <div className="absolute" style={{ bottom: 56, left: 10, right: 10, height: 10, background: "rgba(157,23,77,0.35)", border: "1px solid rgba(244,114,182,0.2)" }} />
    {/* Phone */}
    <div className="absolute" style={{ bottom: 68, left: 18 }}>
      <svg width="16" height="26" viewBox="0 0 16 26" style={{ imageRendering: "pixelated" }}>
        <rect x="1" y="0" width="14" height="24" fill="rgba(244,114,182,0.35)" />
        <rect x="2" y="2" width="12" height="18" fill="rgba(157,23,77,0.4)" />
        <rect x="5" y="21" width="6" height="2" fill="rgba(244,114,182,0.3)" rx="1" />
        <rect x="3" y="4" width="10" height="14" fill="rgba(244,114,182,0.15)" />
      </svg>
    </div>
    {/* Floor gradient */}
    <div className="absolute inset-0 -z-10" style={{
      background: "radial-gradient(ellipse at 60% 80%, rgba(157,23,77,0.15) 0%, transparent 60%)",
    }} />
    <div className="absolute inset-0 -z-10" style={{
      backgroundImage: "linear-gradient(45deg,rgba(244,114,182,0.04) 25%,transparent 25%),linear-gradient(-45deg,rgba(244,114,182,0.04) 25%,transparent 25%),linear-gradient(45deg,transparent 75%,rgba(244,114,182,0.04) 75%),linear-gradient(-45deg,transparent 75%,rgba(244,114,182,0.04) 75%)",
      backgroundSize: "16px 16px",
      backgroundPosition: "0 0,0 8px,8px -8px,-8px 0px"
    }} />
  </>;
}

// ── Room layout ───────────────────────────────────────────────────────────

interface RoomProps {
  title: string;
  subtitle: string;
  bg: string;
  accent: string;
  stats: { label: string; value: string }[];
  sprite: "luna" | "caster" | "dev" | "meta";
  glowColor: string;
  name: string;
  decoration: React.ReactNode;
}

function Room({ title, subtitle, bg, accent, stats, sprite, glowColor, name, decoration }: RoomProps) {
  return (
    <div className="relative overflow-hidden scanlines" style={{ background: bg, borderRight: "2px solid rgba(255,255,255,0.06)", borderBottom: "2px solid rgba(255,255,255,0.06)" }}>
      {decoration}

      {/* Title */}
      <div className="absolute top-3 left-3 z-10">
        <div className="room-title" style={{ color: accent }}>{title}</div>
        <div style={{ fontFamily: "'Press Start 2P'", fontSize: 5, color: "rgba(255,255,255,0.28)", marginTop: 3 }}>{subtitle}</div>
      </div>

      {/* Stats */}
      <div className="absolute bottom-3 left-3 z-20 flex flex-col gap-1">
        {stats.map((s) => (
          <div key={s.label} className="stat-chip" style={{ color: accent }}>
            <span style={{ color: "rgba(255,255,255,0.35)" }}>{s.label} </span>{s.value}
          </div>
        ))}
      </div>

      {/* Wall trim */}
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg,transparent,${accent}44,transparent)` }} />
      <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: `linear-gradient(90deg,transparent,${accent}33,transparent)` }} />

      <AgentSprite sprite={sprite} name={name} glowColor={glowColor} />
    </div>
  );
}

// ── Floor plan ────────────────────────────────────────────────────────────

export default function FloorPlan() {
  const stats = useLiveStats();
  const fmt = (v: number | undefined, fallback = "...") => v !== undefined ? String(v) : fallback;

  const rooms: RoomProps[] = [
    {
      title: "LUNARY",
      subtitle: "OBSERVATORY",
      bg: "#0d0618",
      accent: "#c084fc",
      glowColor: "#7c3aed",
      sprite: "luna",
      name: "LUNA",
      decoration: <LunaryDecor />,
      stats: [
        { label: "MAU", value: fmt(stats?.lunary.mau) },
        { label: "MRR", value: stats ? `£${stats.lunary.mrr.toFixed(2)}` : "..." },
        { label: "ONLINE", value: fmt(stats?.lunary.activeToday) },
      ],
    },
    {
      title: "SPELLCAST",
      subtitle: "COMMAND",
      bg: "#020c14",
      accent: "#22d3ee",
      glowColor: "#0e7490",
      sprite: "caster",
      name: "CASTER",
      decoration: <SpellcastDecor />,
      stats: [
        { label: "TODAY", value: stats ? `${stats.spellcast.postsToday} posts` : "..." },
        { label: "QUEUED", value: fmt(stats?.spellcast.scheduled) },
        { label: "ACCTS", value: fmt(stats?.spellcast.accounts) },
      ],
    },
    {
      title: "DEV",
      subtitle: "DEN",
      bg: "#030a03",
      accent: "#4ade80",
      glowColor: "#166534",
      sprite: "dev",
      name: "DEV",
      decoration: <DevDecor />,
      stats: [
        { label: "COMMITS", value: stats ? `${stats.github.commitsToday} today` : "..." },
        { label: "REPOS", value: fmt(stats?.github.repos) },
        { label: "GH FOLLOWERS", value: fmt(stats?.github.followers) },
      ],
    },
    {
      title: "META",
      subtitle: "ANALYTICS",
      bg: "#0f0820",
      accent: "#f472b6",
      glowColor: "#9d174d",
      sprite: "meta",
      name: "META",
      decoration: <MetaDecor />,
      stats: [
        { label: "IG FOLLOWERS", value: stats ? stats.meta.followers.toLocaleString() : "..." },
        { label: "REACH/WK", value: stats ? `${(stats.meta.reachThisWeek / 1000).toFixed(1)}k` : "..." },
        { label: "POSTS/WK", value: fmt(stats?.meta.postsThisWeek) },
      ],
    },
  ];

  return (
    <div className="w-screen h-screen" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr" }}>
      {rooms.map((r) => <Room key={r.title} {...r} />)}

      {/* Centre crosshair */}
      <div className="fixed inset-0 pointer-events-none z-30" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 14, height: 2, background: "rgba(255,255,255,0.12)" }} />
        <div style={{ width: 2, height: 14, background: "rgba(255,255,255,0.12)", position: "absolute" }} />
        <div style={{ width: 6, height: 6, border: "1px solid rgba(255,255,255,0.1)", position: "absolute" }} />
      </div>

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
    <div className="fixed bottom-3 right-4 z-30" style={{ fontFamily: "'Press Start 2P'", fontSize: 8, color: "rgba(255,255,255,0.18)", letterSpacing: "0.05em" }}>
      {time}
    </div>
  );
}
