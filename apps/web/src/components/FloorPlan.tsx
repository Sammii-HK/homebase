"use client";

import { useState, useEffect } from "react";
import AgentSprite from "./AgentSprite";
import { useLiveStats } from "@/hooks/useLiveStats";

// ── SDV-style room shell ──────────────────────────────────────────────────
// Each room: upper wall (35%) + lower floor (65%) with wooden planks

interface RoomShellProps {
  wallColor: string;
  wallPattern?: string;
  floorA: string;
  floorB: string;
  trim: string;
  children: React.ReactNode;
}

function RoomShell({ wallColor, wallPattern, floorA, floorB, trim, children }: RoomShellProps) {
  return (
    <div className="relative overflow-hidden" style={{ borderRight: "2px solid rgba(0,0,0,0.5)", borderBottom: "2px solid rgba(0,0,0,0.5)" }}>
      {/* Wall */}
      <div className="absolute inset-x-0 top-0" style={{
        height: "36%",
        background: wallColor,
        backgroundImage: wallPattern,
      }} />
      {/* Baseboard trim */}
      <div className="absolute inset-x-0" style={{
        top: "36%",
        height: 5,
        background: trim,
        boxShadow: "0 2px 0 rgba(0,0,0,0.4)",
        zIndex: 2,
      }} />
      {/* Floor planks */}
      <div className="absolute inset-x-0 bottom-0" style={{
        top: "calc(36% + 5px)",
        backgroundImage: `repeating-linear-gradient(180deg, ${floorA} 0px, ${floorA} 13px, ${floorB} 13px, ${floorB} 14px, ${floorA} 14px)`,
        backgroundSize: "100% 28px",
      }} />
      {/* Scanline subtle overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.04) 2px,rgba(0,0,0,0.04) 3px)",
        zIndex: 1,
      }} />
      {/* Content */}
      <div className="absolute inset-0" style={{ zIndex: 3 }}>
        {children}
      </div>
    </div>
  );
}

// ── Furniture helpers ─────────────────────────────────────────────────────

function Bookshelf({ x, y, w = 64, books }: { x: number; y: number; w?: number; books: string[] }) {
  return (
    <div className="absolute" style={{ left: x, bottom: y }}>
      {/* shelf back */}
      <div style={{ width: w, height: 36, background: "#5c3d1e", border: "2px solid #3d2710", boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", alignItems: "flex-end", height: "100%", padding: "0 3px 2px", gap: 2 }}>
          {books.map((c, i) => (
            <div key={i} style={{ flex: 1, height: 22 + (i % 3) * 4, background: c, boxShadow: "inset -1px 0 rgba(0,0,0,0.2)" }} />
          ))}
        </div>
      </div>
      {/* feet */}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "0 4px" }}>
        <div style={{ width: 6, height: 4, background: "#3d2710" }} />
        <div style={{ width: 6, height: 4, background: "#3d2710" }} />
      </div>
    </div>
  );
}

function Desk({ x, y, w = 80, h = 12, color = "#7a5c2e", children }: { x: number; y: number; w?: number; h?: number; color?: string; children?: React.ReactNode }) {
  return (
    <div className="absolute" style={{ left: x, bottom: y }}>
      <div style={{ width: w, height: h, background: color, border: "2px solid #5a3e1a", boxShadow: "0 3px 0 #3d2810" }}>
        {children}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "0 4px" }}>
        <div style={{ width: 8, height: 16, background: "#5a3e1a" }} />
        <div style={{ width: 8, height: 16, background: "#5a3e1a" }} />
      </div>
    </div>
  );
}

