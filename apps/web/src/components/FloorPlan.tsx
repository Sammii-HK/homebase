"use client";

import { useState, useEffect } from "react";
import AgentSprite, { ActivityState } from "./AgentSprite";
import { useActivityStream } from "@/hooks/useActivityStream";
import type { DashboardStats, HeartbeatResponse } from "@/types/dashboard";
import NotificationBadge from "./NotificationBadge";
import RoomDetail from "./RoomDetail";

// ── Pixel art renderer ────────────────────────────────────────────────────

function Px({
  data,
  colors,
  scale = 2,
}: {
  data: string[];
  colors: Record<string, string>;
  scale?: number;
}) {
  const h = data.length;
  const w = Math.max(...data.map((r) => r.length));
  const rects: React.ReactNode[] = [];
  data.forEach((row, y) => {
    row.split("").forEach((ch, x) => {
      if (ch === ".") return;
      const fill = colors[ch];
      if (!fill) return;
      rects.push(
        <rect key={`${x}-${y}`} x={x * scale} y={y * scale} width={scale} height={scale} fill={fill} />
      );
    });
  });
  return (
    <svg
      width={w * scale}
      height={h * scale}
      viewBox={`0 0 ${w * scale} ${h * scale}`}
      style={{ imageRendering: "pixelated", display: "block" }}
    >
      {rects}
    </svg>
  );
}

// ── SDV Room shell ─────────────────────────────────────────────────────────

interface RoomShellProps {
  wallColor: string;
  wallPattern?: string;
  floorA: string;
  floorB: string;
  trim: string;
  trimTop?: string;
  children: React.ReactNode;
}

function RoomShell({ wallColor, wallPattern, floorA, floorB, trim, trimTop, children }: RoomShellProps) {
  return (
    <div className="relative overflow-hidden" style={{ borderRight: "2px solid #000", borderBottom: "2px solid #000" }}>
      {/* Wall */}
      <div className="absolute inset-x-0 top-0" style={{ height: "38%", background: wallColor, backgroundImage: wallPattern }} />
      {/* Crown moulding top */}
      <div className="absolute inset-x-0 top-0" style={{ height: 4, background: trimTop ?? trim }} />
      {/* Baseboard trim */}
      <div className="absolute inset-x-0" style={{ top: "38%", height: 6, background: trim, borderTop: "2px solid rgba(0,0,0,0.5)", borderBottom: "2px solid rgba(0,0,0,0.6)", zIndex: 2 }} />
      {/* Floor */}
      <div className="absolute inset-x-0 bottom-0" style={{
        top: "calc(38% + 6px)",
        backgroundImage: `repeating-linear-gradient(180deg, ${floorA} 0px, ${floorA} 11px, ${floorB} 11px, ${floorB} 12px)`,
      }} />
      {/* Floor vertical planks */}
      <div className="absolute inset-x-0 bottom-0" style={{
        top: "calc(38% + 6px)",
        backgroundImage: `repeating-linear-gradient(90deg, transparent 0px, transparent 47px, rgba(0,0,0,0.08) 47px, rgba(0,0,0,0.08) 48px)`,
      }} />
      {/* Floor shadow at baseboard */}
      <div className="absolute inset-x-0" style={{ top: "calc(38% + 12px)", height: 8, background: "linear-gradient(rgba(0,0,0,0.18),transparent)", zIndex: 1 }} />
      {/* Content */}
      <div className="absolute inset-0" style={{ zIndex: 3 }}>{children}</div>
    </div>
  );
}

// ── Pixel art furniture sprites ────────────────────────────────────────────

// Bookshelf — 18w × 22h
const BOOKSHELF = {
  colors: {
    K: "#1a0a00", D: "#5c3a1e", W: "#8b6035", L: "#c49a60",
    R: "#c0392b", r: "#e74c3c", B: "#1d6fa4", b: "#2980b9",
    G: "#1a7a3c", g: "#27ae60", Y: "#c07c00", y: "#e69c00",
    P: "#6b2d9e", p: "#8e44ad", O: "#c45300", o: "#d97706",
    C: "#0e7490", c: "#0891b2",
  },
  data: [
    "KKKKKKKKKKKKKKKKKK",
    "KDDDDDDDDDDDDDDDDK",
    "KLLLLLLLLLLLLLLLLLK",
    "KRRRBBBGGGYYYPPPPk",
    "KRRRBBBGGGYYYPPPPk",
    "KRrrBbbGggYyyPpppk",
    "KRRRBBBGGGYYYPPPPk",
    "KWWWWWWWWWWWWWWWWk",
    "KWWWWWWWWWWWWWWWWk",
    "KBBBRRROOOGGGCCCCk",
    "KBBBRRROOOGGGCCCCk",
    "KBbbRrrOooGggCccck",
    "KBBBRRROOOGGGCCCCk",
    "KWWWWWWWWWWWWWWWWk",
    "KWWWWWWWWWWWWWWWWk",
    "KGGGBBBYYYRRROOOOk",
    "KGGGBBBYYYRRROOOOk",
    "KGggBbbYyyRrrOoook",
    "KGGGBBBYYYRRROOOOk",
    "KDDDDDDDDDDDDDDDDDK",
    "KDDDDDDDDDDDDDDDDDK",
    "KKKKKKKKKKKKKKKKKK",
  ],
};

// Desk — 28w × 8h
const DESK = {
  colors: { K: "#1a0a00", D: "#5c3a1e", W: "#8b6035", L: "#c49a60", S: "#a07040" },
  data: [
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "KWWWWWWWWWWWWWWWWWWWWWWWWWWK",
    "KWLLLLLLLLLLLLLLLLLLLLLLLLLWK",
    "KDDDDDDDDDDDDDDDDDDDDDDDDDDK",
    "KSSSSSSSSSSSSSSSSSSSSSSSSSSK",
    "..KK......................KK.",
    "..KK......................KK.",
    "..KK......................KK.",
  ],
};

