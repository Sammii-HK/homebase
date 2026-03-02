"use client";

import AgentSprite from "./AgentSprite";

interface Stat { label: string; value: string; }

interface RoomConfig {
  id: string;
  title: string;
  subtitle: string;
  bg: string;
  accent: string;
  pattern: string;
  agent: { emoji: string; name: string; color: string };
  stats: Stat[];
  decoration: React.ReactNode;
}

export default function Room({ config }: { config: RoomConfig }) {
  return (
    <div
      className="relative overflow-hidden scanlines"
      style={{ background: config.bg, borderRight: "2px solid rgba(255,255,255,0.08)", borderBottom: "2px solid rgba(255,255,255,0.08)" }}
    >
      {/* Background pattern */}
      <div className="absolute inset-0" style={{ backgroundImage: config.pattern, opacity: 0.6 }} />

      {/* Room label top-left */}
      <div className="absolute top-3 left-3 z-10">
        <div className="room-title" style={{ color: config.accent }}>{config.title}</div>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>
          {config.subtitle}
        </div>
      </div>

      {/* Decoration */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        {config.decoration}
      </div>

      {/* Stats — bottom left */}
      <div className="absolute bottom-3 left-3 z-20 flex flex-col gap-1">
        {config.stats.map((s) => (
          <div key={s.label} className="stat-chip" style={{ color: config.accent }}>
            <span style={{ color: "rgba(255,255,255,0.4)" }}>{s.label} </span>
            {s.value}
          </div>
        ))}
      </div>

      {/* Agent */}
      <AgentSprite {...config.agent} />
    </div>
  );
}
