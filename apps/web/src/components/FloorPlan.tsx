"use client";

import { useState, useEffect } from "react";
import AgentSprite, { ActivityState } from "./AgentSprite";
import { useLiveStats, LiveEvent } from "@/hooks/useLiveStats";
import { useActivityStream } from "@/hooks/useActivityStream";

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

// Telescope — 10w × 18h
const TELESCOPE = {
  colors: { K: "#111", M: "#a78bfa", m: "#7c3aed", D: "#6d28d9", B: "#c4b5fd", s: "#8b5cf6", L: "#5b21b6" },
  data: [
    ".....K....",
    "....KBK...",
    "....KMK...",
    "...KMmMK..",
    "..KMMMmMK.",
    ".KmMMMMMmK",
    "KmMMMMMMMk",
    "KMMMMMMMMk",
    ".KMMMMMKk.",
    "..KMMMKk..",
    "...KMsK...",
    "...KMsK...",
    "...KMsK...",
    "..KLLLLK..",
    "..KLLLLK..",
    ".KLLLLLLK.",
    ".KKKKKKKK.",
    "..........",
  ],
};

// Crystal ball — 12w × 12h
const CRYSTAL_BALL = {
  colors: { K: "#111", W: "#ede9fe", w: "#ddd6fe", M: "#a78bfa", m: "#7c3aed", D: "#6d28d9", g: "#c4b5fd", S: "#f5f3ff", P: "#4c1d95" },
  data: [
    "....KKKKKK....",
    "..KWWWSSWWWk..",
    ".KWSSSSSSSwwk.",
    "KWSSgMMgSSwwwk",
    "KWSgMMMMgSwwwk",
    "KWSmMMMmSSMwwk",
    "KWWmDmmDMwwwwk",
    "KWwwMmMwwwwwwk",
    ".Kwwwwwwwwwwk.",
    "..KKwwwwwwKk..",
    "....KKKKKK....",
    ".KPPPPPPPPPk..",
  ],
};

// Window (wall-mounted) — 14w × 18h
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