// Monitor — 16w × 14h
const MONITOR = {
  colors: { K: "#111", D: "#2a2a3e", S: "#0d1117", G: "#22d3ee", g: "#0891b2", W: "#4a4a5a", w: "#3a3a4a", T: "#1a1a2e" },
  data: [
    "KKKKKKKKKKKKKKKK",
    "KTTTTTTTTTTTTTTk",
    "KDSSSSSSSSSSSSdk",
    "KDSgGGGgGgGGGSdk",
    "KDSSSgSSSgSSSSSdk",
    "KDSGGGgGGGgGGSdk",
    "KDSSSSSSSSSSSSSdk",
    "KDSgSGGGGgSSSSSdk",
    "KDSSSSSSSSSSSSSSdk",
    "KTTTTTTTTTTTTTTK",
    "KKKKKKKKKKKKKKK",
    "....KWWWWWwwK...",
    "....KwwwwwwwK...",
    "...Kwwwwwwwwwwk.",
  ],
};

// Laptop — 14w × 10h
const LAPTOP = {
  colors: { K: "#111", D: "#1a1a2e", S: "#0d1117", G: "#4ade80", g: "#16a34a", W: "#2a2a3e", w: "#1a2a1e" },
  data: [
    "KKKKKKKKKKKKKK",
    "KDSSSSSSSSSSSk",
    "KDSGgGGgGGgGSk",
    "KDSSSgSSSgSSSSk",
    "KDSGGGGGGGGGSk",
    "KDSSSSSSSSSSSk",
    "KKKKKKKKKKKKKK",
    "KWWWWWWWWWWWWWk",
    "Kwwwwwwwwwwwwwk",
    "KKKKKKKKKKKKKkk",
  ],
};

// Camera on tripod — 10w × 22h
const CAMERA = {
  colors: { K: "#111", C: "#f472b6", c: "#db2777", B: "#fda4af", D: "#be185d", L: "#831843", s: "#fce7f3" },
  data: [
    ".KCCCCCCCK.",
    "KCcccccccCk",
    "KCsBBBBBsCk",
    "KCsssBsssCk",
    "KCsBBBBBsCk",
    "KCCCKKKCCCK",
    "KCCcKDKcCCk",
    ".KCCKDKCCk.",
    "..KKKdKKK..",
    "....KdK.....",
    "....KdK.....",
    "...KdddK....",
    "..KdddddK...",
    "..KdK.KdK...",
    "..KdK.KdK...",
    "..KdK.KdK...",
    ".KLdK.KdLK..",
    ".KLLK.KLLK..",
    "..KK...KK...",
    "..........",
    "..........",
    "..........",
  ],
};

// Server rack — 10w × 20h
const SERVER = {
  colors: { K: "#111", D: "#0e2a2a", M: "#134e4a", L: "#0d9488", l: "#14b8a6", G: "#4ade80", g: "#86efac", R: "#f87171", W: "#1a2a28", S: "#0f3a36" },
  data: [
    "KKKKKKKKKK",
    "KDDDDDDDDk",
    "KMllllllMk",
    "KMGGGGGGMk",
    "KMllllllMk",
    "KDDDDDDDDk",
    "KMllllllMk",
    "KMGRGGGGMk",
    "KMllllllMk",
    "KDDDDDDDDk",
    "KMllllllMk",
    "KMGGGGGGMk",
    "KMllllllMk",
    "KDDDDDDDDk",
    "KMllllllMk",
    "KMGGRGGGMk",
    "KMllllllMk",
    "KDDDDDDDDk",
    "KWWWWWWWWK",
    "KKKKKKKKKK",
  ],
};

// Small candle — 4w × 8h
function CandleSprite({ color = "#fde68a" }: { color?: string }) {
  return (
    <Px scale={3} colors={{ F: color, f: "#fbbf24", W: "#f5f5dc", w: "#e8e8c8", K: "#111" }} data={[
      ".FF.",
      "FFFF",
      ".KK.",
      "KWWK",
      "KWWK",
      "KWWK",
      "KwwK",
      "KKKK",
    ]} />
  );
}

// Small plant — 8w × 10h
function PlantSprite({ accent = "#16a34a" }: { accent?: string }) {
  const G = accent;
  return (
    <Px scale={3} colors={{ G, g: "#166534", l: "#4ade80", K: "#111", D: "#5c3a1e", W: "#8b6035" }} data={[
      "...lG...",
      "..GgGl..",
      ".GgGGGg.",
      "GgGGGGgG",
      ".GgGGgG.",
      "..GKGg..",
      "...KK...",
      "..KDDDK.",
      "..KWWWK.",
      "...KKK..",
    ]} />
  );
}

// ── Wall art ───────────────────────────────────────────────────────────────

const MOON_PAINTING = {
  colors: { K: "#1a0a00", F: "#5b21b6", f: "#4c1d95", B: "#0f0820", s: "#1e1035", M: "#c4b5fd", m: "#a78bfa", W: "#ddd6fe", G: "#fde68a", g: "#fbbf24", D: "#7c3aed" },
  data: [
    "KKKKKKKKKKKKKKKKKKKK",
    "KFFFFFFFFFFFFFFFFFFk",
    "KFBBsBBsBBsBBsBBsBFk",
    "KFBsBBsBBsBBsBBsBBFk",
    "KFBBBBMmMBBBBBBBBBFk",
    "KFBBBmWWWmBBBBBBBBFk",
    "KFBBmWWMWWmBBBBBBBFk",
    "KFBBmWWWWWmBBBGGGBFk",
    "KFBBBmWWWmBBBBgGBBFk",
    "KFBBBBmMmBBBBBBBBBFk",
    "KFBBBBBBBBBBBBBBBBFk",
    "KFBBsBBsBBsBBsBBsBFk",
    "KFBsBBsBBsBBsBBsBBFk",
    "KFBBBBBBBBBBBBBBBBFk",
    "KFBBBBBBBBBBBBBBBBFk",
    "KFffffffffffffffff Fk",
    "KFFFFFFFFFFFFFFFFFFk",
    "KKKKKKKKKKKKKKKKKKKK",
  ],
};

