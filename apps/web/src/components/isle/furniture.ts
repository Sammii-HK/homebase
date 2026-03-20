// Isle canvas engine — furniture & tile drawing

import type { Dir, Season, TOD, DeskZone, FurniturePiece, IsleStats } from "./types";
import {
  TS,
  WORLD_COLS,
  WORLD_ROWS,
  OFFICE_COLS,
  POND_TX,
  POND_TY,
  POND_TW,
  POND_TH,
  fv,
  seededRng,
  FLOWER_COLS,
} from "./world";

// ---------------------------------------------------------------------------
// Draw helpers
// ---------------------------------------------------------------------------

export function createDrawHelpers(
  ctx: CanvasRenderingContext2D,
  zoom: number,
  panX: number,
  panY: number,
) {
  function wr(x: number, y: number, w: number, h: number, col: string) {
    ctx.fillStyle = col;
    ctx.fillRect(
      Math.round(panX + x * zoom),
      Math.round(panY + y * zoom),
      Math.max(1, Math.round(w * zoom)),
      Math.max(1, Math.round(h * zoom)),
    );
  }

  function we(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    col: string,
    a = 1,
  ) {
    ctx.globalAlpha = a;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(
      panX + cx * zoom,
      panY + cy * zoom,
      rx * zoom,
      ry * zoom,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function lighten(hex: string, amt: number): string {
    const n = parseInt(hex.replace("#", ""), 16);
    const cl = (v: number) => Math.max(0, Math.min(255, v));
    return `rgb(${cl((n >> 16) + amt)},${cl(((n >> 8) & 255) + amt)},${cl((n & 255) + amt)})`;
  }

  return { wr, we, lighten };
}

export type DrawHelpers = ReturnType<typeof createDrawHelpers>;

// ---------------------------------------------------------------------------
// Office tiles
// ---------------------------------------------------------------------------

export function drawOfficeFloor(helpers: DrawHelpers, tx: number, ty: number): void {
  const { wr, lighten } = helpers;
  const x = tx * TS,
    y = ty * TS,
    v = fv(tx, ty);

  // Base warm amber plank colour — varies per tile for natural look
  const base = v < 0.2 ? "#c4a272" : v < 0.45 ? "#c8a878" : v < 0.7 ? "#ccae7e" : v < 0.88 ? "#d0b484" : "#c6a87a";
  wr(x, y, TS, TS, base);

  // Plank gaps every 4px — darker recessed lines
  for (let py = 0; py < TS; py += 4) {
    wr(x, y + py, TS, 0.7, "#8a6838");
    // Subtle lighter line just below the gap for depth illusion
    wr(x, y + py + 0.7, TS, 0.4, lighten(base, 8));
  }

  // Staggered vertical plank seams — offset by tile position
  const seam1 = ((tx * 7 + ty * 3) % 8) + 3;
  const seam2 = ((tx * 5 + ty * 11) % 7) + 10;
  for (let py = 0; py < TS; py += 4) {
    const seamX = py % 8 < 4 ? seam1 : seam2;
    if (seamX < TS - 1) {
      wr(x + seamX, y + py, 0.6, 4, "#8a6838");
    }
  }

  // Subtle wood grain — thin horizontal streaks that vary with fv
  const grainSeed = (v * 100) | 0;
  if (grainSeed % 3 === 0) {
    wr(x + 1, y + 1 + (grainSeed % 12), TS - 2, 0.3, lighten(base, -6));
    wr(x + 2, y + 3 + (grainSeed % 10), TS - 4, 0.3, lighten(base, -4));
  }
  if (grainSeed % 4 === 0) {
    wr(x + 1, y + 6 + (grainSeed % 6), TS - 3, 0.3, lighten(base, -8));
  }

  // Occasional wood knot — small dark oval spot
  if (v > 0.88) {
    const kx = x + 3 + ((v * 6) % 7);
    const ky = y + 2 + ((v * 9) % 10);
    wr(kx, ky, 2.5, 1.5, "#705028");
    wr(kx + 0.5, ky + 0.3, 1.5, 0.8, "#604018");
    // Tiny ring around knot
    wr(kx - 0.3, ky - 0.3, 3, 0.3, "#806838");
    wr(kx - 0.3, ky + 1.5, 3, 0.3, "#806838");
  }
  // Second rarer knot type — a lighter spot
  if (v > 0.6 && v < 0.65) {
    const kx2 = x + 8 + ((v * 4) % 5);
    const ky2 = y + 7 + ((v * 3) % 5);
    wr(kx2, ky2, 1.5, 1, "#907850");
  }
}

export function drawOfficeWall(helpers: DrawHelpers, tx: number, ty: number): void {
  const { wr, lighten } = helpers;
  const x = tx * TS,
    y = ty * TS,
    v = fv(tx, ty);

  // Warm sage wall base — slight per-tile variation for texture
  const base = v < 0.4 ? "#a0bfb0" : v < 0.75 ? "#9dbcad" : "#a4c2b4";
  wr(x, y, TS, TS, base);

  // Subtle plaster texture — tiny darker/lighter speckles
  if (v > 0.3 && v < 0.5) {
    wr(x + ((v * 11) % 13), y + ((v * 7) % 11), 1, 0.5, lighten(base, -5));
  }
  if (v > 0.65) {
    wr(x + ((v * 9) % 12), y + ((v * 13) % 12), 1.5, 0.5, lighten(base, 4));
  }

  // Top edge highlight — light hitting the top
  wr(x, y, TS, 1, "#c0d8ca");
  wr(x, y + 1, TS, 0.5, lighten(base, 6));

  // Bottom edge — slight shadow before baseboard
  wr(x, y + TS - 3, TS, 0.5, lighten(base, -6));

  // Wainscot/panel line — subtle horizontal moulding at mid-height
  const moulding = Math.floor(TS * 0.55);
  wr(x, y + moulding, TS, 0.6, lighten(base, -10));
  wr(x, y + moulding + 0.6, TS, 0.4, lighten(base, 5));

  // Vertical panel lines at regular intervals
  if (tx % 4 === 0) {
    wr(x, y + 2, 0.6, TS - 5, lighten(base, -8));
    wr(x + 0.6, y + 2, 0.3, TS - 5, lighten(base, 4));
  }

  // Baseboard / skirting board at bottom — darker wood strip
  wr(x, y + TS - 2.5, TS, 2.5, "#5a7a68");
  // Baseboard top edge highlight
  wr(x, y + TS - 2.5, TS, 0.5, "#6a8a78");
  // Baseboard bottom shadow
  wr(x, y + TS - 0.5, TS, 0.5, "#4a6a58");
}

export function drawRightWall(helpers: DrawHelpers, tx: number, ty: number): void {
  const { wr } = helpers;
  const x = tx * TS,
    y = ty * TS;
  wr(x, y, TS, TS, "#8aaa98");
  wr(x, y, 1, TS, "#a8cbb8");
  wr(x + TS - 1, y, 1, TS, "#607868");
  if (ty % 4 === 0) wr(x + 2, y, TS - 4, 1, "#7a9888");
}

export function drawDoor(helpers: DrawHelpers, tx: number, ty: number): void {
  const { wr } = helpers;
  const x = tx * TS,
    y = ty * TS;
  wr(x, y, TS, TS, "#c8a878");
  wr(x, y, 2, TS, "#7a5030");
  wr(x + TS - 2, y, 2, TS, "#9a6840");
}

// ---------------------------------------------------------------------------
// Grass
// ---------------------------------------------------------------------------

export function drawGrass(
  helpers: DrawHelpers,
  tx: number,
  ty: number,
  season: Season,
): void {
  const { wr, lighten } = helpers;
  const x = tx * TS,
    y = ty * TS,
    v = fv(tx, ty);

  const gc: Record<Season, string[]> = {
    spring: ["#58b04a", "#60b852", "#54a844", "#68c05a"],
    summer: ["#38a028", "#40a830", "#36982a", "#4aaa34"],
    autumn: ["#b09030", "#a88828", "#b89838", "#c0a040"],
    winter: ["#b8c8c0", "#c0d0c8", "#b0c0b8", "#c8d8d0"],
  };
  const cols = gc[season];
  wr(x, y, TS, TS, cols[Math.floor(v * cols.length)]);

  if (season !== "winter" && v > 0.72) {
    wr(x + ((v * 10) % 13), y + ((v * 7) % 13), 1, 3, lighten(cols[0], -15));
    wr(x + ((v * 13) % 12), y + ((v * 11) % 12), 1, 2, lighten(cols[0], -8));
  }
  if (season === "winter" && v > 0.6)
    wr(x + ((v * 12) % 14), y + ((v * 10) % 14), 3, 1, "#e8f0f0");
}

// ---------------------------------------------------------------------------
// Desk
// ---------------------------------------------------------------------------

// Desk mat colours per zone
const DESK_MAT_COLS: Record<string, string> = {
  lunary: "#6028a0",
  spellcast: "#0a5a70",
  dev: "#105030",
  meta: "#7a1040",
};

export function drawDesk(
  helpers: DrawHelpers,
  zone: DeskZone,
  animTick: number,
  isActive: boolean,
  hasBadge: boolean,
  stats: IsleStats | null,
): void {
  const { wr, we } = helpers;
  const x = zone.deskX,
    y = zone.deskY,
    dw = 3 * TS,
    dh = TS;

  // Desk legs (4 thin dark rectangles at corners)
  wr(x + 1, y + dh - 1, 2, 3, "#2a1408");
  wr(x + dw - 3, y + dh - 1, 2, 3, "#2a1408");
  wr(x + 1, y - 1, 2, 2, "#2a1408");
  wr(x + dw - 3, y - 1, 2, 2, "#2a1408");

  // Modesty panel (front edge)
  const panelY = zone.facing === "up" ? y + dh - 2 : y;
  wr(x + 2, panelY, dw - 4, 3, "#4a2810");
  wr(x + 3, panelY + 1, dw - 6, 1, "#5a3418");

  // Tabletop — thicker with edge highlight
  wr(x, y, dw, dh, "#5a3418");
  wr(x + 1, y + 1, dw - 2, dh - 2, "#6e4228");
  // Top edge highlight
  wr(x, y, dw, 2, "#8a5830");
  // Left edge
  wr(x, y, 1, dh, "#7a4a20");
  // Right edge shadow
  wr(x + dw - 1, y, 1, dh, "#3a1e08");
  // Bottom edge shadow
  wr(x, y + dh - 1, dw, 1, "#3a1e08");
  // Inner highlight line
  wr(x + 2, y + 2, dw - 4, 1, "#7a4c28");

  // Desk mat (zone-coloured) with subtle border
  const matCol = DESK_MAT_COLS[zone.id] ?? "#404040";
  wr(x + 2, y + 2, dw - 4, dh - 4, matCol);
  wr(x + 3, y + 3, dw - 6, dh - 6, matCol + "cc");
  // Mat border
  wr(x + 2, y + 2, dw - 4, 1, matCol + "60");
  wr(x + 2, y + dh - 3, dw - 4, 1, matCol + "60");

  // Monitor
  const monitorAtBottom = zone.facing === "down";
  const mx = x + dw / 2 - 5;
  const my = monitorAtBottom ? y + dh - 9 : y + 1;
  wr(mx, my, 10, 8, "#1a1a28");

  if (isActive) {
    // Working — code lines in zone accent colour
    wr(mx + 1, my + 1, 8, 6, "#081a10");
    const g = zone.monitorGlow;
    const offset = animTick % 4;
    const lines = [
      { w: 4, x: 0 },
      { w: 7, x: 0 },
      { w: 3, x: 1 },
      { w: 6, x: 0 },
      { w: 5, x: 0 },
    ];
    for (let i = 0; i < 4; i++) {
      const li = lines[(i + offset) % lines.length];
      if (i !== animTick % 4) {
        wr(mx + 1 + li.x, my + 1 + i * 1.4, li.w, 0.9, g);
      }
    }
    if (animTick % 2 === 0)
      wr(mx + 1 + ((animTick * 2) % 6), my + 1 + (animTick % 4) * 1.4, 1, 1, "#ffffff");
  } else {
    // Data display — show zone-specific info on the monitor screen
    drawMonitorData(wr, we, mx, my, zone, stats, animTick);
  }

  // Monitor stand
  wr(mx + 4, my + (monitorAtBottom ? -3 : 8), 2, 3, "#2a2a2a");
  wr(mx + 2, my + (monitorAtBottom ? -5 : 10), 6, 1.5, "#2a2a2a");

  // Keyboard
  const ky = monitorAtBottom ? y + 2 : y + dh - 5;
  wr(x + 3, ky, 8, 3, "#202020");
  wr(x + 4, ky + 1, 6, 1.5, "#303030");

  // Zone-specific desk decorations (data-reactive)
  drawDeskDecorations(wr, we, x, y, dw, mx, my, zone, stats, animTick);
}

// ── Monitor data displays (8×6 pixel screen area) ──

function drawMonitorData(
  wr: DrawHelpers["wr"],
  we: DrawHelpers["we"],
  mx: number, my: number,
  zone: DeskZone,
  stats: IsleStats | null,
  animTick: number,
): void {
  if (zone.id === "lunary") {
    // Dark purple screen — animated mini sparkline
    wr(mx + 1, my + 1, 8, 6, "#0c0618");
    if (stats) {
      const dau = stats.lunary.activeToday;
      const maxDau = 50;
      const norm = Math.min(1, dau / maxDau);
      // 6 sparkline points that shift with animTick — looks like a live graph
      const phase = animTick * 0.3;
      for (let i = 0; i < 6; i++) {
        const v = norm * (0.4 + 0.6 * Math.abs(Math.sin(phase + i * 0.8)));
        const h = Math.max(0.8, v * 4.5);
        wr(mx + 1.5 + i * 1.2, my + 6.5 - h, 0.8, h, "#9060d0");
        // Bright top pixel on each bar
        wr(mx + 1.5 + i * 1.2, my + 6.5 - h, 0.8, 0.5, "#c090ff");
      }
      // Health dot — top right
      const isDown = stats.badges[zone.id]?.alert;
      wr(mx + 7.5, my + 1.5, 1.5, 1.5, isDown ? "#ff3030" : "#40c060");
      // Faint scanline
      wr(mx + 1, my + 1 + (animTick % 6), 8, 0.3, "rgba(200,160,255,0.08)");
    } else {
      we(mx + 5, my + 4, 2, 2, zone.monitorGlow, 0.15 + 0.1 * Math.sin(animTick * 0.5));
    }
  } else if (zone.id === "spellcast") {
    // Dark cyan screen — post pipeline visualisation
    wr(mx + 1, my + 1, 8, 6, "#041018");
    if (stats) {
      const posted = stats.spellcast.postsToday;
      const queued = stats.spellcast.scheduled;
      // Queue pipeline: dots flow left-to-right representing posts moving through
      const total = Math.min(posted + queued, 8);
      for (let i = 0; i < total; i++) {
        const isPosted = i < posted;
        // Shift positions with animTick so dots appear to flow
        const px = mx + 1.5 + ((i + animTick * 0.2) % 8) * 0.95;
        wr(px, my + 3.5, 0.8, 0.8, isPosted ? "#20c8a0" : "#1890b0");
      }
      // Top: queue depth bar that fills left-to-right
      const qW = Math.max(0.5, Math.min(7, (queued / 12) * 7));
      wr(mx + 1.5, my + 1.5, qW, 1, "#1890b0");
      wr(mx + 1.5, my + 1.5, Math.min(qW, 1), 1, "#40d0f0"); // bright leading edge
      // Bottom: posted count as filled segments
      const pW = Math.max(0.5, Math.min(7, (posted / 6) * 7));
      wr(mx + 1.5, my + 5.5, pW, 1, "#20c8a0");
      // Failed — red corner
      const badge = stats.badges[zone.id];
      if (badge?.alert && badge.count && badge.count > 0) {
        wr(mx + 7, my + 1, 2, 2, animTick % 3 !== 0 ? "#c02020" : "#601010");
      }
      // Scanline
      wr(mx + 1, my + 1 + (animTick % 6), 8, 0.3, "rgba(80,220,255,0.06)");
    } else {
      we(mx + 5, my + 4, 2, 2, zone.monitorGlow, 0.15 + 0.1 * Math.sin(animTick * 0.5));
    }
  } else if (zone.id === "dev") {
    // Dark green screen — live health dashboard
    wr(mx + 1, my + 1, 8, 6, "#041208");
    if (stats) {
      const up = stats.infra.systemsUp;
      const total = stats.infra.totalSystems;
      // 3 service health bars with animated pulse on active ones
      for (let i = 0; i < total; i++) {
        const ok = i < up;
        const barW = ok ? 6 : 4;
        const pulse = ok ? (0.9 + 0.1 * Math.sin(animTick * 0.4 + i)) : 1;
        wr(mx + 1.5, my + 1.5 + i * 2, barW, 1.2, ok ? "#30b060" : "#b03030");
        // Activity dot that crawls along healthy bars
        if (ok) {
          const dotPos = (animTick * 0.3 + i * 2) % barW;
          wr(mx + 1.5 + dotPos, my + 1.5 + i * 2, 0.8, 1.2 * pulse, "#70ff90");
        }
      }
      // Scanline
      wr(mx + 1, my + 1 + (animTick % 6), 8, 0.3, "rgba(100,255,150,0.06)");
    } else {
      we(mx + 5, my + 4, 2, 2, zone.monitorGlow, 0.15 + 0.1 * Math.sin(animTick * 0.5));
    }
  } else if (zone.id === "meta") {
    // Dark pink screen — engagement heartbeat
    wr(mx + 1, my + 1, 8, 6, "#180810");
    if (stats) {
      // Heartbeat line across the screen
      const reach = stats.meta.reachThisWeek;
      const amp = Math.min(2, (reach / 3000) * 2);
      for (let i = 0; i < 7; i++) {
        const py = 3.5 + amp * Math.sin((animTick * 0.4) + i * 1.2);
        wr(mx + 1.5 + i, my + py, 0.8, 0.8, "#d060a0");
      }
      // Follower count as pixel grid (each pixel = 100 followers)
      const fk = Math.floor(stats.meta.followers / 100);
      const dots = Math.min(fk, 8);
      for (let i = 0; i < dots; i++) {
        const row = Math.floor(i / 4);
        const col = i % 4;
        wr(mx + 1.5 + col * 1.8, my + 5 + row * 1, 1, 0.7, "#f080c0");
      }
      // Opportunity amber corner
      const badge = stats.badges[zone.id];
      if (badge?.alert && badge.count && badge.count > 0) {
        wr(mx + 7, my + 1, 2, 1.5, "#e0a020");
      }
    } else {
      we(mx + 5, my + 4, 2, 2, zone.monitorGlow, 0.15 + 0.1 * Math.sin(animTick * 0.5));
    }
  }
}

// ── Data-reactive desk decorations ──

function drawDeskDecorations(
  wr: DrawHelpers["wr"],
  we: DrawHelpers["we"],
  x: number, y: number, dw: number,
  mx: number, my: number,
  zone: DeskZone,
  stats: IsleStats | null,
  animTick: number,
): void {
  if (zone.id === "lunary") {
    // Crystal ball — glow pulses with active users, inner light swirls
    const dau = stats?.lunary.activeToday ?? 0;
    const baseGlow = Math.min(0.85, 0.25 + (dau / 30) * 0.5);
    const pulse = baseGlow + 0.1 * Math.sin(animTick * 0.3);
    const cx = x + dw - 4, cy = y + 5;
    // Outer glow aura (visible on desk surface)
    we(cx, cy + 1, 4, 2, "#c8a0f0", pulse * 0.15);
    // Ball
    we(cx, cy, 2.5, 2.5, "#c8a0f0", pulse);
    we(cx, cy - 0.5, 1.5, 1.5, "#e0c8ff", pulse * 0.6);
    // Inner swirl — a bright speck that orbits inside the ball
    const sx = cx + 1 * Math.cos(animTick * 0.25);
    const sy = cy + 0.6 * Math.sin(animTick * 0.25);
    wr(sx - 0.3, sy - 0.3, 0.6, 0.6, `rgba(255,220,255,${(pulse * 0.5).toFixed(2)})`);
    // Base
    wr(x + dw - 5.5, y + 7, 5, 1.5, "#8060a0");
  } else if (zone.id === "spellcast") {
    // Scroll pile — height scales with queue depth
    const queued = stats?.spellcast.scheduled ?? 0;
    const layers = Math.max(1, Math.min(4, Math.ceil(queued / 3)));
    const baseY = y + 3 + (4 - layers) * 1.2;
    for (let i = 0; i < layers; i++) {
      const ly = baseY + i * 1.3;
      // Each scroll slightly offset for a messy pile look
      const off = (i % 2) * 0.5;
      wr(x + 1 + off, ly, 4 - off, 1.8, "#f0e8d0");
      wr(x + 1 + off, ly, 4 - off, 0.5, "#e0d8c0");
      // Faint text lines on scroll
      wr(x + 1.5 + off, ly + 0.8, 2.5, 0.3, "#c0b898");
    }
    // Quill pen
    wr(x + dw - 4, y + 3, 1, 6, "#b08040");
    wr(x + dw - 5, y + 2, 2, 2, "#f0e0c0");
    // Ink dot on desk — appears when posts are scheduled (quill was used recently)
    if (queued > 0) {
      const inkAlpha = 0.3 + 0.15 * Math.sin(animTick * 0.2);
      wr(x + dw - 3, y + 9, 1.5, 0.8, `rgba(30,30,80,${inkAlpha.toFixed(2)})`);
    }
  } else if (zone.id === "dev") {
    // Mini terminal — shows scrolling service output
    wr(x + 1, y + 3, 5, 4, "#1a1a28");
    wr(x + 1.5, y + 3.5, 4, 3, "#0a1810");
    if (stats) {
      const up = stats.infra.systemsUp;
      const total = stats.infra.totalSystems;
      // Scrolling log lines — shift down with animTick
      for (let i = 0; i < total; i++) {
        const ok = i < up;
        const lineY = y + 4 + ((i + animTick * 0.15) % 3) * 0.9;
        wr(x + 2, lineY, ok ? 3 : 2, 0.5, ok ? "#30b878" : "#b04040");
      }
      // Blinking cursor
      if (animTick % 2 === 0) {
        wr(x + 2, y + 6.2, 0.8, 0.5, "#30b878");
      }
    } else {
      wr(x + 2, y + 4, 2, 0.8, "#30b878");
      wr(x + 2, y + 5, 3, 0.8, "#30b878");
    }
    // Coffee mug
    wr(x + dw - 4, y + 4, 3, 4, "#404040");
    wr(x + dw - 4, y + 5, 3, 2, "#6a4a30");
    // Animated steam — two wisps that drift upward and fade
    if (stats && stats.infra.systemsUp === stats.infra.totalSystems) {
      const t1 = (animTick * 0.2) % 3;
      const t2 = ((animTick * 0.2) + 1.5) % 3;
      const a1 = Math.max(0, 0.3 - t1 * 0.1);
      const a2 = Math.max(0, 0.25 - t2 * 0.1);
      wr(x + dw - 3.5, y + 3.5 - t1, 0.7, 0.8, `rgba(210,210,220,${a1.toFixed(2)})`);
      wr(x + dw - 2.3, y + 3 - t2, 0.7, 0.8, `rgba(210,210,220,${a2.toFixed(2)})`);
    }
  } else if (zone.id === "meta") {
    // Phone — screen shows live notification feed
    wr(x + 1, y + 3, 3, 5, "#2a2a30");
    wr(x + 1.5, y + 3.5, 2, 4, "#2838a0");
    wr(x + 1.5, y + 3.5, 2, 0.5, "#606080"); // status bar
    const badge = stats?.badges[zone.id];
    if (badge?.count && badge.count > 0) {
      // Notification rows scrolling on phone screen
      const dots = Math.min(badge.count, 3);
      for (let i = 0; i < dots; i++) {
        const ny = y + 4.3 + ((i + animTick * 0.1) % 3) * 1;
        wr(x + 1.7, ny, 1.6, 0.5, "#e08050");
      }
    } else {
      // Idle phone — dim home screen
      wr(x + 1.8, y + 5, 1.2, 1.2, "#405080");
    }
    // Camera — lens glints when there are opportunities
    wr(x + dw - 5, y + 4, 4, 3, "#404040");
    wr(x + dw - 4, y + 4.5, 2, 2, "#606060");
    const lensGlint = badge?.alert ? 0.9 : 0.5;
    we(x + dw - 3, y + 5.5, 1, 1, "#8080a0", lensGlint);
    if (badge?.alert && animTick % 4 === 0) {
      // Camera flash glint
      we(x + dw - 3, y + 5.5, 1.5, 1.5, "#ffffff", 0.15);
    }
  }
}

// ── Whiteboard (data-driven) ──

export function drawWhiteboardData(
  helpers: DrawHelpers,
  f: FurniturePiece,
  stats: IsleStats | null,
): void {
  const { wr } = helpers;
  const x = f.tx * TS,
    y = f.ty * TS;
  const bw = 3 * TS;
  // Board frame
  wr(x, y, bw, TS, "#f4f4f0");
  wr(x, y, bw, 1.5, "#c8c8c0");
  wr(x, y + TS - 1.5, bw, 1.5, "#c8c8c0");
  wr(x, y, 1.5, TS, "#c8c8c0");
  wr(x + bw - 1.5, y, 1.5, TS, "#c8c8c0");

  if (stats) {
    // ── Row 1: service health — 3 coloured squares with labels ──
    const up = stats.infra.systemsUp;
    const total = stats.infra.totalSystems;
    for (let i = 0; i < total; i++) {
      const ok = i < up;
      wr(x + 3 + i * 5, y + 2.5, 3, 3, ok ? "#40b060" : "#e04848");
      // Shadow
      wr(x + 3 + i * 5, y + 5.5, 3, 0.5, ok ? "#308848" : "#b03838");
    }

    // ── Row 2: 7-day mini calendar ── (7 dots, coloured by post count)
    const today = new Date();
    for (let d = 0; d < 7; d++) {
      const dayOfWeek = (today.getDay() + d) % 7;
      // Weekend = slightly dimmer
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isToday = d === 0;
      // Colour based on queue: green if posts scheduled, grey if gap
      // We approximate: today + tomorrow have data, rest we show as planned
      let dotCol = "#c0c0b8"; // grey = unknown
      if (d === 0 && stats.spellcast.postsToday > 0) dotCol = "#40b060";
      else if (d === 0 && stats.spellcast.postsToday === 0) dotCol = "#e0a030";
      else if (d <= 2 && stats.spellcast.scheduled > 0) dotCol = "#60b070";

      wr(x + 19 + d * 3.5, y + 3, 2, 2, dotCol);
      // Today marker — tiny underline
      if (isToday) wr(x + 19 + d * 3.5, y + 5.2, 2, 0.5, "#4040d0");
      // Weekend dimming
      if (isWeekend) wr(x + 19 + d * 3.5, y + 3, 2, 2, "rgba(244,244,240,0.35)");
    }

    // ── Row 3: posts today tally + queue bar ──
    // Tally marks (blue marker)
    const posts = stats.spellcast.postsToday;
    const marks = Math.min(posts, 5);
    for (let i = 0; i < marks; i++) {
      wr(x + 3 + i * 2, y + 8, 0.8, 3.5, "#5858c8");
    }
    if (marks >= 5) {
      // Diagonal strike-through
      wr(x + 2, y + 9, 11, 0.6, "#5858c8");
    }

    // Queue depth bar (orange marker)
    const queued = stats.spellcast.scheduled;
    const maxW = bw - 22;
    const barW = Math.max(1, Math.min(maxW, (queued / 12) * maxW));
    wr(x + 19, y + 9, barW, 1.5, "#e08040");
    // Bright cap
    wr(x + 19 + barW - 1, y + 9, 1, 1.5, "#f0a060");
  } else {
    // Static whiteboard — faint marker lines
    wr(x + 3, y + 4, 10, 0.8, "#c0c0d0");
    wr(x + 3, y + 7, 14, 0.8, "#c0c0d0");
    wr(x + 3, y + 10, 8, 0.8, "#c0c0d0");
  }

  // Marker tray with actual marker colours
  wr(x + 2, y + TS - 3.5, bw - 4, 1.5, "#b0b0a8");
  wr(x + 4, y + TS - 4, 1, 2, "#4040d0"); // blue marker
  wr(x + 7, y + TS - 4, 1, 2, "#e04848"); // red marker
  wr(x + 10, y + TS - 4, 1, 2, "#40b060"); // green marker
  wr(x + 13, y + TS - 4, 1, 2, "#e08040"); // orange marker
}

// ---------------------------------------------------------------------------
// Chair
// ---------------------------------------------------------------------------

export function drawChair(helpers: DrawHelpers, zone: DeskZone): void {
  const { wr } = helpers;
  const sz = 12;
  const cx = zone.seatX - sz / 2,
    cy = zone.seatY - sz / 2;

  // Caster wheels (4 small dots at base)
  wr(cx, cy + sz - 1, 2, 2, "#1a0a04");
  wr(cx + sz - 2, cy + sz - 1, 2, 2, "#1a0a04");
  wr(cx, cy - 1, 2, 2, "#1a0a04");
  wr(cx + sz - 2, cy - 1, 2, 2, "#1a0a04");

  // Seat base
  wr(cx, cy + 2, sz, sz - 3, "#4a3020");
  // Cushion top highlight
  wr(cx + 1, cy + 3, sz - 2, sz - 5, "#6a4830");
  // Cushion centre padding
  wr(cx + 2, cy + 4, sz - 4, sz - 7, "#7a5838");
  // Seat side shadow
  wr(cx, cy + sz - 2, sz, 1, "#3a2018");

  // Armrests connecting to seat
  wr(cx - 2, cy + 3, 2, sz - 6, "#5a3828");
  wr(cx + sz, cy + 3, 2, sz - 6, "#5a3828");
  // Armrest top caps
  wr(cx - 2, cy + 3, 2, 2, "#6a4830");
  wr(cx + sz, cy + 3, 2, 2, "#6a4830");

  // Backrest
  const brAtTop = zone.facing === "up";
  const bry = brAtTop ? cy - 1 : cy + sz - 2;
  wr(cx, bry, sz, 4, "#4a3020");
  // Fabric texture — lighter stripe
  wr(cx + 1, bry + 1, sz - 2, 1, "#6a4830");
  wr(cx + 1, bry + 2, sz - 2, 1, "#5a3828");
}

// ---------------------------------------------------------------------------
// Furniture pieces
// ---------------------------------------------------------------------------

export function drawRug(helpers: DrawHelpers, f: FurniturePiece): void {
  const { wr, lighten } = helpers;
  const x = f.tx * TS,
    y = f.ty * TS,
    w = (f.tw ?? 4) * TS,
    h = (f.th ?? 3) * TS;
  const c1 = f.c1 ?? "#7848a0",
    c2 = f.c2 ?? "#9060c0";
  const c3 = lighten(c1, -20); // deep border
  const c4 = lighten(c2, 15);  // inner highlight
  const gold = "#d4a840";
  const cream = "#f0e8d0";

  // --- Fringe / tassels at top and bottom ---
  for (let fx = 0; fx < w; fx += 2) {
    // Top fringe
    wr(x + fx, y - 2, 1, 2.5, fx % 4 < 2 ? c1 : c3);
    // Bottom fringe
    wr(x + fx, y + h - 0.5, 1, 2.5, fx % 4 < 2 ? c1 : c3);
  }

  // --- Base rug fill ---
  wr(x, y, w, h, c3);

  // --- Outer border — ornate repeating pattern ---
  wr(x + 1, y + 1, w - 2, h - 2, c1);
  // Gold border line
  wr(x + 2, y + 2, w - 4, 1, gold);
  wr(x + 2, y + h - 3, w - 4, 1, gold);
  wr(x + 2, y + 2, 1, h - 4, gold);
  wr(x + w - 3, y + 2, 1, h - 4, gold);
  // Repeating diamond motifs along outer border
  for (let bx = 6; bx < w - 6; bx += 6) {
    // Top border diamonds
    wr(x + bx, y + 3.5, 2, 2, cream);
    wr(x + bx + 0.5, y + 4, 1, 1, c3);
    // Bottom border diamonds
    wr(x + bx, y + h - 5.5, 2, 2, cream);
    wr(x + bx + 0.5, y + h - 5, 1, 1, c3);
  }
  for (let by = 6; by < h - 6; by += 6) {
    // Left border diamonds
    wr(x + 3.5, y + by, 2, 2, cream);
    wr(x + 4, y + by + 0.5, 1, 1, c3);
    // Right border diamonds
    wr(x + w - 5.5, y + by, 2, 2, cream);
    wr(x + w - 5, y + by + 0.5, 1, 1, c3);
  }

  // --- Inner field ---
  wr(x + 6, y + 6, w - 12, h - 12, c2);
  // Second inner border
  wr(x + 7, y + 7, w - 14, 0.7, lighten(gold, -10));
  wr(x + 7, y + h - 7.7, w - 14, 0.7, lighten(gold, -10));
  wr(x + 7, y + 7, 0.7, h - 14, lighten(gold, -10));
  wr(x + w - 7.7, y + 7, 0.7, h - 14, lighten(gold, -10));

  // --- Inner field pattern ---
  wr(x + 8, y + 8, w - 16, h - 16, c4);

  // Corner ornaments — stylised floral motif in each inner corner
  const corners: [number, number][] = [
    [x + 9, y + 9],
    [x + w - 13, y + 9],
    [x + 9, y + h - 13],
    [x + w - 13, y + h - 13],
  ];
  for (const [cx, cy] of corners) {
    wr(cx, cy, 3, 3, c1);
    wr(cx + 0.5, cy + 0.5, 2, 2, gold);
    wr(cx + 1, cy + 1, 1, 1, cream);
  }

  // --- Central medallion — Persian style ---
  const mcx = x + w / 2, mcy = y + h / 2;
  // Outer medallion diamond
  wr(mcx - 6, mcy - 1.5, 12, 3, c1);
  wr(mcx - 1.5, mcy - 6, 3, 12, c1);
  wr(mcx - 4.5, mcy - 4, 9, 8, c1);
  // Inner medallion
  wr(mcx - 3.5, mcy - 3, 7, 6, c3);
  wr(mcx - 2.5, mcy - 2, 5, 4, gold);
  wr(mcx - 1.5, mcy - 1, 3, 2, cream);
  // Tiny centre dot
  wr(mcx - 0.5, mcy - 0.3, 1, 0.6, c3);

  // --- Fill pattern — small repeating motifs in the field ---
  for (let px = 14; px < w - 14; px += 8) {
    for (let py = 14; py < h - 14; py += 8) {
      // Skip medallion area
      const dx = Math.abs(x + px - mcx), dy = Math.abs(y + py - mcy);
      if (dx < 7 && dy < 7) continue;
      // Small cross/star motif
      wr(x + px, y + py, 1.5, 0.5, c1);
      wr(x + px + 0.5, y + py - 0.5, 0.5, 1.5, c1);
    }
  }
}

export function drawSofa(helpers: DrawHelpers, f: FurniturePiece): void {
  const { wr, lighten } = helpers;
  const x = f.tx * TS,
    y = f.ty * TS,
    sw = (f.tw ?? 3) * TS,
    sh = (f.th ?? 2) * TS;

  // --- Visible legs beneath sofa ---
  wr(x + 2, y + sh - 1, 2, 3, "#3a2818");
  wr(x + sw - 4, y + sh - 1, 2, 3, "#3a2818");
  // Middle support leg
  wr(x + sw / 2 - 1, y + sh - 1, 2, 2.5, "#3a2818");
  // Leg highlight
  wr(x + 2, y + sh - 1, 2, 0.5, "#5a4030");
  wr(x + sw - 4, y + sh - 1, 2, 0.5, "#5a4030");

  // --- Sofa body / frame ---
  wr(x, y, sw, sh, "#5848a0");
  // Bottom shadow under sofa body
  wr(x, y + sh - 1.5, sw, 1.5, "#383888");

  // --- Backrest ---
  wr(x, y, sw, 4, "#3838a0");
  wr(x + 1, y + 1, sw - 2, 1, "#6868c0"); // top highlight
  wr(x + 1, y + 2, sw - 2, 1.5, "#4848a8"); // backrest body
  wr(x, y + 3.5, sw, 0.5, "#282888"); // backrest bottom shadow

  // --- Armrests with rounded top ---
  // Left armrest
  wr(x, y, 4, sh, "#4848a0");
  wr(x + 0.5, y + 1, 3, sh - 3, "#5050a8");
  wr(x + 0.5, y + 1, 3, 1, "#6868c0"); // top cap
  wr(x, y, 0.5, sh, "#383890"); // outer shadow
  // Right armrest
  wr(x + sw - 4, y, 4, sh, "#4848a0");
  wr(x + sw - 3.5, y + 1, 3, sh - 3, "#5050a8");
  wr(x + sw - 3.5, y + 1, 3, 1, "#6868c0"); // top cap
  wr(x + sw - 0.5, y, 0.5, sh, "#303088"); // outer shadow

  // --- Seat area ---
  wr(x + 4, y + 4, sw - 8, sh - 5, "#7868b8");

  // --- Individual cushions with shadows and tufting ---
  const cw = Math.floor((sw - 8) / 3);
  for (let i = 0; i < 3; i++) {
    const cx = x + 4 + i * (cw + 0.5);
    const cy = y + 4;
    const ch = sh - 6;
    // Cushion base
    wr(cx + 0.5, cy, cw - 1, ch, "#8878c8");
    // Top highlight on cushion
    wr(cx + 1, cy + 0.5, cw - 2, 1, "#a098d8");
    // Bottom shadow on cushion
    wr(cx + 0.5, cy + ch - 1, cw - 1, 1, "#6858a8");
    // Side shadow between cushions
    if (i < 2) wr(cx + cw - 0.5, cy, 1, ch, "#6050a0");
    // Pillow tufting — button dimple detail
    const btnX = cx + cw / 2 - 0.5;
    const btnY = cy + ch * 0.35;
    wr(btnX, btnY, 1, 1, "#7060b0");
    // Tufting lines radiating from button
    wr(btnX - 2, btnY + 0.3, 2, 0.3, "#7868b0");
    wr(btnX + 1, btnY + 0.3, 2, 0.3, "#7868b0");
    wr(btnX + 0.3, btnY - 1.5, 0.3, 1.5, "#7868b0");
    wr(btnX + 0.3, btnY + 1, 0.3, 1.5, "#7868b0");
  }

  // --- Decorative throw pillow on left cushion ---
  const px = x + 5, py = y + 5;
  wr(px, py, 5, 4, "#e0a0c0");
  wr(px + 0.5, py + 0.5, 4, 1, lighten("#e0a0c0", 15));
  wr(px + 0.5, py + 3, 4, 0.5, lighten("#e0a0c0", -10));
}

export function drawCoffeeTable(helpers: DrawHelpers, f: FurniturePiece): void {
  const { wr } = helpers;
  const x = f.tx * TS,
    y = f.ty * TS;
  wr(x, y, 2 * TS, TS, "#7a5830");
  wr(x + 1, y + 1, 2 * TS - 2, TS - 2, "#9a7040");
  wr(x, y, 2 * TS, 1, "#b09050");
  wr(x + 4, y + 3, 4, 6, "#e0a030");
  wr(x + 11, y + 4, 3, 5, "#d03020");
  wr(x + 11, y + 5, 3, 3, "#f0f0f0");
}

export function drawWhiteboard(helpers: DrawHelpers, f: FurniturePiece): void {
  const { wr } = helpers;
  const x = f.tx * TS,
    y = f.ty * TS;
  wr(x, y, 3 * TS, TS, "#f8f8f8");
  wr(x, y, 3 * TS, 2, "#c0c0c0");
  wr(x, y + TS - 2, 3 * TS, 2, "#c0c0c0");
  wr(x, y, 2, TS, "#c0c0c0");
  wr(x + 3 * TS - 2, y, 2, TS, "#c0c0c0");
  wr(x + 3, y + 4, 10, 1, "#6868d0");
  wr(x + 3, y + 7, 7, 1, "#6868d0");
  wr(x + 3, y + 10, 12, 1, "#6868d0");
  wr(x + 16, y + 4, 8, 1, "#e04848");
  wr(x + 16, y + 7, 10, 1, "#e04848");
  wr(x + 2, y + TS - 4, 3 * TS - 4, 2, "#a0a0a0");
}

export function drawWaterCooler(helpers: DrawHelpers, f: FurniturePiece): void {
  const { wr } = helpers;
  const x = f.tx * TS + 3,
    y = f.ty * TS + 1;
  wr(x, y, 10, 6, "#a8c8e0");
  wr(x + 1, y + 1, 8, 4, "#c0ddf0");
  wr(x + 1, y, 8, 2, "#80a8c8");
  wr(x + 2, y + 5, 6, 10, "#d0d0d0");
  wr(x + 3, y + 6, 4, 8, "#e0e0e0");
  wr(x + 4, y + 9, 2, 2, "#4080c0");
  wr(x + 2, y + 14, 6, 2, "#b0b0b0");
}

export function drawFilingCabinet(helpers: DrawHelpers, f: FurniturePiece): void {
  const { wr } = helpers;
  const x = f.tx * TS + 1,
    y = f.ty * TS;
  wr(x, y, TS - 2, 2 * TS, "#808898");
  wr(x + 1, y + 1, TS - 4, 2 * TS - 2, "#9090a0");
  for (let d = 0; d < 2; d++) {
    const dy = y + 2 + d * (TS - 2);
    wr(x + 2, dy, TS - 6, TS - 4, "#a0a8b0");
    wr(x + 3, dy + 1, TS - 8, TS - 6, "#b0b8c0");
    wr(x + (TS - 2) / 2 - 3, dy + TS / 2 - 5, 6, 4, "#707880");
    wr(x + (TS - 2) / 2 - 2, dy + TS / 2 - 4, 4, 2, "#808890");
  }
}

export function drawBookshelf(helpers: DrawHelpers, tx: number, ty: number): void {
  const { wr, we, lighten } = helpers;
  const x = tx * TS,
    y = ty * TS;
  const bw = 2 * TS;

  // --- Shelf frame ---
  // Back panel
  wr(x, y, bw, TS, "#4a2808");
  // Top surface with highlight
  wr(x, y, bw, 2, "#7a4820");
  wr(x, y, bw, 0.8, "#8a5830"); // top edge shine
  // Left side
  wr(x, y, 2, TS, "#5a3010");
  wr(x + 0.5, y, 0.5, TS, "#6a4018"); // inner edge highlight
  // Right side — shadow
  wr(x + bw - 2, y, 2, TS, "#3a1a08");
  // Bottom shelf board
  wr(x, y + TS - 2, bw, 2, "#5a3010");
  wr(x, y + TS - 2, bw, 0.6, "#7a4820"); // shelf edge highlight

  // --- Books with varying width, height, and tilt ---
  const bc = [
    "#c83838", "#3860d0", "#38903a", "#d8b828",
    "#d04880", "#5838b8", "#38a8c8", "#d06828",
    "#902890", "#289898", "#c06030", "#4870a0",
  ];
  const rng = seededRng(`shelf${tx},${ty}`);

  let bx = x + 2.5;
  let bookIdx = 0;
  while (bx < x + bw - 4) {
    const col = bc[bookIdx % bc.length];
    const bookW = 1.8 + rng() * 1.8; // varied width
    const bookH = TS - 5 - rng() * 4; // varied height
    const bookY = y + TS - 2 - bookH; // sit on shelf

    // Occasional leaning book
    const isLeaning = rng() > 0.8 && bx > x + 6;

    if (isLeaning) {
      // Leaning book — drawn as a slight slant (two offset rects)
      wr(bx - 0.5, bookY + 1, bookW, bookH - 1, col);
      wr(bx, bookY, bookW, bookH - 2, col);
      wr(bx + 0.2, bookY + 0.5, bookW * 0.3, bookH - 3, lighten(col, 15)); // spine highlight
      bx += bookW + 0.3;
    } else {
      // Upright book
      wr(bx, bookY, bookW, bookH, col);
      // Spine highlight
      wr(bx + 0.3, bookY + 0.5, bookW * 0.25, bookH - 1, lighten(col, 18));
      // Spine shadow on right
      wr(bx + bookW - 0.4, bookY, 0.4, bookH, lighten(col, -20));
      // Top page edge (cream line visible at top)
      wr(bx + 0.3, bookY, bookW - 0.6, 0.5, "#e8e0d0");
      bx += bookW + 0.4;
    }

    // Decorative objects in gaps — globe, figurine, small vase
    if (rng() > 0.75 && bx < x + bw - 8) {
      const objType = (bookIdx * 3 + tx) % 3;
      if (objType === 0) {
        // Small globe on stand
        const globeY = y + TS - 6;
        wr(bx + 0.5, globeY + 3, 2, 1, "#6a5030"); // stand base
        wr(bx + 1, globeY + 1, 1, 2, "#6a5030"); // stand pole
        we(bx + 1.5, globeY, 1.8, 1.8, "#3080b0"); // globe
        wr(bx + 0.5, globeY - 0.5, 1, 0.5, "#40a060"); // land mass
        bx += 3.5;
      } else if (objType === 1) {
        // Small figurine / trophy
        const figY = y + TS - 5.5;
        wr(bx + 0.5, figY + 2, 2, 1.5, "#c0a030"); // base
        wr(bx + 1, figY, 1, 2.5, "#c0a030"); // body
        wr(bx + 0.5, figY - 0.5, 2, 1, "#d4b440"); // top
        bx += 3;
      } else {
        // Small vase
        const vaseY = y + TS - 6;
        wr(bx + 0.5, vaseY + 2, 2, 2, "#8870b0"); // body
        wr(bx + 0.8, vaseY + 1, 1.5, 1.5, "#9880c0"); // neck
        wr(bx + 0.3, vaseY + 2, 2.5, 0.5, "#7060a0"); // rim shadow
        // tiny flower poking out
        wr(bx + 1, vaseY, 0.8, 1.5, "#388028");
        wr(bx + 0.5, vaseY - 0.5, 1.5, 1, "#e06080");
        bx += 3.5;
      }
    }

    bookIdx++;
    if (bookIdx > 14) break; // safety
  }
}

export function drawLamp(helpers: DrawHelpers, tx: number, ty: number, tod: TOD): void {
  const { wr, we } = helpers;
  const x = tx * TS + 5,
    y = ty * TS;
  const on = tod !== "morning" && tod !== "afternoon";

  // --- Base — rounded weighted bottom ---
  wr(x - 0.5, y + 9, 7, 2, "#a08848");
  wr(x, y + 8.5, 6, 1, "#b09850"); // base top highlight
  wr(x + 0.5, y + 10.5, 5, 0.5, "#887838"); // base bottom shadow

  // --- Pole — tapered with highlight ---
  wr(x + 2.2, y + 3, 1.6, 6, "#7a5020");
  // Pole highlight strip
  wr(x + 2.5, y + 3.5, 0.5, 5, "#9a7038");
  // Small fitting where pole meets shade
  wr(x + 1.5, y + 3, 3, 1, "#8a6028");

  // --- Lampshade — tapered trapezoid shape ---
  // Shade is wider at bottom than top for realism
  wr(x - 1.5, y + 2, 9, 0.5, "#b09040"); // bottom rim
  wr(x - 1, y + 1.5, 8, 0.5, on ? "#e8d870" : "#c8b858"); // lower shade
  wr(x - 0.5, y + 1, 7, 0.5, on ? "#ead880" : "#c8b858"); // mid shade
  wr(x, y + 0.5, 6, 0.5, on ? "#ece090" : "#d0c060"); // upper shade
  wr(x + 0.5, y, 5, 0.5, on ? "#f0e8a0" : "#d0c060"); // top
  // Top rim
  wr(x + 0.5, y - 0.2, 5, 0.4, "#a08838");
  // Side shadow on shade
  wr(x - 1.5, y + 1, 0.5, 1.5, "#907828");
  wr(x + 7, y + 1, 0.5, 1.5, "#907828");

  if (on) {
    // --- Warm glow cone beneath shade ---
    // Outer soft glow
    we(x + 3, y + 6, 16, 12, "#ffe080", 0.08);
    // Inner brighter glow — cone shape widening downward
    wr(x + 0.5, y + 2.5, 5, 1.5, `rgba(255,240,160,0.15)`);
    wr(x - 1, y + 4, 8, 2, `rgba(255,235,140,0.12)`);
    wr(x - 2, y + 6, 10, 2, `rgba(255,230,120,0.08)`);
    wr(x - 3, y + 8, 12, 2, `rgba(255,225,100,0.05)`);
    // Bright bulb glow at shade opening
    we(x + 3, y + 2.8, 2, 1, "#fff8c0", 0.3);
  }
}

export function drawPlantFurn(helpers: DrawHelpers, f: FurniturePiece): void {
  const { wr } = helpers;
  const x = f.tx * TS,
    y = f.ty * TS,
    t = (f.variant ?? 0) % 5;
  // Pot
  wr(x + 4, y + 10, 8, 6, "#b06030");
  wr(x + 3, y + 9, 10, 2, "#c07040");
  // Plant variants
  if (t === 0) {
    wr(x + 5, y + 2, 6, 8, "#2a8030");
    wr(x + 2, y + 5, 12, 5, "#308838");
    wr(x + 6, y, 4, 4, "#388040");
  } else if (t === 1) {
    wr(x + 6, y + 2, 4, 8, "#38803a");
    wr(x + 2, y + 5, 5, 3, "#38803a");
    wr(x + 9, y + 6, 5, 2, "#38803a");
  } else if (t === 2) {
    wr(x + 3, y + 3, 10, 7, "#2a7828");
    wr(x + 5, y + 1, 6, 5, "#309030");
    wr(x + 9, y + 5, 4, 5, "#309030");
  } else if (t === 3) {
    wr(x + 6, y + 3, 2, 7, "#408030");
    wr(x + 4, y + 2, 8, 5, "#e04070");
    wr(x + 6, y + 1, 4, 4, "#f8e0e8");
  } else {
    wr(x + 5, y, 2, 11, "#50a020");
    wr(x + 9, y + 2, 2, 9, "#60b030");
    wr(x + 7, y + 1, 2, 10, "#48a018");
  }
}

// ---------------------------------------------------------------------------
// Outdoor furniture
// ---------------------------------------------------------------------------

export function drawBench(helpers: DrawHelpers, b: { tx: number; ty: number }): void {
  const { wr, lighten } = helpers;
  const x = b.tx * TS,
    y = b.ty * TS;
  const bw = 3 * TS;

  // --- Support legs (front pair visible) ---
  wr(x + 3, y + TS - 1, 2, 3, "#5a3818");
  wr(x + bw - 5, y + TS - 1, 2, 3, "#5a3818");
  // Back legs (slightly darker, behind seat)
  wr(x + 3, y + 1, 2, 2, "#4a2810");
  wr(x + bw - 5, y + 1, 2, 2, "#4a2810");
  // Cross brace between front legs
  wr(x + 5, y + TS + 1, bw - 10, 1, "#5a3818");

  // --- Seat slats with gaps ---
  const slatW = bw - 6;
  const slatX = x + 3;
  for (let s = 0; s < 4; s++) {
    const sy = y + 3 + s * 2.8;
    const slatCol = s % 2 === 0 ? "#8a5828" : "#7e5024";
    wr(slatX, sy, slatW, 2, slatCol);
    // Top highlight on each slat
    wr(slatX, sy, slatW, 0.5, lighten(slatCol, 12));
    // Bottom shadow
    wr(slatX, sy + 1.7, slatW, 0.3, lighten(slatCol, -10));
    // Plank gap (dark line between slats)
    if (s < 3) wr(slatX, sy + 2, slatW, 0.6, "#3a1a0a");
  }

  // --- Armrests at each end ---
  // Left armrest
  wr(x, y + 2, 4, 2, "#7a5028");
  wr(x, y + 2, 4, 0.6, "#9a6830"); // highlight
  wr(x, y + 2, 1, TS - 2, "#6a4018"); // vertical support
  wr(x + 0.3, y + 2, 0.5, TS - 2, "#7a5028"); // support highlight
  // Right armrest
  wr(x + bw - 4, y + 2, 4, 2, "#7a5028");
  wr(x + bw - 4, y + 2, 4, 0.6, "#9a6830");
  wr(x + bw - 1, y + 2, 1, TS - 2, "#6a4018");
  wr(x + bw - 1.3, y + 2, 0.5, TS - 2, "#7a5028");

  // --- Subtle wood grain detail on top slat ---
  wr(slatX + 5, y + 3.5, 8, 0.2, "#705020");
  wr(slatX + 12, y + 3.8, 6, 0.2, "#705020");
}

export function drawWindow(helpers: DrawHelpers, tx: number, ty: number, tod: TOD): void {
  const { wr, we } = helpers;
  const x = tx * TS,
    y = ty * TS;
  const sc =
    tod === "night"
      ? "#0a0818"
      : tod === "dusk"
        ? "#c04820"
        : tod === "dawn"
          ? "#e07040"
          : "#60a8e0";
  wr(x, y, 2 * TS, TS + 5, "#7a5030");
  wr(x + 2, y + 2, 2 * TS - 4, TS + 1, sc);
  wr(x + TS - 1, y + 2, 2, TS + 1, "#7a5030");
  wr(x + 2, y + TS / 2 + 1, 2 * TS - 4, 2, "#7a5030");
  if (tod === "night" || tod === "dawn") {
    const rng = seededRng(`win${tx}`);
    for (let i = 0; i < 5; i++)
      wr(x + 3 + rng() * (2 * TS - 8), y + 3 + rng() * (TS - 2), 1, 1, "#fff");
  } else {
    we(x + TS / 2, y + 4, 4, 2, "#fff", 0.45);
    we(x + TS + 4, y + 5, 5, 2, "#fff", 0.35);
  }
}

// ---------------------------------------------------------------------------
// Pond
// ---------------------------------------------------------------------------

export function drawPond(helpers: DrawHelpers, tod: TOD, stats: IsleStats | null, animTick: number): void {
  const { wr, we, lighten } = helpers;
  const x = POND_TX * TS,
    y = POND_TY * TS,
    w = POND_TW * TS,
    h = POND_TH * TS;
  const cx = x + w / 2,
    cy = y + h / 2;

  // Health affects water colour — clear blue when healthy, murky when not
  const allOk = !stats || stats.infra.systemsUp === stats.infra.totalSystems;
  const healthyMix = allOk ? 1 : stats ? stats.infra.systemsUp / stats.infra.totalSystems : 1;

  // --- Rocks/pebbles around the pond edge ---
  const rng = seededRng("pond-rocks");
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const rx = cx + Math.cos(angle) * (w / 2 + 1 + rng() * 3);
    const ry = cy + Math.sin(angle) * (h / 2 + 1 + rng() * 2);
    const rw = 1.5 + rng() * 2;
    const rh = 1 + rng() * 1.5;
    const rockCol = rng() > 0.5 ? "#787878" : "#8a8880";
    wr(rx, ry, rw, rh, rockCol);
    // Highlight on top of each rock
    wr(rx + 0.2, ry, rw - 0.4, 0.4, lighten(rockCol, 15));
  }

  // Bank
  we(cx, cy, w / 2 + 3, h / 2 + 3, "#388030", 0.7);
  // Muddy edge between bank and water
  we(cx, cy, w / 2 + 1, h / 2 + 1, "#4a6030", 0.5);

  // Water colours shift: healthy = blue, unhealthy = murky amber
  let wc: string, wl: string;
  if (tod === "night") {
    wc = allOk ? "#0a1838" : "#181808";
    wl = allOk ? "#101840" : "#202010";
  } else if (tod === "dusk") {
    wc = allOk ? "#3848a0" : "#604830";
    wl = allOk ? "#5060b0" : "#705838";
  } else {
    wc = allOk ? "#1878c8" : "#887830";
    wl = allOk ? "#2090d8" : "#988838";
  }

  we(cx, cy, w / 2, h / 2, wc);
  we(cx, cy, w / 2 - 2, h / 2 - 2, wl);
  we(cx, cy, w / 2 - 4, h / 2 - 4, lighten(wl, 20));

  // --- Animated ripples — concentric arcs that expand outward ---
  const ripplePhase = (animTick * 0.15) % 3;
  for (let r = 0; r < 3; r++) {
    const rPhase = (ripplePhase + r) % 3;
    const rRadius = 3 + rPhase * 5;
    const rAlpha = Math.max(0, 0.25 - rPhase * 0.08);
    const rippleCol = `rgba(${tod === "night" ? "80,100,180" : "100,190,240"},${rAlpha.toFixed(2)})`;
    // Draw arc as a thin ellipse at varying radii
    we(cx - 2, cy - 1, rRadius, rRadius * 0.5, rippleCol, rAlpha);
  }
  // Secondary ripple cluster offset
  const rOff2 = ((animTick * 0.2) + 1.5) % 3;
  const r2Alpha = Math.max(0, 0.2 - rOff2 * 0.07);
  we(cx + 6, cy + 3, 2 + rOff2 * 3, 1 + rOff2 * 1.5,
    `rgba(${tod === "night" ? "80,100,180" : "100,190,240"},${r2Alpha.toFixed(2)})`, r2Alpha);

  // --- Small fish — subtle orange dots that drift ---
  if (healthyMix > 0.4) {
    const fishX = cx - 5 + Math.sin(animTick * 0.08) * 8;
    const fishY = cy + 2 + Math.cos(animTick * 0.06) * 3;
    const fishAlpha = 0.4 + 0.15 * Math.sin(animTick * 0.12);
    // Fish body
    wr(fishX, fishY, 2, 1, `rgba(220,140,50,${fishAlpha.toFixed(2)})`);
    // Tail
    wr(fishX - 1, fishY - 0.2, 1, 1.4, `rgba(200,120,40,${(fishAlpha * 0.7).toFixed(2)})`);
    // Second fish, different path
    if (healthyMix > 0.7) {
      const f2x = cx + 4 + Math.cos(animTick * 0.05 + 2) * 6;
      const f2y = cy - 2 + Math.sin(animTick * 0.07 + 1) * 3;
      const f2a = 0.3 + 0.1 * Math.sin(animTick * 0.1 + 1);
      wr(f2x, f2y, 1.5, 0.8, `rgba(230,160,60,${f2a.toFixed(2)})`);
      wr(f2x + 1.5, f2y - 0.1, 0.8, 1, `rgba(210,140,50,${(f2a * 0.6).toFixed(2)})`);
    }
  }

  // --- Lily pads with vein detail ---
  const bob = Math.sin(animTick * 0.15) * 0.5;

  // Pad 1 — large
  const lp1x = x + w * 0.28, lp1y = y + h * 0.65 + bob;
  we(lp1x, lp1y, 4, 3, "#388030");
  we(lp1x, lp1y, 3.5, 2.5, "#409038"); // lighter inner
  // Vein lines
  wr(lp1x - 2, lp1y, 4, 0.3, "#2a6820"); // centre vein
  wr(lp1x - 1, lp1y - 1, 2, 0.3, "#2a6820"); // top vein
  wr(lp1x - 1, lp1y + 1, 2, 0.3, "#2a6820"); // bottom vein
  // Notch in pad (small dark wedge)
  wr(lp1x + 2, lp1y - 0.5, 1.5, 1, wl);

  // Pad 2
  const lp2x = x + w * 0.72, lp2y = y + h * 0.35 - bob;
  we(lp2x, lp2y, 3, 2, "#309020");
  we(lp2x, lp2y, 2.5, 1.5, "#389828");
  wr(lp2x - 1.5, lp2y, 3, 0.25, "#20781a");
  wr(lp2x + 1.5, lp2y - 0.3, 1, 0.7, wl); // notch

  // Pad 3
  const lp3x = x + w * 0.5, lp3y = y + h * 0.8 + bob * 0.5;
  we(lp3x, lp3y, 3, 2, "#3a8828");
  we(lp3x, lp3y, 2.5, 1.5, "#429030");
  wr(lp3x - 1.5, lp3y, 3, 0.25, "#287820");

  // Lily flower on first pad (blooms when healthy)
  if (healthyMix > 0.6) {
    const flx = lp1x + 1, fly = lp1y - 1.5;
    // Outer petals
    we(flx, fly, 2, 1.5, "#f0a0c0", healthyMix * 0.6);
    // Inner petals
    we(flx, fly, 1.2, 0.9, "#f8c0d8", healthyMix * 0.7);
    // Yellow centre
    we(flx, fly, 0.5, 0.4, "#f0d040", healthyMix * 0.8);
  }

  // --- Reeds/cattails at edge positions ---
  // Left reeds
  const reedX1 = x + 4, reedY1 = y + h * 0.3;
  wr(reedX1, reedY1 - 4, 0.6, 6, "#4a7830");
  wr(reedX1 - 0.2, reedY1 - 5, 1, 2, "#5a4020"); // cattail head
  wr(reedX1 + 1.5, reedY1 - 3, 0.5, 5, "#508030");
  wr(reedX1 + 1.3, reedY1 - 4, 0.8, 1.8, "#5a4020"); // cattail head

  // Right reeds
  const reedX2 = x + w - 5, reedY2 = y + h * 0.5;
  wr(reedX2, reedY2 - 3, 0.6, 5, "#4a7830");
  wr(reedX2 - 0.2, reedY2 - 4, 1, 2, "#5a4020");
  // A thin grass blade
  wr(reedX2 + 1.2, reedY2 - 2, 0.4, 4, "#508830");
}

// ---------------------------------------------------------------------------
// Trees
// ---------------------------------------------------------------------------

export function drawTree(
  helpers: DrawHelpers,
  t: { wx: number; wy: number; sz: number },
  season: Season,
  tod: TOD,
): void {
  const { wr, we, lighten } = helpers;
  const rv = seededRng(`tree${t.wx},${t.wy}`);
  const cx = t.wx + t.sz / 2;
  const cy = t.wy + t.sz / 2;
  const s = t.sz; // shorthand

  // --- Ground shadow (at trunk base) ---
  we(cx, t.wy + s * 0.85, s * 0.5, s * 0.12, "#0a1a08", 0.3);

  // --- Trunk with bark texture ---
  const trunkW = s * 0.14;
  const trunkH = s * 0.6;
  const trunkX = cx - trunkW / 2;
  const trunkY = cy + s * 0.15;

  // Main trunk
  wr(trunkX, trunkY, trunkW, trunkH, "#5a3012");
  // Lighter bark strip
  wr(trunkX + 1, trunkY, trunkW * 0.4, trunkH, "#7a4c28");
  // Dark bark lines
  wr(trunkX + trunkW * 0.7, trunkY + trunkH * 0.1, 1, trunkH * 0.3, "#3e2008");
  wr(trunkX + 1, trunkY + trunkH * 0.5, 1, trunkH * 0.25, "#3e2008");
  // Knot
  const knotY = trunkY + trunkH * (0.3 + rv() * 0.3);
  wr(trunkX + 1, knotY, 2, 2, "#3e2008");
  wr(trunkX + 2, knotY + 1, 1, 1, "#7a4c28");

  // --- Branches (visible in winter, partially in autumn) ---
  if (season === "winter" || season === "autumn") {
    const branchCol = "#5a3012";
    // Left branch
    wr(cx - s * 0.22, cy - s * 0.05, s * 0.15, 2, branchCol);
    wr(cx - s * 0.28, cy - s * 0.1, s * 0.08, 1.5, branchCol);
    // Right branch
    wr(cx + s * 0.08, cy - s * 0.08, s * 0.18, 2, branchCol);
    wr(cx + s * 0.2, cy - s * 0.14, s * 0.1, 1.5, branchCol);
    // Top branch
    wr(cx - 1, cy - s * 0.2, 2, s * 0.12, branchCol);
  }

  // --- Canopy palette ---
  const palette: Record<Season, [string, string, string, string]> = {
    spring: ["#2e8040", "#48b058", "#5cc868", "#78e088"],
    summer: ["#1e6018", "#287820", "#389030", "#48a838"],
    autumn: ["#8a3008", "#b85018", "#d87028", "#e89838"],
    winter: ["#586868", "#688080", "#90a8a8", "#b0c8c8"],
  };
  const [c1, c2, c3, c4] = palette[season];

  // --- Organic canopy from 5-6 overlapping blobs ---
  const canopyAlpha = season === "winter" ? 0.5 : 1;

  // Generate unique blob offsets per tree
  const blobs: [number, number, number, number][] = [
    // [offsetX, offsetY, radiusX, radiusY]
    [0, 0, s * 0.38, s * 0.32],
    [s * (rv() * 0.12 - 0.06), -s * 0.14, s * 0.32, s * 0.26],
    [-s * (0.12 + rv() * 0.1), -s * 0.04, s * 0.26, s * 0.22],
    [s * (0.1 + rv() * 0.1), -s * 0.06, s * 0.24, s * 0.2],
    [-s * (0.04 + rv() * 0.08), -s * 0.22, s * 0.2, s * 0.18],
    [s * (rv() * 0.14), -s * 0.18, s * 0.18, s * 0.16],
  ];

  // Base canopy layer (darkest)
  we(cx + blobs[0][0], cy + blobs[0][1], blobs[0][2], blobs[0][3], c1, canopyAlpha);
  // Mid layers
  we(cx + blobs[1][0], cy + blobs[1][1], blobs[1][2], blobs[1][3], c2, canopyAlpha);
  we(cx + blobs[2][0], cy + blobs[2][1], blobs[2][2], blobs[2][3], c2, canopyAlpha);
  we(cx + blobs[3][0], cy + blobs[3][1], blobs[3][2], blobs[3][3], c3, canopyAlpha);
  // Top highlight layers
  we(cx + blobs[4][0], cy + blobs[4][1], blobs[4][2], blobs[4][3], c3, canopyAlpha);
  we(cx + blobs[5][0], cy + blobs[5][1], blobs[5][2], blobs[5][3], c4, canopyAlpha * 0.9);

  // --- Leaf detail dots scattered on canopy ---
  if (season !== "winter") {
    const dotCount = 8 + Math.floor(rv() * 6);
    for (let i = 0; i < dotCount; i++) {
      const dx = (rv() - 0.5) * s * 0.6;
      const dy = (rv() - 0.5) * s * 0.5 - s * 0.08;
      // Only draw if roughly within canopy bounds
      if (dx * dx / (s * 0.35) ** 2 + dy * dy / (s * 0.3) ** 2 < 1) {
        const dotCol = rv() > 0.5 ? lighten(c3, 12) : lighten(c1, -8);
        wr(cx + dx, cy + dy, 1.5, 1, dotCol);
      }
    }
  }

  // --- Seasonal accents ---
  if (season === "spring") {
    // Cherry blossom clusters on canopy
    const blossomCount = 5 + Math.floor(rv() * 4);
    const blossomCols = ["#ffb0c8", "#ffc0d8", "#ff90b0", "#ffd0e0"];
    for (let i = 0; i < blossomCount; i++) {
      const bx = (rv() - 0.5) * s * 0.55;
      const by = (rv() - 0.5) * s * 0.4 - s * 0.1;
      if (bx * bx / (s * 0.32) ** 2 + by * by / (s * 0.28) ** 2 < 1) {
        const bc = blossomCols[Math.floor(rv() * blossomCols.length)];
        we(cx + bx, cy + by, s * 0.04, s * 0.035, bc, 0.85);
        // Tiny white centre
        wr(cx + bx - 0.5, cy + by - 0.5, 1, 1, "#fff8f0");
      }
    }
    // Falling petals below tree
    for (let i = 0; i < 3; i++) {
      const px = cx + (rv() - 0.5) * s * 0.7;
      const py = t.wy + s * 0.8 + rv() * s * 0.15;
      wr(px, py, 1.5, 1, "#ffb8d0");
    }
  }

  if (season === "summer") {
    // A couple of small fruits
    const fruitCount = Math.floor(rv() * 3);
    for (let i = 0; i < fruitCount; i++) {
      const fx = cx + (rv() - 0.5) * s * 0.35;
      const fy = cy + (rv() - 0.3) * s * 0.2;
      we(fx, fy, s * 0.03, s * 0.03, "#e03030", 0.9);
      wr(fx - 0.3, fy - s * 0.03, 0.8, s * 0.02, "#408020");
    }
  }

  if (season === "autumn") {
    // Scattered orange/red/yellow leaf clusters on canopy
    const leafCount = 6 + Math.floor(rv() * 5);
    const leafCols = ["#d86020", "#e8a030", "#c83818", "#e8c838"];
    for (let i = 0; i < leafCount; i++) {
      const lx = (rv() - 0.5) * s * 0.6;
      const ly = (rv() - 0.5) * s * 0.45 - s * 0.05;
      if (lx * lx / (s * 0.33) ** 2 + ly * ly / (s * 0.27) ** 2 < 1) {
        const lc = leafCols[Math.floor(rv() * leafCols.length)];
        wr(cx + lx, cy + ly, 2, 1.5, lc);
      }
    }
    // A few fallen leaves on ground
    for (let i = 0; i < 2; i++) {
      const gx = cx + (rv() - 0.5) * s * 0.8;
      const gy = t.wy + s * 0.88 + rv() * s * 0.08;
      wr(gx, gy, 2, 1, leafCols[Math.floor(rv() * leafCols.length)]);
    }
  }

  if (season === "winter") {
    // Snow caps on the thin canopy blobs
    we(cx, cy - s * 0.22, s * 0.22, s * 0.08, "#e8f0f8", 0.85);
    we(cx - s * 0.1, cy - s * 0.1, s * 0.16, s * 0.06, "#dce8f0", 0.75);
    we(cx + s * 0.08, cy - s * 0.05, s * 0.14, s * 0.05, "#e0ecf4", 0.7);
    // Snow on branches
    wr(cx - s * 0.24, cy - s * 0.07, s * 0.1, 1.5, "#e8f0f8");
    wr(cx + s * 0.12, cy - s * 0.1, s * 0.12, 1.5, "#e8f0f8");
  }

  // --- Night overlay ---
  if (tod === "night") {
    we(cx, cy - s * 0.06, s * 0.42, s * 0.38, "rgba(0,0,20,0.3)");
  }
}

// ---------------------------------------------------------------------------
// Flowers
// ---------------------------------------------------------------------------

export function drawFlower(
  helpers: DrawHelpers,
  f: { tx: number; ty: number; col: string },
  season: Season,
): void {
  const { wr, we, lighten } = helpers;
  const x = f.tx * TS;
  const y = f.ty * TS;
  const mid = x + TS / 2;

  // Winter: tiny snow mound instead of flower
  if (season === "winter") {
    we(mid, y + TS * 0.8, TS * 0.2, TS * 0.1, "#dce8f0", 0.7);
    wr(mid - 1, y + TS * 0.75, 2, 1, "#e8f4f8");
    return;
  }

  const cols = FLOWER_COLS[season];
  if (!cols.length) return;

  // Pick a variant (0-4) based on tile position for determinism
  const variant = ((f.tx * 7 + f.ty * 13) % 5 + 5) % 5;
  const col = cols[((f.tx * 11 + f.ty * 17) % cols.length + cols.length) % cols.length];

  // Seasonal colour shifts
  const stemCol = season === "autumn" ? "#5a6828" : "#388028";
  const stemDark = season === "autumn" ? "#485820" : "#2a6020";

  if (variant === 0) {
    // --- Tulip ---
    // Stem
    wr(mid - 0.5, y + TS * 0.5, 1.5, TS * 0.38, stemCol);
    // Small leaf on stem
    wr(mid + 1, y + TS * 0.6, 2.5, 1.5, stemCol);
    wr(mid + 1.5, y + TS * 0.58, 1.5, 1, stemDark);
    // Left petal (curved via two overlapping rects)
    wr(mid - 3.5, y + TS * 0.22, 3.5, 5, col);
    wr(mid - 3, y + TS * 0.18, 2.5, 3, col);
    // Right petal
    wr(mid, y + TS * 0.22, 3.5, 5, col);
    wr(mid + 0.5, y + TS * 0.18, 2.5, 3, col);
    // Centre highlight
    wr(mid - 0.5, y + TS * 0.25, 1, 4, lighten(col, 25));
  } else if (variant === 1) {
    // --- Daisy ---
    // Stem
    wr(mid - 0.5, y + TS * 0.55, 1.5, TS * 0.35, stemCol);
    // Leaf
    wr(mid - 3, y + TS * 0.65, 2.5, 1.5, stemCol);
    wr(mid - 2.5, y + TS * 0.63, 1.5, 1, stemDark);
    // White petals radiating (8 petals as small rects around centre)
    const petalCol = season === "autumn" ? "#e8d8a0" : "#f0f0f0";
    // Top
    wr(mid - 1, y + TS * 0.15, 2, 3, petalCol);
    // Bottom
    wr(mid - 1, y + TS * 0.38, 2, 3, petalCol);
    // Left
    wr(mid - 4.5, y + TS * 0.27, 3, 2, petalCol);
    // Right
    wr(mid + 1.5, y + TS * 0.27, 3, 2, petalCol);
    // Diagonals
    wr(mid - 3.5, y + TS * 0.17, 2.5, 2, petalCol);
    wr(mid + 1, y + TS * 0.17, 2.5, 2, petalCol);
    wr(mid - 3.5, y + TS * 0.36, 2.5, 2, petalCol);
    wr(mid + 1, y + TS * 0.36, 2.5, 2, petalCol);
    // Yellow centre
    we(mid, y + TS * 0.3, 2, 2, "#f0d020");
    wr(mid - 0.5, y + TS * 0.28, 1, 1, "#e0a010");
  } else if (variant === 2) {
    // --- Rose ---
    // Stem
    wr(mid - 0.5, y + TS * 0.52, 1.5, TS * 0.38, stemCol);
    // Leaf pair
    wr(mid + 1, y + TS * 0.6, 2, 1.5, stemCol);
    wr(mid - 3, y + TS * 0.65, 2, 1.5, stemCol);
    // Outer petal layer
    const roseOuter = season === "autumn" ? "#c83838" : col;
    we(mid, y + TS * 0.3, 4.5, 4, roseOuter);
    // Middle petal ring
    const roseMid = lighten(roseOuter, -15);
    we(mid, y + TS * 0.3, 3, 2.8, roseMid);
    // Inner swirl
    const roseInner = lighten(roseOuter, -30);
    we(mid, y + TS * 0.28, 1.5, 1.5, roseInner);
    // Highlight
    wr(mid - 0.5, y + TS * 0.22, 1, 1.5, lighten(roseOuter, 30));
  } else if (variant === 3) {
    // --- Sunflower ---
    // Thick stem
    wr(mid - 1, y + TS * 0.52, 2, TS * 0.4, stemCol);
    // Big leaf
    wr(mid + 1, y + TS * 0.6, 3, 2, stemCol);
    wr(mid + 2, y + TS * 0.58, 2, 1.5, stemDark);
    wr(mid - 4, y + TS * 0.65, 3, 2, stemCol);
    // Yellow petals (radiating rects)
    const sunCol = season === "autumn" ? "#d8a020" : "#f0c020";
    // Top/bottom
    wr(mid - 1.5, y + TS * 0.06, 3, 3.5, sunCol);
    wr(mid - 1.5, y + TS * 0.38, 3, 3.5, sunCol);
    // Left/right
    wr(mid - 5.5, y + TS * 0.2, 3.5, 3, sunCol);
    wr(mid + 2, y + TS * 0.2, 3.5, 3, sunCol);
    // Diagonals
    wr(mid - 4.5, y + TS * 0.1, 3, 2.5, sunCol);
    wr(mid + 1.5, y + TS * 0.1, 3, 2.5, sunCol);
    wr(mid - 4.5, y + TS * 0.34, 3, 2.5, sunCol);
    wr(mid + 1.5, y + TS * 0.34, 3, 2.5, sunCol);
    // Brown centre
    we(mid, y + TS * 0.27, 3, 3, "#6a4010");
    we(mid, y + TS * 0.27, 2, 2, "#8a5818");
    // Seed dots
    wr(mid - 1, y + TS * 0.24, 1, 1, "#4a2808");
    wr(mid + 0.5, y + TS * 0.28, 1, 1, "#4a2808");
    wr(mid - 0.5, y + TS * 0.31, 1, 1, "#4a2808");
  } else {
    // --- Wildflower cluster (3 small flowers) ---
    const offsets: [number, number][] = [
      [-3, TS * 0.25],
      [2.5, TS * 0.2],
      [0, TS * 0.32],
    ];
    const clusterCols = [col, lighten(col, 20), lighten(col, -15)];

    for (let i = 0; i < 3; i++) {
      const fx = mid + offsets[i][0];
      const fy = y + offsets[i][1];
      const fc = clusterCols[i];
      // Tiny stem
      wr(fx - 0.3, fy + 2, 1, TS * 0.2, stemCol);
      // Four tiny petals
      wr(fx - 1.5, fy, 1.5, 1.5, fc);
      wr(fx + 0.5, fy, 1.5, 1.5, fc);
      wr(fx - 0.5, fy - 1.5, 1.5, 1.5, fc);
      wr(fx - 0.5, fy + 1, 1.5, 1.5, fc);
      // Centre dot
      wr(fx - 0.3, fy - 0.3, 1, 1, "#f8e860");
    }
    // Small leaf at base
    wr(mid - 1.5, y + TS * 0.6, 2, 1.5, stemCol);
  }
}