// Ring light — 20w × 20h
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
function CandleSprite({ color = "#fde68a", hot = false }: { color?: string; hot?: boolean }) {
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

// Framed moon painting — 20w × 18h
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

// Analytics chart wall art — 22w × 16h
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

// Terminal wall art — 20w × 14h
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

// Star chart — 16w × 14h
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

// Pinboard — 22w × 16h
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

// Photo wall strip — 8w × 30h (polaroid stack)
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

// Coffee mug — 8w × 8h
const COFFEE = {
  colors: { K: "#111", W: "#d4a76a", w: "#b8895a", D: "#3d1f0a", B: "#1a0a00", S: "#6b3a1a", G: "#4ade80" },
  data: [
    ".KKKKKK.",
    "KWWWWWWk",
    "KWDDDDWKk",
    "KWDDDDWKk",
    "KWWWWWWk",
    "KWWWWWWk",
    ".KKKKKK.",
    "..KKKK..",
  ],
};

// Cauldron — 12w × 10h (bubbling purple cauldron)
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

// Moon phase strip — 28w × 8h (wall art, 5 phases)
const MOON_PHASE = {
  colors: { K: "#111", F: "#5b21b6", B: "#0f0820", W: "#fde68a", w: "#fbbf24", D: "#1e1035" },
  data: [
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKK",
    "KFFFFFFFFFFFFFFFFFFFFFFFFFFk",
    "KFDDDDFwDDFWwwWFwwwWFwwwwWFk",
    "KFDDDDFwDDFWwwWFwwwWFwwwwWFk",
    "KFDDDDFwDDFWwwWFwwwWFwwwwWFk",
    "KFDDDDFwDDFWwwWFwwwWFwwwwWFk",
    "KFFFFFFFFFFFFFFFFFFFFFFFFFFk",
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKK",
  ],
};

// Potion rack — 10w × 12h (3 bottles on a shelf)
const POTION_RACK = {
  colors: { K: "#111", L: "#8b6035", W: "#c49a60", P: "#7c3aed", p: "#a78bfa", G: "#059669", g: "#34d399", B: "#0e7490", b: "#22d3ee", C: "#fde68a" },
  data: [
    ".KKKKKKKK.",
    ".KWWWWWWKk",
    ".K.C.C.Ck.",
    ".K.P.G.Bk.",
    ".K.P.G.Bk.",
    ".K.p.g.bk.",
    ".K.p.g.bk.",
    ".K.P.G.Bk.",
    ".KKKKKKKK.",
    ".LLLLLLLL.",
    "..........",
    "..........",
  ],
};

// Whiteboard — 20w × 16h (kanban columns)
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

// Coffee machine — 10w × 14h
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

// Rubber duck — 4w × 4h
const RUBBER_DUCK = {
  colors: { K: "#111", Y: "#fbbf24", y: "#fde68a", B: "#1d4ed8", E: "#1a0a00" },
  data: [
    ".yY.",
    "YyYY",
    "YYYY",
    ".KK.",
  ],
};

// Book pile — 10w × 10h
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

// Sticky notes cluster — 16w × 14h (wall)
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

// Colour-blocked photo backdrop — 16w × 20h
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

// Simple stool — 8w × 8h
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

function LunaryRoom({ isHot, activeToday, events }: { isHot: boolean; activeToday: number; events: LiveEvent[] }) {
  return <>
    {/* Wallpaper: starry pattern */}
    <div className="absolute" style={{ inset: 0, top: 0, height: "38%", backgroundImage: `radial-gradient(circle, rgba(196,181,253,0.35) 1px, transparent 1px)`, backgroundSize: "20px 20px", zIndex: 0 }} />

    {/* ── WALL ART ── */}
    {/* Left wall: moon phase strip — full-width strip */}
    <div className="absolute" style={{ left: 4, top: 8, zIndex: 4 }}>
      <Px {...MOON_PHASE} scale={5} />
    </div>
    {/* Center wall: star chart */}
    <div className="absolute" style={{ left: "50%", top: 6, transform: "translateX(-50%)", zIndex: 4 }}>
      <Px {...STAR_CHART} scale={4} />
    </div>
    {/* Right wall: moon painting */}
    <div className="absolute" style={{ right: 6, top: 5, zIndex: 4 }}>
      <Px {...MOON_PAINTING} scale={4} />
    </div>

    {/* ── FLOOR — bottom row ── */}
    {/* Large rug first so items sit on it */}
    <div className="absolute" style={{ left: 30, bottom: 48, right: 8, height: 40, background: "rgba(91,33,182,0.5)", border: "2px solid rgba(124,58,237,0.5)", zIndex: 3 }} />
    {/* Bookshelf far left — anchors left wall to floor */}
    <div className="absolute" style={{ left: 6, bottom: 48, zIndex: 5 }}>
      <Px {...BOOKSHELF} scale={4} />
    </div>
    {/* Plant next to shelf */}
    <div className="absolute" style={{ left: 88, bottom: 48, zIndex: 5 }}>
      <PlantSprite accent="#7c3aed" />
    </div>
    {/* Cauldron center-left — thinking waypoint */}
    <div className={`absolute ${isHot ? "crystal-hot" : ""}`} style={{ left: "34%", bottom: 48, zIndex: 5 }}>
      <Px {...CAULDRON} scale={5} />
    </div>
    {/* Desk right */}
    <div className="absolute" style={{ right: 10, bottom: 48, zIndex: 4 }}>
      <Px {...DESK} scale={3} />
    </div>
    {/* Telescope on desk */}
    <div className={`absolute ${isHot ? "telescope-hot" : ""}`} style={{ right: 38, bottom: 48 + 24, zIndex: 6 }}>
      <Px {...TELESCOPE} scale={3} />
    </div>
    {/* Crystal ball center-right */}
    <div className={`absolute ${isHot ? "crystal-hot" : ""}`} style={{ right: 120, bottom: 48 + 24, zIndex: 6 }}>
      <Px {...CRYSTAL_BALL} scale={3} />
    </div>

    {/* ── FLOOR — mid-level items ── */}
    {/* Potion rack with built-in legs — sits on floor, appears mid-room */}
    <div className="absolute" style={{ left: "54%", bottom: 48, zIndex: 4 }}>
      <Px {...POTION_RACK} scale={3} />
    </div>
    {/* Second rug center */}
    <div className="absolute" style={{ left: "24%", bottom: 52, width: 110, height: 28, background: "rgba(109,40,217,0.35)", border: "1px solid rgba(167,139,250,0.3)", zIndex: 3 }} />

    {/* ── CSS ATMOSPHERE ── */}
    {/* Arcane floor circle around cauldron */}
    <div className="absolute" style={{ left: "26%", bottom: 44, width: 130, height: 52, border: "1px solid rgba(167,139,250,0.35)", borderRadius: "50%", zIndex: 2, pointerEvents: "none" }} />
    <div className="absolute" style={{ left: "29%", bottom: 48, width: 96, height: 38, border: "1px dashed rgba(196,181,253,0.2)", borderRadius: "50%", zIndex: 2, pointerEvents: "none" }} />
    {/* Cauldron glow on floor */}
    <div className={`absolute ${isHot ? "pulse-fast" : "pulse"}`} style={{ left: "30%", bottom: 44, width: 120, height: 48, background: "radial-gradient(ellipse, rgba(124,58,237,0.25) 0%, transparent 70%)", zIndex: 2, pointerEvents: "none" }} />

    {/* ── CANDLES ── */}
    <div className={`absolute ${isHot ? "pulse-fast" : "pulse"}`} style={{ left: 100, bottom: 48, zIndex: 6, transform: activeToday > 0 ? "scale(1.2)" : "scale(1)", transition: "transform 0.5s" }}>
      <CandleSprite color="#fde68a" />
    </div>
    <div className={`absolute ${isHot ? "pulse-fast" : "pulse"}`} style={{ left: "46%", bottom: 48, zIndex: 6, animationDelay: "0.4s" }}>
      <CandleSprite color="#c4b5fd" />
    </div>
    <div className={`absolute ${isHot ? "pulse-fast" : "pulse"}`} style={{ right: 130, bottom: 48, zIndex: 6, animationDelay: "0.7s" }}>
      <CandleSprite color="#f0abfc" />
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

    {/* Live event bubbles */}
    {events.map((ev) => (
      <div key={ev.id} className="event-bubble absolute" style={{ left: "50%", bottom: "55%", transform: "translateX(-50%)", zIndex: 15 }}>
        <div style={{
          fontFamily: "'Press Start 2P'", fontSize: 7,
          background: ev.type === "new-sub" ? "rgba(250,204,21,0.9)" : ev.type === "new-user" ? "rgba(167,139,250,0.9)" : "rgba(34,211,238,0.9)",
          color: "#000", padding: "3px 8px",
          border: "2px solid rgba(255,255,255,0.5)",
          whiteSpace: "nowrap",
        }}>
          {ev.type === "new-user" && "NEW USER!"}
          {ev.type === "new-sub" && "NEW SUB!"}
          {ev.type === "online" && `${ev.label} ONLINE`}
          {ev.type === "offline" && "OFFLINE"}
        </div>
      </div>
    ))}
  </>;
}

function SpellcastRoom({ isHot }: { isHot: boolean }) {
  return <>
    {/* Wallpaper: grid/circuit pattern */}
    <div className="absolute" style={{ inset: 0, top: 0, height: "38%",
      backgroundImage: `linear-gradient(rgba(34,211,238,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.08) 1px, transparent 1px)`,
      backgroundSize: "16px 16px", zIndex: 0 }} />

    {/* ── WALL ART ── */}
    {/* Left wall: kanban whiteboard */}
    <div className="absolute" style={{ left: 4, top: 4, zIndex: 4 }}>
      <Px {...WHITEBOARD} scale={5} />
    </div>
    {/* Center wall: window */}
    <div className="absolute" style={{ left: "44%", top: 4, zIndex: 4 }}>
      <Px {...WINDOW} scale={4} />
    </div>
    {/* Right wall: pinboard */}
    <div className="absolute" style={{ right: 6, top: 5, zIndex: 4 }}>
      <Px {...PINBOARD} scale={4} />
    </div>

    {/* ── FLOOR — bottom row ── */}
    {/* Teal rug under desk area */}
    <div className="absolute" style={{ left: "36%", bottom: 48, right: 8, height: 40, background: "rgba(14,79,95,0.55)", border: "2px solid rgba(34,211,238,0.3)", zIndex: 3 }} />

    {/* Server rack 1 — far left */}
    <div className={`absolute ${isHot ? "monitor-hot" : ""}`} style={{ left: 8, bottom: 48, zIndex: 5 }}>
      <Px {...SERVER} scale={3} />
    </div>
    {/* Server rack 2 — staggered, slightly behind */}
    <div className={`absolute ${isHot ? "monitor-hot" : ""}`} style={{ left: 42, bottom: 80, zIndex: 4 }}>
      <Px {...SERVER} scale={3} />
    </div>
    {/* Server glow */}
    <div className={`absolute ${isHot ? "pulse-fast" : "pulse"}`} style={{ left: 6, bottom: 44, width: 80, height: 40, background: "radial-gradient(ellipse, rgba(74,222,128,0.2) 0%, transparent 70%)", zIndex: 2, pointerEvents: "none" }} />

    {/* Coffee machine center-left */}
    <div className="absolute" style={{ left: "24%", bottom: 48, zIndex: 5 }}>
      <Px {...COFFEE_MACHINE} scale={3} />
    </div>

    {/* Long desk right half */}
    <div className="absolute" style={{ left: "40%", right: 8, bottom: 48, zIndex: 4 }}>
      <Px {...DESK} scale={3} />
    </div>
    {/* Monitor 1 */}
    <div className={`absolute ${isHot ? "monitor-hot" : ""}`} style={{ left: "44%", bottom: 48 + 24, zIndex: 6 }}>
      <Px {...MONITOR} scale={3} />
    </div>
    {/* Monitor 2 */}
    <div className={`absolute ${isHot ? "monitor-hot" : ""}`} style={{ right: 36, bottom: 48 + 24, zIndex: 6 }}>
      <Px {...MONITOR} scale={3} />
    </div>

    {/* Status LEDs */}
    <div className="absolute" style={{ right: 12, bottom: 96, display: "flex", flexDirection: "column", gap: 6, zIndex: 7 }}>
      {[["#4ade80", "ON"], ["#facc15", "Q"], ["#f472b6", "IG"]].map(([c, l]) => (
        <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div className={isHot ? "led-hot" : "pulse"} style={{ width: 8, height: 8, background: c, border: "1px solid rgba(0,0,0,0.5)", boxShadow: `0 0 8px ${c}` }} />
          <span style={{ fontFamily: "'Press Start 2P'", fontSize: 5, color: "rgba(255,255,255,0.5)" }}>{l}</span>
        </div>
      ))}
    </div>

    {/* Plant far right */}
    <div className="absolute" style={{ right: 10, bottom: 48, zIndex: 6 }}>
      <PlantSprite accent="#0891b2" />
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
    {/* Left wall: sticky notes cluster */}
    <div className="absolute" style={{ left: 4, top: 6, zIndex: 5 }}>
      <Px {...STICKY_NOTES} scale={4} />
    </div>
    {/* Center wall: window */}
    <div className="absolute" style={{ left: "42%", top: 4, zIndex: 4 }}>
      <Px {...WINDOW} scale={4} />
    </div>
    {/* Right wall: terminal art */}
    <div className={`absolute ${isHot ? "terminal-hot" : ""}`} style={{ right: 6, top: 5, zIndex: 4 }}>
      <Px {...TERMINAL_ART} scale={4} />
    </div>

    {/* ── FLOOR — bottom row ── */}
    {/* Green rug under center-right */}
    <div className="absolute" style={{ left: 80, bottom: 48, right: 42, height: 40, background: "rgba(21,83,61,0.5)", border: "2px solid rgba(74,222,128,0.25)", zIndex: 3 }} />

    {/* Desk left — typing waypoint */}
    <div className="absolute" style={{ left: 6, bottom: 48, zIndex: 4 }}>
      <Px {...DESK} scale={3} />
    </div>
    {/* Laptop on desk */}
    <div className={`absolute ${isHot ? "laptop-hot" : ""}`} style={{ left: 18, bottom: 48 + 24, zIndex: 6 }}>
      <Px {...LAPTOP} scale={3} />
    </div>
    {/* Rubber duck on desk */}
    <div className="absolute" style={{ left: 68, bottom: 48 + 24, zIndex: 6 }}>
      <Px {...RUBBER_DUCK} scale={4} />
    </div>
    {/* Coffee mug on desk */}
    <div className="absolute" style={{ left: 82, bottom: 48 + 20, zIndex: 6 }}>
      <Px {...COFFEE} scale={3} />
    </div>
    {/* Desk glow */}
    <div className={`absolute ${isHot ? "pulse-fast" : ""}`} style={{ left: 4, bottom: 44, width: 120, height: 36, background: "radial-gradient(ellipse, rgba(74,222,128,0.15) 0%, transparent 70%)", zIndex: 2, pointerEvents: "none" }} />

    {/* Book pile center floor — thinking waypoint area */}
    <div className="absolute" style={{ left: "38%", bottom: 48, zIndex: 5 }}>
      <Px {...BOOK_PILE} scale={3} />
    </div>

    {/* Bookshelf right wall — searching waypoint */}
    <div className="absolute" style={{ right: 6, bottom: 48, zIndex: 5 }}>
      <Px {...BOOKSHELF} scale={4} />
    </div>

    {/* Plant left of books */}
    <div className="absolute" style={{ left: "30%", bottom: 48, zIndex: 5 }}>
      <PlantSprite accent="#16a34a" />
    </div>
    {/* Plant right of books */}
    <div className="absolute" style={{ left: "56%", bottom: 48, zIndex: 5 }}>
      <PlantSprite accent="#15803d" />
    </div>

    {/* Green candle */}
    <div className={`absolute ${isHot ? "pulse-fast" : "pulse"}`} style={{ right: 82, bottom: 48, zIndex: 6 }}>
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
    {/* Left wall: photo strip */}
    <div className="absolute" style={{ left: 8, top: 4, zIndex: 4 }}>
      <Px {...PHOTOS} scale={4} />
    </div>
    {/* Center wall: colour-blocked backdrop — tall panel spanning wall into floor */}
    <div className="absolute" style={{ left: "35%", top: 0, zIndex: 3 }}>
      <Px {...BACKDROP} scale={6} />
    </div>
    {/* Right wall: analytics chart */}
    <div className="absolute" style={{ right: 6, top: 5, zIndex: 4 }}>
      <Px {...CHART_ART} scale={4} />
    </div>

    {/* ── FLOOR ── */}
    {/* Pink rug */}
    <div className="absolute" style={{ left: 8, bottom: 48, right: 8, height: 40, background: "rgba(131,24,67,0.45)", border: "2px solid rgba(244,114,182,0.35)", zIndex: 3 }} />

    {/* Camera — far left */}
    <div className="absolute" style={{ left: 10, bottom: 48, zIndex: 5 }}>
      <Px {...CAMERA} scale={3} />
    </div>

    {/* Ring light — center stage */}
    <div className={`absolute ${isHot ? "ring-hot" : "pulse"}`} style={{ left: "38%", bottom: 48, zIndex: 5 }}>
      <Px {...RING_LIGHT} scale={3} />
    </div>
    {/* Spotlight cone in front of ring light */}
    <div className="absolute" style={{
      left: "34%", bottom: 48, width: 160, height: 220,
      background: "radial-gradient(ellipse at 50% 0%, rgba(253,244,255,0.18) 0%, transparent 65%)",
      zIndex: 2, pointerEvents: "none",
    }} />

    {/* Stool in front of ring light */}
    <div className="absolute" style={{ left: "43%", bottom: 48, zIndex: 6 }}>
      <Px {...STOOL} scale={3} />
    </div>

    {/* Bookshelf right wall */}
    <div className="absolute" style={{ right: 6, bottom: 48, zIndex: 5 }}>
      <Px {...BOOKSHELF} scale={4} />
    </div>

    {/* Desk in front of bookshelf */}
    <div className="absolute" style={{ right: 80, bottom: 48, zIndex: 4 }}>
      <Px {...DESK} scale={3} />
    </div>

    {/* Plant */}
    <div className="absolute" style={{ right: 86, bottom: 48, zIndex: 6 }}>
      <PlantSprite accent="#be185d" />
    </div>

    {/* Candle */}
    <div className={`absolute ${isHot ? "pulse-fast" : "pulse"}`} style={{ left: 50, bottom: 48, zIndex: 6, animationDelay: "0.4s" }}>
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
  roomKey?: string;
  stats: { label: string; value: string }[];
  interactions?: Partial<Record<ActivityState, { x: number; y: number }>>;
}

function getRoomActivityState(
  roomKey: string | undefined,
  hotRooms: string[],
  activeRooms: string[],
  toolState: string
): ActivityState {
  if (!roomKey) return "idle";
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
}

function Room({ config, activityState, isHot, decoration }: RoomProps) {
  const { shellProps, title, subtitle, accent, sprite, glowColor, name, stats, interactions } = config;
  return (
    <RoomShell {...shellProps}>
      {decoration}
      <div className="absolute top-2 left-3" style={{ zIndex: 10 }}>
        <div className="room-title" style={{ color: accent }}>{title}</div>
        <div style={{ fontFamily: "'Press Start 2P'", fontSize: 5, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>{subtitle}</div>
        {/* Hot indicator */}
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
      />
    </RoomShell>
  );
}

// ── Floor plan ─────────────────────────────────────────────────────────────

export default function FloorPlan() {
  const { stats, events } = useLiveStats();
  const activity = useActivityStream();
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
        { label: "MRR", value: stats ? `£${stats.lunary.mrr.toFixed(2)}` : "..." },
        { label: "ONLINE", value: fmt(stats?.lunary.activeToday) },
      ],
      interactions: {
        typing:    { x: 68, y: 82 }, // desk right
        searching: { x: 6,  y: 82 }, // bookshelf left
        thinking:  { x: 30, y: 78 }, // cauldron center
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
        typing:   { x: 58, y: 82 }, // monitors right
        running:  { x: 8,  y: 82 }, // server rack left
        thinking: { x: 18, y: 52 }, // whiteboard left wall
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
        typing:    { x: 15, y: 82 }, // laptop/desk left
        searching: { x: 82, y: 82 }, // bookshelf right
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
      stats: [
        { label: "IG FLWRS", value: stats ? stats.meta.followers.toLocaleString() : "..." },
        { label: "REACH/WK", value: stats ? `${(stats.meta.reachThisWeek / 1000).toFixed(1)}k` : "..." },
        { label: "POSTS/WK", value: fmt(stats?.meta.postsThisWeek) },
      ],
    },
  ];

  const decorations = [
    <LunaryRoom
      key="lunary"
      isHot={lunaryHot}
      activeToday={stats?.lunary.activeToday ?? 0}
      events={events}
    />,
    <SpellcastRoom key="spellcast" isHot={spellcastHot} />,
    <DevRoom key="dev" isHot={devHot} />,
    <MetaRoom key="meta" isHot={false} />,
  ];

  return (
    <div className="w-screen h-screen" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr" }}>
      {roomConfigs.map((config, i) => {
        const activityState = getRoomActivityState(
          config.roomKey,
          activity.hotRooms,
          activity.activeRooms,
          activity.toolState
        );
        const isHot = config.roomKey ? activity.hotRooms.includes(config.roomKey) : false;
        return (
          <Room
            key={config.title}
            config={config}
            activityState={activityState}
            isHot={isHot}
            decoration={decorations[i]}
          />
        );
      })}
      {/* Crosshair */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 16, height: 2, background: "rgba(255,255,255,0.12)" }} />
        <div style={{ position: "absolute", width: 2, height: 16, background: "rgba(255,255,255,0.12)" }} />
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
    <div className="fixed bottom-2 right-3" style={{ zIndex: 50, fontFamily: "'Press Start 2P'", fontSize: 7, color: "rgba(255,255,255,0.2)", letterSpacing: "0.05em" }}>
      {time}
    </div>
  );
}