const STAR_CHART = {
  colors: { K: "#111", B: "#0f0820", S: "#fde68a", s: "#fbbf24", P: "#c4b5fd", p: "#a78bfa", D: "#1e1035", W: "#2d1b69", F: "#4c1d95", f: "#5b21b6" },
  data: [
    "KKKKKKKKKKKKKKKK",
    "KFFFFFFFFFFFFFFk",
    "KfBBSBBBBBBBBBfk",
    "KfBBBBBBSBBBBBfk",
    "KfBBBBBBBBBBSBfk",
    "KfBSBBBBBBBBBBfk",
    "KfBBBBBSBBBBBBfk",
    "KfBBBBBBBBSBBBfk",
    "KfBBSBBBBBBBBBfk",
    "KfBBBBBBBBBBBSfk",
    "KfBBBBSBBBBBBBfk",
    "KfBBBBBBBSBBBBfk",
    "KFFFFFFFFFFFFFFk",
    "KKKKKKKKKKKKKKKK",
  ],
};

const CAULDRON = {
  colors: { K: "#111", P: "#4c1d95", p: "#7c3aed", B: "#8b5cf6", b: "#a78bfa", F: "#fbbf24", f: "#fde68a", S: "#6d28d9" },
  data: [
    ".f..F.f.....",
    "..f.....F...",
    "..KKKKKKKK..",
    ".KppppppppK.",
    "KpBBBBBBBBpK",
    "KpBbBbBbBBpK",
    "KpBBBBBBBBpK",
    ".KppppppppK.",
    "..KSSSSSKK..",
    "..KKKKKKKK..",
  ],
};

const WINDOW = {
  colors: { K: "#1a0a00", F: "#8B6914", f: "#6B4C1E", G: "#fde68a", g: "#fbbf24", B: "#bfdbfe", b: "#93c5fd", W: "#fff7ed", d: "#7c5200" },
  data: [
    "KKKKKKKKKKKKKK",
    "KFFFFFFFFFFFFk",
    "KFGGGGGGGGGFfk",
    "KFGBBbBBbBBGFk",
    "KFGBBbBBbBBGFk",
    "KFGbBBBBBBbGFk",
    "KFGBBbBBbBBGFk",
    "KFdddddddddFfk",
    "KFGBBbBBbBBGFk",
    "KFGBBbBBbBBGFk",
    "KFGbBBBBBBbGFk",
    "KFGBBbBBbBBGFk",
    "KFGGGGGGGGGFfk",
    "KFFFFFFFFFFFFk",
    "KFfffffffFFFfk",
    "KGGGGGGGGGGGGk",
    "KgggggggggggGk",
    "KKKKKKKKKKKKKK",
  ],
};

const RING_LIGHT = {
  colors: { K: "#111", W: "#fdf4ff", w: "#e879f9", p: "#f0abfc", P: "#d946ef", g: "#fdf4ff", D: "#1a0a00", S: "#4a0070" },
  data: [
    "......KKKKKKK.......",
    "....KKwwwwwwwKK.....",
    "...KwwwwwwwwwwwK....",
    "..KwwwKKKKKKKwwwK...",
    ".KwwwKK.....KKwwwK..",
    "KwwwKK.......KKwwwK.",
    "KwwKK.........KKwwK.",
    "KwwK...........KwwK.",
    "KwwK...........KwwK.",
    "KwwK...........KwwK.",
    "KwwK...........KwwK.",
    "KwwK...........KwwK.",
    "KwwKK.........KKwwK.",
    "KwwwKK.......KKwwwK.",
    ".KwwwKK.....KKwwwK..",
    "..KwwwKKKKKKKwwwK...",
    "...KwwwwwwwwwwwK....",
    "....KKwwwwwwwKK.....",
    "......KKKKKKK.......",
    ".........KK.........",
  ],
};

const CHART_ART = {
  colors: { K: "#111", B: "#1a0a14", P: "#831843", p: "#9d174d", C: "#f472b6", c: "#fda4af", W: "#fdf2f8", G: "#fce7f3", D: "#500724", l: "#ec4899" },
  data: [
    "KKKKKKKKKKKKKKKKKKKKKK",
    "KBBBBBBBBBBBBBBBBBBBBk",
    "KBBBBBBBBBBBBBBBBBBBBk",
    "KBBBBBBBBBBBBCBBBBBBk",
    "KBBBBBBBBBBBBCCCBBBBBk",
    "KBBBBBBBBBBBCCCCCBBBBk",
    "KBBBBBBBBBBCCCCCCCBBBk",
    "KBBBBBBBBpCCCCCCCCCBBk",
    "KBBBBBBBppCCCCCCCCCCBk",
    "KBBBBBpppppCCCCCCCCCCk",
    "KBBBpppppppppCCCCCCCCk",
    "KBpppppppppppppCCCCCCk",
    "KpppppppppppppppCCCCCk",
    "KPPPPPPPPPPPPPPPPPPPPk",
    "KBBBBBBBBBBBBBBBBBBBBk",
    "KKKKKKKKKKKKKKKKKKKKKK",
  ],
};

const TERMINAL_ART = {
  colors: { K: "#111", B: "#0d1117", S: "#161b22", G: "#4ade80", g: "#22c55e", d: "#166534", W: "#30363d", R: "#f87171", Y: "#facc15" },
  data: [
    "KKKKKKKKKKKKKKKKKKKK",
    "KWWWWWWWWWWWWWWWWWWk",
    "KWRRKYYKGGKWWWWWWWWk",
    "KWWWWWWWWWWWWWWWWWWk",
    "KBgGGGGGGGGGGgGGGBBk",
    "KBGgggggggggGGGGGGBk",
    "KBGGGGGgGGGGGGgGGGBk",
    "KBgGGGGGGGgGGGGGGGBk",
    "KBGGGgGGGGGGGGgGGGBk",
    "KBGGGGGGGgGGGGGGGGBk",
    "KBBdddddddddddddddBk",
    "KBBBBBGGBBBBBGKKKBBk",
    "KBBBBBBBBBBBBBBBBBBk",
    "KKKKKKKKKKKKKKKKKKKK",
  ],
};