function Window({ x, top, light }: { x: number | string; top: number | string; light: string }) {
  return (
    <div className="absolute" style={{ left: x, top, width: 40, height: 32 }}>
      {/* frame */}
      <div style={{ position: "absolute", inset: 0, background: "#8B6914", border: "3px solid #6B4C1E" }} />
      {/* glow */}
      <div style={{ position: "absolute", inset: 3, background: light, boxShadow: `0 0 16px ${light}` }} />
      {/* panes */}
      <div style={{ position: "absolute", top: 3, left: "50%", width: 2, height: "calc(100% - 6px)", background: "#6B4C1E", transform: "translateX(-50%)" }} />
      <div style={{ position: "absolute", top: "50%", left: 3, height: 2, width: "calc(100% - 6px)", background: "#6B4C1E", transform: "translateY(-50%)" }} />
    </div>
  );
}

function Rug({ x, y, w, h, color }: { x: number; y: number; w: number; h: number; color: string }) {
  return (
    <div className="absolute" style={{ left: x, bottom: y, width: w, height: h, background: color, border: `2px solid ${color}88`, boxShadow: "inset 0 0 0 3px rgba(255,255,255,0.06)", opacity: 0.7 }} />
  );
}

function Plant({ x, y }: { x: number; y: number }) {
  return (
    <div className="absolute" style={{ left: x, bottom: y }}>
      <svg width="18" height="24" viewBox="0 0 18 24" style={{ imageRendering: "pixelated" }}>
        <rect x="6" y="16" width="6" height="8" fill="#8B6914" />
        <rect x="5" y="20" width="8" height="2" fill="#6B4C1E" />
        <rect x="4" y="8" width="4" height="8" fill="#166534" />
        <rect x="10" y="6" width="4" height="8" fill="#15803d" />
        <rect x="7" y="4" width="4" height="10" fill="#16a34a" />
        <rect x="5" y="10" width="2" height="4" fill="#166534" />
        <rect x="11" y="9" width="2" height="4" fill="#166534" />
      </svg>
    </div>
  );
}

function Candle({ x, y, color = "#fde68a" }: { x: number; y: number; color?: string }) {
  return (
    <div className="absolute pulse" style={{ left: x, bottom: y }}>
      <svg width="8" height="16" viewBox="0 0 8 16" style={{ imageRendering: "pixelated" }}>
        <rect x="2" y="0" width="2" height="2" fill={color} />
        <rect x="1" y="1" width="4" height="1" fill={color} opacity="0.6" />
        <rect x="2" y="2" width="4" height="11" fill="#f5f5dc" />
        <rect x="1" y="13" width="6" height="3" fill="#e8e8c8" />
      </svg>
    </div>
  );
}

function Monitor({ x, y, w = 52, screenContent }: { x: number; y: number; w?: number; screenContent?: React.ReactNode }) {
  return (
    <div className="absolute" style={{ left: x, bottom: y }}>
      {/* screen */}
      <div style={{ width: w, height: 36, background: "#1a1a2e", border: "3px solid #4a4a5a", boxShadow: "0 0 8px rgba(100,200,255,0.15)" }}>
        <div style={{ margin: 3, height: "calc(100% - 6px)", background: "#0d1117", overflow: "hidden", padding: "3px 4px" }}>
          {screenContent}
        </div>
      </div>
      {/* stand */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ width: 6, height: 6, background: "#4a4a5a" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ width: 20, height: 3, background: "#3a3a4a" }} />
      </div>
    </div>
  );
}

// ── Room decorations ──────────────────────────────────────────────────────