const WHITEBOARD = {
  colors: { K: "#111", W: "#f8fafc", w: "#e2e8f0", F: "#1e293b", R: "#fca5a5", Y: "#fde68a", G: "#86efac", B: "#93c5fd", p: "#f0abfc" },
  data: [
    "KKKKKKKKKKKKKKKKKKKK",
    "KWWWWWWKWWWWWWKWWWWk",
    "KwRRRwKwYYYwKwGGGwk.",
    "KwRRRwKwYYYwKwGGGwk.",
    "KwRRRwKwYYYwKwGGGwk.",
    "KwwwwwKwwwwwKwwwwwk.",
    "KwBBBwKwBBBwKw...wk.",
    "KwBBBwKwBBBwKw...wk.",
    "KwBBBwKwBBBwKw...wk.",
    "KwwwwwKwwwwwKwwwwwk.",
    "KwpppwKw...wKw...wk.",
    "KwpppwKw...wKw...wk.",
    "KwpppwKw...wKw...wk.",
    "KwwwwwKwwwwwKwwwwwk.",
    "KWWWWWWKWWWWWWKWWWWk",
    "KKKKKKKKKKKKKKKKKKKK",
  ],
};

const PINBOARD = {
  colors: { K: "#111", B: "#b5875a", b: "#8B6914", W: "#fef3c7", w: "#ecfdf5", p: "#fce7f3", G: "#eff6ff", R: "#ef4444", Y: "#facc15", C: "#22d3ee", M: "#e879f9" },
  data: [
    "KKKKKKKKKKKKKKKKKKKKKK",
    "KbbbbbbbbbbbbbbbbbbbbK",
    "KbWWWWWWbGGGGGGGbwwwbK",
    "KbWWWWWWbGGGGGGGbwwwbK",
    "KbWWWWWWbGGGGGGGbwwwbK",
    "KbbbbbbbbbbbbbbbbbbbbbK",
    "KbpppppppppbGGGGGGGGbbK",
    "KbpppppppppbGGGGGGGGbbK",
    "KbpppppppppbGGGGGGGGbbK",
    "KbbbbbbbbbbbbbbbbbbbbbK",
    "KbCCCCCCCCCCCCCCCCCCbK",
    "KbCCCCCCCCCCCCCCCCCCbK",
    "KbCCCCCCCCCCCCCCCCCCbK",
    "KbbbbbbbbbbbbbbbbbbbbK",
    "KbbbbbbbbbbbbbbbbbbbbbK",
    "KKKKKKKKKKKKKKKKKKKKKK",
  ],
};

const PHOTOS = {
  colors: { K: "#111", W: "#fff", w: "#f0f0f0", R: "#fda4af", r: "#f9a8d4", B: "#93c5fd", b: "#bfdbfe", G: "#86efac", P: "#d8b4fe", Y: "#fde68a" },
  data: [
    "KKKKKKKK",
    "KWWWWWWk",
    "KWRRRRWk",
    "KWRrRRWk",
    "KWRRRRWk",
    "KWwwwwWk",
    "KKKKKKKK",
    "KKKKKKKk",
    "KWWWWWWk",
    "KWBBBBWk",
    "KWBbBBWk",
    "KWBBBBWk",
    "KWwwwwWk",
    "KKKKKKKK",
    "KKKKKKKk",
    "KWWWWWWk",
    "KWGGGGWk",
    "KWGgGGWk",
    "KWGGGGWk",
    "KWwwwwWk",
    "KKKKKKKK",
    "KKKKKKKk",
    "KWWWWWWk",
    "KWPPPPWk",
    "KWPpPPWk",
    "KWPPPPWk",
    "KWwwwwWk",
    "KKKKKKKK",
    "........",
    "........",
  ],
};

const COFFEE_MACHINE = {
  colors: { K: "#111", M: "#27272a", m: "#3f3f46", W: "#71717a", S: "#a1a1aa", B: "#d4a76a", b: "#fbbf24", R: "#ef4444", G: "#4ade80", C: "#f8fafc" },
  data: [
    ".KKKKKKKK.",
    ".KMMMMMMKk",
    ".KMSSSSMKk",
    ".KMSCCSMKk",
    ".KMSCCSMKk",
    ".KMMMMMKk.",
    ".KRKKGKK..",
    ".KMmmmMKk.",
    ".KMmBbmKk.",
    ".KMmBbmKk.",
    ".KMmBbmKk.",
    ".KMMMMMMKk",
    ".KKKKKKKk.",
    "..........",
  ],
};

const BOOK_PILE = {
  colors: { K: "#111", R: "#c0392b", r: "#e74c3c", B: "#1d6fa4", b: "#2980b9", G: "#1a7a3c", g: "#27ae60", Y: "#c07c00", y: "#e69c00", L: "#c49a60" },
  data: [
    ".KKKKKKKK.",
    ".KRrRrRRKk",
    ".KLLLLLLKk",
    "KKKKKKKKKK",
    "KBbBbBbBBk",
    "KLLLLLLLLk",
    "KKKKKKKKKK",
    "KGgGgGgGGk",
    "KLLLLLLLLk",
    "KKKKKKKKKK",
  ],
};

const STICKY_NOTES = {
  colors: { K: "#111", Y: "#fef9c3", y: "#fde68a", P: "#fce7f3", p: "#fbcfe8", G: "#dcfce7", g: "#bbf7d0", B: "#dbeafe", b: "#bfdbfe", T: "#78716c" },
  data: [
    "KKKKKKKKKKKKKKKK",
    "KYYYYKPPPPKYYYYk",
    "KYTTTKPpppKYTTTk",
    "KYTTTKPpppKYTTTk",
    "KYYYYKPPPPKYYYYk",
    "KKKKKKKKKKKKKKKK",
    "KGGGGKBBBBKPPPPk",
    "KGgggKBbbbKPpppk",
    "KGgggKBbbbKPpppk",
    "KGGGGKBBBBKPPPPk",
    "KKKKKKKKKKKKKKKK",
    "..KYYYYKGGGGK...",
    "..KYTTTKGgggK...",
    "..KYYYYKGGGGK...",
  ],
};

const BACKDROP = {
  colors: { K: "#111", A: "#fce7f3", a: "#fbcfe8", C: "#fdf4ff", c: "#f5d0fe", B: "#ffe4e6", b: "#fecdd3", D: "#fff7ed", d: "#fed7aa", P: "#831843" },
  data: [
    ".PPPPPPPPPPPPPP..",
    ".PAAAAAaaaCCCCcP.",
    ".PAAAAAaaaCCCCcP.",
    ".PAAAAAaaaCCCCcP.",
    ".PAAAAAaaaCCCCcP.",
    ".PAAAAAaaaCCCCcP.",
    ".PBBBBBbbbCCCCcP.",
    ".PBBBBBbbbCCCCcP.",
    ".PBBBBBbbbCCCCcP.",
    ".PBBBBBbbbCCCCcP.",
    ".PBBBBBbbbDDDDdP.",
    ".PBBBBBbbbDDDDdP.",
    ".PBBBBBbbbDDDDdP.",
    ".PBBBBBbbbDDDDdP.",
    ".PBBBBBbbbDDDDdP.",
    ".PaaaaaadddDDDdP.",
    ".PaaaaaadddDDDdP.",
    ".PaaaaaadddDDDdP.",
    ".PaaaaaadddDDDdP.",
    ".PPPPPPPPPPPPPP..",
  ],
};

const STOOL = {
  colors: { K: "#111", W: "#c49a60", w: "#8b6035", D: "#5c3a1e", S: "#a07040" },
  data: [
    "KKKKKKKK",
    "KWwWwWWk",
    "KWwWwWWk",
    "KKKKKKKK",
    "..KK.KK.",
    "..KK.KK.",
    "..KK.KK.",
    "..KKKK..",
  ],
};

// ── Room decoration components ─────────────────────────────────────────────

function LunaryRoom({ isHot, activeToday }: { isHot: boolean; activeToday: number }) {
  return <>
    {/* Wallpaper: starry pattern */}
    <div className="absolute" style={{ inset: 0, top: 0, height: "38%", backgroundImage: `radial-gradient(circle, rgba(196,181,253,0.35) 1px, transparent 1px)`, backgroundSize: "20px 20px", zIndex: 0 }} />

    {/* ── WALL ART ── */}
    {/* Center: moon painting */}
    <div className="absolute" style={{ left: "50%", top: 6, transform: "translateX(-50%)", zIndex: 4 }}>
      <Px {...MOON_PAINTING} scale={3} />
    </div>
    {/* Right: star chart */}
    <div className="absolute" style={{ right: "6%", top: 5, zIndex: 4 }}>
      <Px {...STAR_CHART} scale={3} />
    </div>

    {/* ── FLOOR ── all % positioning ── */}
    {/* Bookshelf (10%, 55%) */}
    <div className="absolute" style={{ left: "10%", top: "55%", zIndex: 5 }}>
      <Px {...BOOKSHELF} scale={3} />
    </div>
    {/* Cauldron (35%, 58%) — thinking waypoint */}
    <div className={`absolute ${isHot ? "crystal-hot" : ""}`} style={{ left: "35%", top: "58%", zIndex: 5 }}>
      <Px {...CAULDRON} scale={3} />
    </div>
    {/* Desk+Monitor (62%, 55%) */}
    <div className="absolute" style={{ left: "62%", top: "55%", zIndex: 4 }}>
      <Px {...DESK} scale={3} />
    </div>
    <div className={`absolute ${isHot ? "monitor-hot" : ""}`} style={{ left: "64%", top: "42%", zIndex: 6 }}>
      <Px {...MONITOR} scale={3} />
    </div>

    {/* ── ATMOSPHERE ── */}
    {/* Cauldron glow */}
    <div className={`absolute ${isHot ? "pulse-fast" : "pulse"}`} style={{ left: "30%", top: "55%", width: "20%", height: "20%", background: "radial-gradient(ellipse, rgba(124,58,237,0.25) 0%, transparent 70%)", zIndex: 2, pointerEvents: "none" }} />

    {/* Candle */}
    <div className={`absolute ${isHot ? "pulse-fast" : "pulse"}`} style={{ left: "52%", top: "62%", zIndex: 6 }}>
      <CandleSprite color="#c4b5fd" />
    </div>

    {/* Online indicator */}
    {activeToday > 0 && (
      <div className="absolute" style={{ left: "50%", top: 32, transform: "translateX(-50%)", zIndex: 10 }}>
        <div className="pulse-fast" style={{
          fontFamily: "'Press Start 2P'", fontSize: 6,
          color: "#4ade80", textShadow: "0 0 6px #4ade80",
          background: "rgba(0,0,0,0.7)", padding: "2px 6px",
          border: "1px solid rgba(74,222,128,0.4)",
          whiteSpace: "nowrap",
        }}>
          {activeToday} ONLINE
        </div>
      </div>
    )}
  </>;
}