function LunaryRoom() {
  return <>
    {/* Windows */}
    <Window x="15%" top={8} light="rgba(139,92,246,0.4)" />
    <Window x="55%" top={8} light="rgba(167,139,250,0.3)" />

    {/* Moon painting on wall */}
    <div className="absolute" style={{ right: "8%", top: 8, width: 30, height: 30, borderRadius: "50%", border: "3px solid #5b21b6", background: "radial-gradient(circle at 38% 35%, #ddd6fe 0%, #7c3aed 70%)", boxShadow: "0 0 12px rgba(124,58,237,0.6)" }} />

    {/* Bookshelf */}
    <Bookshelf x={8} y={56} w={72} books={["#7c3aed","#6d28d9","#a78bfa","#4c1d95","#8b5cf6","#5b21b6","#c4b5fd"]} />

    {/* Telescope on desk */}
    <Desk x={90} y={56} w={90} color="#5c3d1e">
      <div style={{ position: "absolute", top: -20, left: 12 }}>
        <svg width="32" height="24" viewBox="0 0 32 24" style={{ imageRendering: "pixelated" }}>
          <rect x="14" y="0" width="4" height="16" fill="#a78bfa" />
          <rect x="8" y="4" width="14" height="6" fill="#7c3aed" />
          <rect x="2" y="7" width="8" height="5" fill="#6d28d9" />
          <rect x="12" y="16" width="2" height="6" fill="#8b5cf6" />
          <rect x="8" y="22" width="14" height="2" fill="#5b21b6" />
        </svg>
      </div>
      {/* Crystal ball */}
      <div style={{ position: "absolute", top: -18, right: 8, width: 18, height: 18, borderRadius: "50%", background: "radial-gradient(circle at 40% 35%, rgba(221,214,254,0.9), rgba(139,92,246,0.7))", border: "2px solid #7c3aed", boxShadow: "0 0 8px rgba(139,92,246,0.5)" }} />
    </Desk>

    {/* Rug */}
    <Rug x={70} y={56} w={120} h={36} color="#5b21b6" />

    {/* Stars on floor */}
    {[[85,80],[110,95],[140,75]].map(([lx,by],i) => (
      <div key={i} className="pulse absolute" style={{ left: lx, bottom: by, width: 3, height: 3, background: "#c4b5fd", boxShadow: "0 0 4px #c4b5fd", animationDelay: `${i*0.4}s` }} />
    ))}

    {/* Candles */}
    <Candle x={82} y={68} />
    <Candle x={160} y={68} />

    {/* Plant */}
    <Plant x={8} y={56} />
  </>;
}