function SpellcastRoom({ isHot }: { isHot: boolean }) {
  return <>
    {/* Wallpaper: grid/circuit pattern */}
    <div className="absolute" style={{ inset: 0, top: 0, height: "38%",
      backgroundImage: `linear-gradient(rgba(34,211,238,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.08) 1px, transparent 1px)`,
      backgroundSize: "16px 16px", zIndex: 0 }} />

    {/* ── WALL ART ── */}
    <div className="absolute" style={{ left: "4%", top: 4, zIndex: 4 }}>
      <Px {...WHITEBOARD} scale={3} />
    </div>
    <div className="absolute" style={{ left: "44%", top: 4, zIndex: 4 }}>
      <Px {...WINDOW} scale={3} />
    </div>
    <div className="absolute" style={{ right: "4%", top: 5, zIndex: 4 }}>
      <Px {...PINBOARD} scale={3} />
    </div>

    {/* ── FLOOR ── all % positioning ── */}
    {/* Server rack (8%, 55%) */}
    <div className={`absolute ${isHot ? "monitor-hot" : ""}`} style={{ left: "8%", top: "55%", zIndex: 5 }}>
      <Px {...SERVER} scale={3} />
    </div>
    {/* Server glow */}
    <div className={`absolute ${isHot ? "pulse-fast" : "pulse"}`} style={{ left: "5%", top: "58%", width: "16%", height: "18%", background: "radial-gradient(ellipse, rgba(74,222,128,0.2) 0%, transparent 70%)", zIndex: 2, pointerEvents: "none" }} />

    {/* Coffee machine (28%, 58%) */}
    <div className="absolute" style={{ left: "28%", top: "58%", zIndex: 5 }}>
      <Px {...COFFEE_MACHINE} scale={3} />
    </div>

    {/* Desk+Monitor (58%, 55%) */}
    <div className="absolute" style={{ left: "58%", top: "55%", zIndex: 4 }}>
      <Px {...DESK} scale={3} />
    </div>
    <div className={`absolute ${isHot ? "monitor-hot" : ""}`} style={{ left: "60%", top: "42%", zIndex: 6 }}>
      <Px {...MONITOR} scale={3} />
    </div>

    {/* Status LEDs */}
    <div className="absolute" style={{ right: "6%", top: "56%", display: "flex", flexDirection: "column", gap: 6, zIndex: 7 }}>
      {[["#4ade80", "ON"], ["#facc15", "Q"], ["#f472b6", "IG"]].map(([c, l]) => (
        <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div className={isHot ? "led-hot" : "pulse"} style={{ width: 8, height: 8, background: c, border: "1px solid rgba(0,0,0,0.5)", boxShadow: `0 0 8px ${c}` }} />
          <span style={{ fontFamily: "'Press Start 2P'", fontSize: 5, color: "rgba(255,255,255,0.5)" }}>{l}</span>
        </div>
      ))}
    </div>
  </>;
}

function DevRoom({ isHot }: { isHot: boolean }) {
  return <>
    {/* Wallpaper: matrix rain columns */}
    <div className="absolute" style={{ inset: 0, top: 0, height: "38%",
      backgroundImage: `repeating-linear-gradient(90deg, rgba(74,222,128,0.05) 0px, rgba(74,222,128,0.05) 2px, transparent 2px, transparent 18px)`,
      zIndex: 0 }} />

    {/* ── WALL ART ── */}
    <div className="absolute" style={{ left: "4%", top: 6, zIndex: 5 }}>
      <Px {...STICKY_NOTES} scale={3} />
    </div>
    <div className="absolute" style={{ left: "42%", top: 4, zIndex: 4 }}>
      <Px {...WINDOW} scale={3} />
    </div>
    <div className={`absolute ${isHot ? "terminal-hot" : ""}`} style={{ right: "4%", top: 5, zIndex: 4 }}>
      <Px {...TERMINAL_ART} scale={3} />
    </div>

    {/* ── FLOOR ── all % positioning ── */}
    {/* Desk+Laptop (15%, 55%) */}
    <div className="absolute" style={{ left: "15%", top: "55%", zIndex: 4 }}>
      <Px {...DESK} scale={3} />
    </div>
    <div className={`absolute ${isHot ? "laptop-hot" : ""}`} style={{ left: "17%", top: "42%", zIndex: 6 }}>
      <Px {...LAPTOP} scale={3} />
    </div>
    {/* Desk glow */}
    <div className={`absolute ${isHot ? "pulse-fast" : ""}`} style={{ left: "12%", top: "58%", width: "24%", height: "16%", background: "radial-gradient(ellipse, rgba(74,222,128,0.15) 0%, transparent 70%)", zIndex: 2, pointerEvents: "none" }} />

    {/* Book pile (45%, 60%) */}
    <div className="absolute" style={{ left: "45%", top: "60%", zIndex: 5 }}>
      <Px {...BOOK_PILE} scale={3} />
    </div>

    {/* Bookshelf (78%, 55%) */}
    <div className="absolute" style={{ left: "78%", top: "55%", zIndex: 5 }}>
      <Px {...BOOKSHELF} scale={3} />
    </div>

    {/* Plants */}
    <div className="absolute" style={{ left: "40%", top: "60%", zIndex: 5 }}>
      <PlantSprite accent="#16a34a" />
    </div>

    {/* Green candle */}
    <div className={`absolute ${isHot ? "pulse-fast" : "pulse"}`} style={{ left: "60%", top: "62%", zIndex: 6 }}>
      <CandleSprite color="#4ade80" />
    </div>
  </>;
}

function MetaRoom({ isHot }: { isHot: boolean }) {
  return <>
    {/* Wallpaper: soft chevron / diamonds */}
    <div className="absolute" style={{ inset: 0, top: 0, height: "38%",
      backgroundImage: `radial-gradient(ellipse at 50% 0%, rgba(244,114,182,0.15) 0%, transparent 60%), repeating-linear-gradient(45deg, rgba(244,114,182,0.04) 0px, rgba(244,114,182,0.04) 2px, transparent 2px, transparent 14px)`,
      zIndex: 0 }} />

    {/* ── WALL ART ── */}
    <div className="absolute" style={{ left: "4%", top: 4, zIndex: 4 }}>
      <Px {...PHOTOS} scale={3} />
    </div>
    <div className="absolute" style={{ left: "35%", top: 0, zIndex: 3 }}>
      <Px {...BACKDROP} scale={4} />
    </div>
    <div className="absolute" style={{ right: "4%", top: 5, zIndex: 4 }}>
      <Px {...CHART_ART} scale={3} />
    </div>

    {/* ── FLOOR ── all % positioning ── */}
    {/* Camera (10%, 55%) */}
    <div className="absolute" style={{ left: "10%", top: "55%", zIndex: 5 }}>
      <Px {...CAMERA} scale={3} />
    </div>

    {/* Ring light + Stool (38%, 55%) */}
    <div className={`absolute ${isHot ? "ring-hot" : "pulse"}`} style={{ left: "38%", top: "52%", zIndex: 5 }}>
      <Px {...RING_LIGHT} scale={3} />
    </div>
    <div className="absolute" style={{ left: "42%", top: "64%", zIndex: 6 }}>
      <Px {...STOOL} scale={3} />
    </div>
    {/* Spotlight cone */}
    <div className="absolute" style={{
      left: "34%", top: "50%", width: "22%", height: "40%",
      background: "radial-gradient(ellipse at 50% 0%, rgba(253,244,255,0.18) 0%, transparent 65%)",
      zIndex: 2, pointerEvents: "none",
    }} />

    {/* Desk (65%, 55%) */}
    <div className="absolute" style={{ left: "65%", top: "55%", zIndex: 4 }}>
      <Px {...DESK} scale={3} />
    </div>

    {/* Plant */}
    <div className="absolute" style={{ left: "85%", top: "60%", zIndex: 6 }}>
      <PlantSprite accent="#be185d" />
    </div>

    {/* Candle */}
    <div className={`absolute ${isHot ? "pulse-fast" : "pulse"}`} style={{ left: "24%", top: "62%", zIndex: 6, animationDelay: "0.4s" }}>
      <CandleSprite color="#f472b6" />
    </div>
  </>;
}

// ── Room config + render ───────────────────────────────────────────────────

interface RoomConfig {
  shellProps: Omit<RoomShellProps, "children">;
  title: string;
  subtitle: string;
  accent: string;
  sprite: "luna" | "caster" | "dev" | "meta";
  glowColor: string;
  name: string;
  roomKey: string;
  stats: { label: string; value: string }[];
  interactions?: Partial<Record<ActivityState, { x: number; y: number }>>;
}

function getRoomActivityState(
  roomKey: string,
  hotRooms: string[],
  activeRooms: string[],
  toolState: string
): ActivityState {
  const isHot = hotRooms.includes(roomKey);
  const isActive = activeRooms.includes(roomKey);
  if (isHot) {
    if (toolState === "typing" || toolState === "running" || toolState === "searching" || toolState === "thinking") {
      return toolState as ActivityState;
    }
    return "hot";
  }
  if (isActive) return "active";
  return "idle";
}

interface RoomProps {
  config: RoomConfig;
  activityState: ActivityState;
  isHot: boolean;
  decoration: React.ReactNode;
  hasBadge: boolean;
  hasAgentAlert: boolean;
  onTap: () => void;
}