function SpellcastRoom() {
  return <>
    {/* Windows */}
    <Window x="18%" top={6} light="rgba(6,182,212,0.3)" />

    {/* Pinboard on wall */}
    <div className="absolute" style={{ right: "6%", top: 4, width: 70, height: 50, background: "#b5875a", border: "3px solid #8B6914" }}>
      {[
        { x: 4, y: 4, w: 28, h: 8, c: "#fef3c7" },
        { x: 36, y: 4, w: 28, h: 6, c: "#ecfdf5" },
        { x: 4, y: 16, w: 20, h: 6, c: "#fce7f3" },
        { x: 28, y: 14, w: 36, h: 8, c: "#eff6ff" },
        { x: 4, y: 26, w: 60, h: 16, c: "rgba(34,211,238,0.2)", border: "1px solid rgba(34,211,238,0.4)" },
      ].map((p, i) => (
        <div key={i} className="absolute" style={{ left: p.x, top: p.y, width: p.w, height: p.h, background: p.c, border: (p as { border?: string }).border }} />
      ))}
      {/* push pins */}
      {[[5,5],[37,5],[65,5]].map(([px,py],i) => (
        <div key={i} className="absolute" style={{ left: px, top: py, width: 4, height: 4, borderRadius: "50%", background: "#ef4444" }} />
      ))}
    </div>

    {/* 2 Monitors */}
    <Monitor x={10} y={68}
      screenContent={<>
        {[80,55,70,40,60].map((w,i) => <div key={i} style={{ width:`${w}%`, height:2, background:`rgba(34,211,238,${0.3+i*0.08})`, marginBottom:3 }} />)}
        <div className="blink" style={{ width:4, height:7, background:"#22d3ee" }} />
      </>}
    />
    <Monitor x={72} y={68} w={48}
      screenContent={<>
        <div style={{ display:"flex", alignItems:"flex-end", gap:2, height:"100%" }}>
          {[60,80,50,90,70].map((h,i) => <div key={i} style={{ flex:1, height:`${h}%`, background:`rgba(34,211,238,${0.25+i*0.1})` }} />)}
        </div>
      </>}
    />

    {/* Desk */}
    <Desk x={0} y={56} w={190} h={14} color="#7a5c2e">
      {/* keyboard */}
      <div style={{ position:"absolute", bottom:15, left:18, display:"grid", gridTemplateColumns:"repeat(10,6px)", gap:1.5 }}>
        {Array.from({length:20}).map((_,i) => <div key={i} style={{ width:6, height:5, background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.06)" }} />)}
      </div>
    </Desk>

    {/* Status indicators */}
    <div className="absolute" style={{ right:8, bottom:68, display:"flex", flexDirection:"column", gap:4 }}>
      {[["#4ade80","ON"],["#facc15","Q"],["#f472b6","IG"]].map(([c,l]) => (
        <div key={l} style={{ display:"flex", alignItems:"center", gap:4 }}>
          <div className="pulse" style={{ width:6, height:6, background:c, boxShadow:`0 0 5px ${c}` }} />
          <span style={{ fontFamily:"'Press Start 2P'", fontSize:5, color:"rgba(255,255,255,0.35)" }}>{l}</span>
        </div>
      ))}
    </div>

    {/* Calendar */}
    <div className="absolute" style={{ left:8, bottom:80, display:"grid", gridTemplateColumns:"repeat(7,8px)", gap:2 }}>
      {Array.from({length:28}).map((_,i) => <div key={i} style={{ width:8, height:8, background: i<19?`rgba(34,211,238,${0.15+Math.random()*0.35})`:"rgba(255,255,255,0.06)" }} />)}
    </div>

    <Plant x={170} y={70} />
    <Candle x={160} y={70} color="#22d3ee" />
    <Rug x={10} y={56} w={160} h={40} color="#0e4f5f" />
  </>;
}

function DevRoom() {
  return <>
    {/* Windows */}
    <Window x="12%" top={6} light="rgba(74,222,128,0.25)" />
    <Window x="52%" top={6} light="rgba(74,222,128,0.2)" />

    {/* Big terminal on wall-mounted monitor */}
    <div className="absolute" style={{ right:"4%", top:4, width:100, background:"#0d1117", border:"3px solid #30363d", boxShadow:"0 0 12px rgba(74,222,128,0.15)" }}>
      <div style={{ background:"#161b22", padding:"2px 6px", borderBottom:"1px solid #30363d", display:"flex", alignItems:"center", gap:3 }}>
        {["#f87171","#facc15","#4ade80"].map((c,i) => <div key={i} style={{ width:5, height:5, borderRadius:"50%", background:c, opacity:0.8 }} />)}
        <span style={{ fontFamily:"'Press Start 2P'", fontSize:4, color:"rgba(74,222,128,0.5)", marginLeft:3 }}>terminal</span>
      </div>
      <div style={{ padding:"4px 6px", fontFamily:"'Press Start 2P'", fontSize:4, color:"rgba(74,222,128,0.8)", lineHeight:2.2 }}>
        <div><span style={{ color:"rgba(74,222,128,0.4)" }}>$</span> git push ✓</div>
        <div><span style={{ color:"rgba(74,222,128,0.4)" }}>$</span> pnpm dev</div>
        <div style={{ color:"rgba(74,222,128,0.5)" }}>  → localhost:3005</div>
        <div style={{ display:"flex", alignItems:"center", gap:2 }}>
          <span style={{ color:"rgba(74,222,128,0.4)" }}>$</span>
          <span className="blink" style={{ display:"inline-block", width:5, height:8, background:"#4ade80" }} />
        </div>
      </div>
    </div>

    {/* Main desk with laptop */}
    <Desk x={0} y={56} w={180} h={14} color="#6b4c2a">
      {/* laptop */}
      <div style={{ position:"absolute", bottom:15, left:10, width:48, height:32 }}>
        <div style={{ width:48, height:28, background:"#1a1a2e", border:"2px solid #30363d", padding:3 }}>
          {[70,50,80,40].map((w,i) => <div key={i} style={{ width:`${w}%`, height:2, background:`rgba(74,222,128,${0.25+i*0.1})`, marginBottom:2 }} />)}
        </div>
        <div style={{ width:54, height:4, background:"#2a2a3e", marginLeft:-3 }} />
      </div>
      {/* coffee */}
      <div style={{ position:"absolute", bottom:15, left:66 }}>
        <svg width="12" height="14" viewBox="0 0 12 14" style={{ imageRendering:"pixelated" }}>
          <rect x="1" y="3" width="8" height="9" fill="rgba(74,222,128,0.25)" />
          <rect x="0" y="3" width="1" height="9" fill="rgba(74,222,128,0.15)" />
          <rect x="9" y="3" width="1" height="9" fill="rgba(74,222,128,0.15)" />
          <rect x="1" y="12" width="8" height="2" fill="rgba(74,222,128,0.15)" />
          <rect x="9" y="5" width="3" height="4" fill="rgba(74,222,128,0.1)" />
          <rect x="2" y="1" width="6" height="2" fill="rgba(74,222,128,0.3)" />
        </svg>
      </div>
    </Desk>

    {/* Bookshelf */}
    <Bookshelf x={185} y={56} w={-1} books={[]} />
    <div className="absolute" style={{ right:0, bottom:56 }}>
      <div style={{ width:32, height:60, background:"#3d2710", border:"2px solid #2d1b0a", display:"flex", flexDirection:"column", justifyContent:"flex-end", padding:"3px 2px", gap:2 }}>
        {["#166534","#14532d","#4ade80","#065f46","#052e16","#15803d"].map((c,i) => <div key={i} style={{ height:8+(i%2)*2, background:c, border:"1px solid rgba(0,0,0,0.2)" }} />)}
      </div>
    </div>

    <Plant x={8} y={56} />
    <Plant x={35} y={56} />
    <Candle x={160} y={70} color="#4ade80" />
    <Rug x={50} y={56} w={120} h={38} color="#14532d" />
  </>;
}

function MetaRoom() {
  return <>
    {/* Windows */}
    <Window x="15%" top={6} light="rgba(244,114,182,0.35)" />
    <Window x="55%" top={6} light="rgba(249,168,212,0.25)" />

    {/* Analytics chart on wall */}
    <div className="absolute" style={{ right:"5%", top:4, width:80, height:52, background:"rgba(157,23,77,0.2)", border:"2px solid rgba(244,114,182,0.4)" }}>
      <div style={{ padding:"3px 5px 0", fontFamily:"'Press Start 2P'", fontSize:4, color:"rgba(244,114,182,0.6)" }}>REACH ↗</div>
      <div style={{ display:"flex", alignItems:"flex-end", gap:2, padding:"3px 6px", height:40 }}>
        {[25,40,32,58,45,74,62].map((h,i) => <div key={i} style={{ flex:1, height:`${h}%`, background:`rgba(244,114,182,${0.2+i*0.08})`, boxShadow:i===5?"0 0 5px rgba(244,114,182,0.6)":"none" }} />)}
      </div>
    </div>

    {/* Camera on tripod */}
    <div className="absolute" style={{ left:10, bottom:68 }}>
      <svg width="28" height="44" viewBox="0 0 28 44" style={{ imageRendering:"pixelated" }}>
        <rect x="6" y="3" width="16" height="12" fill="rgba(244,114,182,0.7)" />
        <rect x="8" y="5" width="12" height="8" fill="rgba(244,114,182,0.4)" rx="1" />
        <rect x="10" y="6" width="8" height="6" fill="rgba(253,164,175,0.4)" rx="1" />
        <rect x="18" y="4" width="4" height="4" fill="rgba(244,114,182,0.5)" />
        <rect x="13" y="15" width="2" height="8" fill="rgba(244,114,182,0.5)" />
        <rect x="7" y="23" width="6" height="2" fill="rgba(244,114,182,0.4)" />
        <rect x="15" y="23" width="6" height="2" fill="rgba(244,114,182,0.4)" />
        <rect x="6" y="25" width="3" height="14" fill="rgba(244,114,182,0.3)" />
        <rect x="19" y="25" width="3" height="14" fill="rgba(244,114,182,0.3)" />
      </svg>
    </div>

    {/* Ring light */}
    <div className="absolute pulse" style={{ left:40, bottom:72, width:44, height:44, borderRadius:"50%", border:"5px solid rgba(244,114,182,0.5)", boxShadow:"0 0 14px rgba(244,114,182,0.3)" }} />
    <div className="absolute" style={{ left:60, bottom:87, width:8, height:8, borderRadius:"50%", background:"rgba(253,164,175,0.9)", boxShadow:"0 0 8px rgba(244,114,182,0.7)" }} />

    {/* Desk */}
    <Desk x={90} y={56} w={110} h={14} color="#8B4513">
      {/* phone */}
      <div style={{ position:"absolute", bottom:15, left:8 }}>
        <svg width="14" height="22" viewBox="0 0 14 22" style={{ imageRendering:"pixelated" }}>
          <rect x="1" y="0" width="12" height="20" fill="rgba(244,114,182,0.4)" />
          <rect x="2" y="1" width="10" height="16" fill="rgba(157,23,77,0.5)" />
          <rect x="4" y="18" width="6" height="2" fill="rgba(244,114,182,0.3)" rx="1" />
          <rect x="3" y="2" width="8" height="12" fill="rgba(244,114,182,0.15)" />
        </svg>
      </div>
      {/* notebook */}
      <div style={{ position:"absolute", bottom:15, left:30, width:36, height:26, background:"#fdf2f8", border:"1px solid rgba(244,114,182,0.4)", padding:3 }}>
        {[90,60,80,50].map((w,i) => <div key={i} style={{ width:`${w}%`, height:2, background:"rgba(244,114,182,0.3)", marginBottom:3 }} />)}
      </div>
    </Desk>

    <Plant x={92} y={56} />
    <Bookshelf x={140} y={56} w={60} books={["#be185d","#f472b6","#9d174d","#ec4899","#831843"]} />
    <Candle x={96} y={70} />
    <Rug x={90} y={56} w={110} h={40} color="#831843" />
  </>;
}

// ── Room definition ───────────────────────────────────────────────────────

interface RoomConfig {
  shellProps: Omit<RoomShellProps, "children">;
  title: string;
  subtitle: string;
  accent: string;
  sprite: "luna" | "caster" | "dev" | "meta";
  glowColor: string;
  name: string;
  decoration: React.ReactNode;
  stats: { label: string; value: string }[];
}

function Room({ config }: { config: RoomConfig }) {
  const { shellProps, title, subtitle, accent, sprite, glowColor, name, decoration, stats } = config;
  return (
    <RoomShell {...shellProps}>
      {decoration}
      {/* Title */}
      <div className="absolute top-2 left-3" style={{ zIndex:10 }}>
        <div className="room-title" style={{ color: accent }}>{title}</div>
        <div style={{ fontFamily:"'Press Start 2P'", fontSize:5, color:"rgba(255,255,255,0.35)", marginTop:3 }}>{subtitle}</div>
      </div>
      {/* Stats */}
      <div className="absolute bottom-2 left-3" style={{ zIndex:10, display:"flex", flexDirection:"column", gap:2 }}>
        {stats.map((s) => (
          <div key={s.label} className="stat-chip" style={{ color: accent }}>
            <span style={{ color:"rgba(255,255,255,0.4)" }}>{s.label} </span>{s.value}
          </div>
        ))}
      </div>
      <AgentSprite sprite={sprite} name={name} glowColor={glowColor} />
    </RoomShell>
  );
}

// ── Floor plan ────────────────────────────────────────────────────────────

export default function FloorPlan() {
  const stats = useLiveStats();
  const fmt = (v: number | undefined) => v !== undefined ? String(v) : "...";

  const rooms: RoomConfig[] = [
    {
      shellProps: { wallColor:"#1e0a3c", wallPattern:"repeating-linear-gradient(90deg,rgba(255,255,255,0.02) 0px,rgba(255,255,255,0.02) 1px,transparent 1px,transparent 24px)", floorA:"#3d1f6b", floorB:"#341a5c", trim:"#5b21b6" },
      title:"LUNARY", subtitle:"OBSERVATORY", accent:"#c084fc",
      sprite:"luna", glowColor:"#7c3aed", name:"LUNA",
      decoration:<LunaryRoom />,
      stats:[
        { label:"MAU", value: fmt(stats?.lunary.mau) },
        { label:"MRR", value: stats ? `£${stats.lunary.mrr.toFixed(2)}` : "..." },
        { label:"ONLINE", value: fmt(stats?.lunary.activeToday) },
      ],
    },
    {
      shellProps: { wallColor:"#0a1f2e", wallPattern:"repeating-linear-gradient(90deg,rgba(34,211,238,0.03) 0px,rgba(34,211,238,0.03) 1px,transparent 1px,transparent 20px)", floorA:"#1a3a2e", floorB:"#163222", trim:"#0e7490" },
      title:"SPELLCAST", subtitle:"COMMAND", accent:"#22d3ee",
      sprite:"caster", glowColor:"#0e7490", name:"CASTER",
      decoration:<SpellcastRoom />,
      stats:[
        { label:"TODAY", value: stats ? `${stats.spellcast.postsToday} posts` : "..." },
        { label:"QUEUED", value: fmt(stats?.spellcast.scheduled) },
        { label:"ACCTS", value: fmt(stats?.spellcast.accounts) },
      ],
    },
    {
      shellProps: { wallColor:"#0c1a0c", wallPattern:"repeating-linear-gradient(180deg,rgba(74,222,128,0.025) 0px,rgba(74,222,128,0.025) 1px,transparent 1px,transparent 20px)", floorA:"#1f2e14", floorB:"#182610", trim:"#166534" },
      title:"DEV", subtitle:"DEN", accent:"#4ade80",
      sprite:"dev", glowColor:"#166534", name:"DEV",
      decoration:<DevRoom />,
      stats:[
        { label:"COMMITS", value: stats ? `${stats.github.commitsToday} today` : "..." },
        { label:"REPOS", value: fmt(stats?.github.repos) },
        { label:"FOLLOWERS", value: fmt(stats?.github.followers) },
      ],
    },
    {
      shellProps: { wallColor:"#2a0a14", wallPattern:"radial-gradient(ellipse at 50% 0%, rgba(244,114,182,0.08) 0%, transparent 70%)", floorA:"#3d1420", floorB:"#34101a", trim:"#9d174d" },
      title:"META", subtitle:"ANALYTICS", accent:"#f472b6",
      sprite:"meta", glowColor:"#9d174d", name:"META",
      decoration:<MetaRoom />,
      stats:[
        { label:"IG FOLLOWERS", value: stats ? stats.meta.followers.toLocaleString() : "..." },
        { label:"REACH/WK", value: stats ? `${(stats.meta.reachThisWeek/1000).toFixed(1)}k` : "..." },
        { label:"POSTS/WK", value: fmt(stats?.meta.postsThisWeek) },
      ],
    },
  ];

  return (
    <div className="w-screen h-screen" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gridTemplateRows:"1fr 1fr" }}>
      {rooms.map((r) => <Room key={r.title} config={r} />)}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex:50, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ width:14, height:2, background:"rgba(255,255,255,0.1)" }} />
        <div style={{ position:"absolute", width:2, height:14, background:"rgba(255,255,255,0.1)" }} />
        <div style={{ position:"absolute", width:6, height:6, border:"1px solid rgba(255,255,255,0.08)" }} />
      </div>
      <Clock />
    </div>
  );
}

function Clock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit", second:"2-digit" }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="fixed bottom-2 right-3" style={{ zIndex:50, fontFamily:"'Press Start 2P'", fontSize:7, color:"rgba(255,255,255,0.2)", letterSpacing:"0.05em" }}>
      {time}
    </div>
  );
}