function Room({ config, activityState, isHot, decoration, hasBadge, hasAgentAlert, onTap }: RoomProps) {
  const { shellProps, title, subtitle, accent, sprite, glowColor, name, stats, interactions } = config;
  return (
    <RoomShell {...shellProps}>
      {/* Tap target */}
      <div
        onClick={onTap}
        className="absolute inset-0 cursor-pointer"
        style={{ zIndex: 20 }}
      />
      {decoration}
      {/* Notification badge */}
      {hasBadge && <NotificationBadge />}
      <div className="absolute top-2 left-3" style={{ zIndex: 10 }}>
        <div className="room-title" style={{ color: accent }}>{title}</div>
        <div style={{ fontFamily: "'Press Start 2P'", fontSize: 5, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>{subtitle}</div>
        {isHot && (
          <div className="pulse-fast" style={{ fontFamily: "'Press Start 2P'", fontSize: 5, color: accent, textShadow: `0 0 6px ${accent}`, marginTop: 2 }}>
            ● ACTIVE
          </div>
        )}
      </div>
      <div className="absolute bottom-2 left-3" style={{ zIndex: 10, display: "flex", flexDirection: "column", gap: 2 }}>
        {stats.map((s) => (
          <div key={s.label} className="stat-chip" style={{ color: accent }}>
            <span style={{ color: "rgba(255,255,255,0.4)" }}>{s.label} </span>{s.value}
          </div>
        ))}
      </div>
      <AgentSprite
        sprite={sprite}
        name={name}
        glowColor={glowColor}
        activityState={activityState}
        accentColor={accent}
        interactions={interactions}
        alert={hasAgentAlert}
      />
    </RoomShell>
  );
}

// ── Badge logic ────────────────────────────────────────────────────────────

function getRoomBadge(roomKey: string, stats: DashboardStats | null, heartbeat: HeartbeatResponse | null): boolean {
  if (!stats) return false;
  switch (roomKey) {
    case "lunary":
      return stats.health.lunary.status === "down";
    case "spellcast":
      return stats.content.failedPosts > 0 || stats.health.spellcast.status === "down";
    case "dev":
      return heartbeat?.status === "offline" ||
        stats.health.lunary.status === "down" ||
        stats.health.spellcast.status === "down" ||
        stats.health.contentCreator.status === "down";
    case "meta":
      return stats.opportunities.length > 0 ||
        (stats.seo.trend !== null && stats.seo.trend.clicks.pct < -10);
    default:
      return false;
  }
}

// ── Floor plan ─────────────────────────────────────────────────────────────

interface FloorPlanProps {
  stats: DashboardStats | null;
  heartbeat: HeartbeatResponse | null;
}

export default function FloorPlan({ stats, heartbeat }: FloorPlanProps) {
  const activity = useActivityStream();
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const fmt = (v: number | undefined) => (v !== undefined ? String(v) : "...");

  const lunaryHot = activity.hotRooms.includes("lunary");
  const spellcastHot = activity.hotRooms.includes("spellcast");
  const devHot = activity.hotRooms.includes("dev");

  const roomConfigs: RoomConfig[] = [
    {
      shellProps: {
        wallColor: "#1e0a3c",
        wallPattern: "repeating-linear-gradient(90deg,rgba(196,181,253,0.06) 0px,rgba(196,181,253,0.06) 1px,transparent 1px,transparent 20px)",
        floorA: "#3d1f6b", floorB: "#2e1652", trim: "#5b21b6", trimTop: "#7c3aed",
      },
      title: "LUNARY", subtitle: "OBSERVATORY", accent: "#c084fc",
      sprite: "luna", glowColor: "#7c3aed", name: "LUNA",
      roomKey: "lunary",
      stats: [
        { label: "MAU", value: fmt(stats?.lunary.mau) },
        { label: "MRR", value: stats ? `\u00A3${stats.lunary.mrr.toFixed(2)}` : "..." },
        { label: "ONLINE", value: fmt(stats?.lunary.activeToday) },
      ],
      interactions: {
        typing:    { x: 55, y: 62 }, // chair next to desk
        searching: { x: 10, y: 55 }, // bookshelf
        thinking:  { x: 35, y: 56 }, // cauldron
      },
    },
    {
      shellProps: {
        wallColor: "#061a26",
        wallPattern: "linear-gradient(rgba(34,211,238,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(34,211,238,0.04) 1px,transparent 1px)",
        floorA: "#142e22", floorB: "#0f2418", trim: "#0e7490", trimTop: "#22d3ee",
      },
      title: "SPELLCAST", subtitle: "COMMAND", accent: "#22d3ee",
      sprite: "caster", glowColor: "#0e7490", name: "CASTER",
      roomKey: "spellcast",
      stats: [
        { label: "TODAY", value: stats ? `${stats.spellcast.postsToday} posts` : "..." },
        { label: "QUEUED", value: fmt(stats?.spellcast.scheduled) },
        { label: "ACCTS", value: fmt(stats?.spellcast.accounts) },
      ],
      interactions: {
        typing:   { x: 51, y: 62 }, // chair next to desk
        running:  { x: 8,  y: 55 }, // server rack
        thinking: { x: 18, y: 52 }, // whiteboard
      },
    },
    {
      shellProps: {
        wallColor: "#0a160a",
        wallPattern: "repeating-linear-gradient(180deg,rgba(74,222,128,0.04) 0px,rgba(74,222,128,0.04) 1px,transparent 1px,transparent 18px)",
        floorA: "#1a2e10", floorB: "#14240c", trim: "#166534", trimTop: "#4ade80",
      },
      title: "DEV", subtitle: "DEN", accent: "#4ade80",
      sprite: "dev", glowColor: "#166534", name: "DEV",
      roomKey: "dev",
      stats: [
        { label: "COMMITS", value: stats ? `${stats.github.commitsToday} today` : "..." },
        { label: "REPOS", value: fmt(stats?.github.repos) },
        { label: "FOLLOWERS", value: fmt(stats?.github.followers) },
      ],
      interactions: {
        typing:    { x: 22, y: 62 }, // chair next to desk
        searching: { x: 78, y: 55 }, // bookshelf right
        thinking:  { x: 45, y: 60 }, // centre floor
      },
    },
    {
      shellProps: {
        wallColor: "#1e0814",
        wallPattern: "radial-gradient(ellipse at 50% 0%,rgba(244,114,182,0.12) 0%,transparent 65%)",
        floorA: "#34101c", floorB: "#2a0c16", trim: "#9d174d", trimTop: "#f472b6",
      },
      title: "META", subtitle: "ANALYTICS", accent: "#f472b6",
      sprite: "meta", glowColor: "#9d174d", name: "META",
      roomKey: "meta",
      stats: [
        { label: "IG FLWRS", value: stats ? stats.meta.followers.toLocaleString() : "..." },
        { label: "REACH/WK", value: stats ? `${(stats.meta.reachThisWeek / 1000).toFixed(1)}k` : "..." },
        { label: "POSTS/WK", value: fmt(stats?.meta.postsThisWeek) },
      ],
      interactions: {
        typing:  { x: 58, y: 62 }, // desk chair
        thinking: { x: 38, y: 60 }, // stool
      },
    },
  ];

  const decorations = [
    <LunaryRoom key="lunary" isHot={lunaryHot} activeToday={stats?.lunary.activeToday ?? 0} />,
    <SpellcastRoom key="spellcast" isHot={spellcastHot} />,
    <DevRoom key="dev" isHot={devHot} />,
    <MetaRoom key="meta" isHot={false} />,
  ];

  return (
    <>
      <div className="w-full h-full" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr" }}>
        {roomConfigs.map((config, i) => {
          const activityState = getRoomActivityState(
            config.roomKey,
            activity.hotRooms,
            activity.activeRooms,
            activity.toolState
          );
          const isHot = activity.hotRooms.includes(config.roomKey);
          const hasBadge = getRoomBadge(config.roomKey, stats, heartbeat);
          return (
            <Room
              key={config.title}
              config={config}
              activityState={activityState}
              isHot={isHot}
              decoration={decorations[i]}
              hasBadge={hasBadge}
              hasAgentAlert={hasBadge}
              onTap={() => stats && setSelectedRoom(config.roomKey)}
            />
          );
        })}
        {/* Crosshair */}
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 35, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 16, height: 2, background: "rgba(255,255,255,0.12)" }} />
          <div style={{ position: "absolute", width: 2, height: 16, background: "rgba(255,255,255,0.12)" }} />
        </div>
        <Clock />
      </div>
      {/* Room detail overlay */}
      {selectedRoom && stats && (
        <RoomDetail
          roomId={selectedRoom as "lunary" | "spellcast" | "dev" | "meta"}
          stats={stats}
          heartbeat={heartbeat}
          onClose={() => setSelectedRoom(null)}
        />
      )}
    </>
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
    <div className="fixed bottom-2 right-3" style={{ zIndex: 35, fontFamily: "'Press Start 2P'", fontSize: 7, color: "rgba(255,255,255,0.2)", letterSpacing: "0.05em" }}>
      {time}
    </div>
  );
}
