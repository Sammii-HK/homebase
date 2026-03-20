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
  const { wr } = helpers;
  const x = tx * TS,
    y = ty * TS,
    v = fv(tx, ty);
  wr(x, y, TS, TS, v < 0.25 ? "#c4a272" : v < 0.6 ? "#c8a878" : v < 0.85 ? "#ccae7e" : "#d0b484");
  wr(x, y, TS, 0.8, "#a88858");
  wr(x, y + 4, TS, 0.8, "#b09060");
  wr(x, y + 8, TS, 0.8, "#b09060");
  wr(x, y + 12, TS, 0.8, "#a88858");
  if (v > 0.9) wr(x + 3 + ((v * 6) % 7), y + 2 + ((v * 9) % 10), 2, 1, "#907040");
}

export function drawOfficeWall(helpers: DrawHelpers, tx: number, ty: number): void {
  const { wr } = helpers;
  const x = tx * TS,
    y = ty * TS;
  wr(x, y, TS, TS, "#9ab8aa");
  wr(x, y, TS, 1, "#b8d4c4");
  wr(x, y + TS - 1, TS, 1, "#708a7a");
  if (tx % 4 === 0) wr(x, y + 2, 1, TS - 4, "#7a9888");
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

  // Surface
  wr(x, y, dw, dh, "#5a3418");
  wr(x + 1, y + 1, dw - 2, dh - 2, "#6e4228");
  wr(x, y, dw, 1, "#8a5830");
  wr(x, y, 1, dh, "#7a4a20");
  wr(x + dw - 1, y, 1, dh, "#3a1e08");
  wr(x, y + dh - 1, dw, 1, "#3a1e08");
  wr(x + 2, y + 2, dw - 4, 1, "#7a4c28");

  // Desk mat (zone-coloured)
  const matCol = DESK_MAT_COLS[zone.id] ?? "#404040";
  wr(x + 2, y + 2, dw - 4, dh - 4, matCol);
  wr(x + 3, y + 3, dw - 6, dh - 6, matCol + "cc");

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
  const cx = zone.seatX - 7,
    cy = zone.seatY - 7,
    sz = 14;

  // Legs
  wr(cx - 1.5, cy - 1.5, 3, 3, "#1e0c04");
  wr(cx + sz - 1.5, cy - 1.5, 3, 3, "#1e0c04");
  wr(cx - 1.5, cy + sz - 1.5, 3, 3, "#1e0c04");
  wr(cx + sz - 1.5, cy + sz - 1.5, 3, 3, "#1e0c04");

  // Seat
  wr(cx, cy + 2, sz, sz - 2, "#3a2010");
  wr(cx + 1, cy + 3, sz - 2, sz - 5, "#5a3828");
  wr(cx + 2, cy + 4, sz - 4, sz - 8, "#6a4838");
  wr(cx + 2, cy + sz / 2, sz - 4, 1, "#4a2c18");

  // Armrests
  wr(cx - 1, cy + 3, 2, sz - 6, "#2e1608");
  wr(cx + sz - 1, cy + 3, 2, sz - 6, "#2e1608");
  wr(cx - 2, cy + 3, 2, 3, "#402010");
  wr(cx + sz, cy + 3, 2, 3, "#402010");

  // Back rest
  const brAtTop = zone.facing === "up";
  const bry = brAtTop ? cy : cy + sz - 3;
  wr(cx, bry, sz, 4, "#2e1608");
  wr(cx + 1, bry + 1, sz - 2, 1, "#4a2818");
  wr(cx + 1, bry + 2, sz - 2, 1, "#3a2010");
}

// ---------------------------------------------------------------------------
// Furniture pieces
// ---------------------------------------------------------------------------

export function drawRug(helpers: DrawHelpers, f: FurniturePiece): void {
  const { wr } = helpers;
  const x = f.tx * TS,
    y = f.ty * TS,
    w = (f.tw ?? 4) * TS,
    h = (f.th ?? 3) * TS;
  const c1 = f.c1 ?? "#7848a0",
    c2 = f.c2 ?? "#9060c0";
  wr(x, y, w, h, c1);
  wr(x + 2, y + 2, w - 4, h - 4, c2);
  wr(x + 4, y + 4, w - 8, h - 8, c1);
  wr(x + 6, y + 6, w - 12, h - 12, c2);
  wr(x + w / 2 - 3, y + h / 2 - 3, 6, 6, c1);
  wr(x + w / 2 - 1.5, y + h / 2 - 1.5, 3, 3, "#ffffffcc");
}

export function drawSofa(helpers: DrawHelpers, f: FurniturePiece): void {
  const { wr } = helpers;
  const x = f.tx * TS,
    y = f.ty * TS,
    sw = (f.tw ?? 3) * TS,
    sh = (f.th ?? 2) * TS;
  wr(x, y, sw, sh, "#6858a8");
  wr(x + 2, y + 2, sw - 4, sh - 4, "#7868b8");
  const cw = Math.floor((sw - 4) / 3);
  for (let i = 0; i < 3; i++) {
    wr(x + 2 + i * (cw + 1), y + 2, cw, sh - 6, "#8878c8");
    wr(x + 3 + i * (cw + 1), y + 3, cw - 2, 1, "#a0a0d8");
  }
  wr(x, y, 3, sh, "#4848a0");
  wr(x + sw - 3, y, 3, sh, "#4848a0");
  wr(x, y, sw, 3, "#3838a0");
  wr(x + 1, y + 1, sw - 2, 1, "#6868c0");
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
  const { wr } = helpers;
  const x = tx * TS,
    y = ty * TS;
  wr(x, y, 2 * TS, TS, "#5a3010");
  wr(x, y, 2 * TS, 2, "#7a4820");
  wr(x + 2 * TS - 2, y, 2, TS, "#3a1a08");
  const bc = [
    "#e04040",
    "#4070e0",
    "#40a040",
    "#e0c030",
    "#e05890",
    "#6040c0",
    "#40b0d0",
    "#e07030",
    "#a030a0",
    "#30a0a0",
  ];
  for (let i = 0; i < 10; i++) wr(x + 1 + i * 3, y + 2, 2.5, TS - 4 - (i % 3), bc[i]);
}

export function drawLamp(helpers: DrawHelpers, tx: number, ty: number, tod: TOD): void {
  const { wr, we } = helpers;
  const x = tx * TS + 5,
    y = ty * TS;
  wr(x, y + 8, 6, 2, "#c0a060");
  wr(x + 2, y + 1, 2, 8, "#8a6028");
  wr(x - 2, y, 10, 4, "#c8a848");
  const on = tod !== "morning" && tod !== "afternoon";
  if (on) {
    we(x + 3, y + 2, 14, 10, "#ffe080", 0.1);
    wr(x, y, 6, 3, "#fff0a0");
  } else {
    wr(x, y, 6, 3, "#e8e0a0");
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
  const { wr } = helpers;
  const x = b.tx * TS,
    y = b.ty * TS;
  wr(x, y + 4, 3 * TS, 3, "#7a5028");
  wr(x, y + 2, 2, TS, "#6a4018");
  wr(x + 3 * TS - 2, y + 2, 2, TS, "#6a4018");
  wr(x, y + 4, 3 * TS, 1.5, "#9a6830");
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

  // Bank
  we(cx, cy, w / 2 + 3, h / 2 + 3, "#388030", 0.7);

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

  // Animated ripples — shift position with animTick
  const rOff = (animTick * 0.3) % 6;
  wr(cx - 10 + rOff, cy - 2, 18 - rOff, 0.8, lighten(wl, 30));
  wr(cx - 6 - rOff * 0.5, cy + 4, 10 + rOff, 0.8, lighten(wl, 25));

  // Lily pads — slightly bob
  const bob = Math.sin(animTick * 0.15) * 0.5;
  we(x + w * 0.28, y + h * 0.65 + bob, 4, 3, "#388030");
  we(x + w * 0.72, y + h * 0.35 - bob, 3, 2, "#309020");
  we(x + w * 0.5, y + h * 0.8 + bob * 0.5, 3, 2, "#3a8828");

  // Lily flower on first pad (blooms when healthy)
  if (healthyMix > 0.6) {
    we(x + w * 0.28 + 1, y + h * 0.65 + bob - 1, 1.5, 1.2, "#f0a0c0", healthyMix * 0.7);
  }
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
  const rv = seededRng(`${t.wx}${t.wy}`);
  const cx = t.wx + t.sz / 2,
    cy = t.wy + t.sz / 2;

  // Trunk
  wr(cx - 2, cy + t.sz * 0.3, 4, t.sz * 0.7, "#6a3e18");
  wr(cx - 1, cy + t.sz * 0.2, 2, t.sz * 0.5, "#8a5028");

  // Canopy colours per season
  const can: Record<Season, [string, string, string]> = {
    spring: ["#389048", "#48b058", "#68d878"],
    summer: ["#287020", "#389030", "#48b040"],
    autumn: ["#9a4010", "#c05820", "#e07830"],
    winter: ["#486060", "#587878", "#c8d8d8"],
  };
  const [c1, c2, c3] = can[season];

  // Canopy layers
  we(cx, cy, t.sz * 0.52, t.sz * 0.48, c1);
  we(cx, cy - t.sz * 0.08, t.sz * 0.46, t.sz * 0.42, c2);
  we(cx - rv() * t.sz * 0.15, cy - t.sz * 0.18, t.sz * 0.3, t.sz * 0.28, c3);
  we(cx + rv() * t.sz * 0.1, cy - t.sz * 0.12, t.sz * 0.22, t.sz * 0.2, lighten(c3, 15));

  // Seasonal accents
  if (season === "winter") {
    we(cx, cy - t.sz * 0.05, t.sz * 0.35, t.sz * 0.15, "#d8e8f0", 0.8);
  }
  if (season === "spring") {
    we(
      cx + rv() * t.sz * 0.2 - t.sz * 0.1,
      cy - t.sz * 0.28,
      t.sz * 0.15,
      t.sz * 0.12,
      "#ffb8d0",
      0.6,
    );
  }

  // Night shadow
  if (tod === "night") we(cx, cy - t.sz * 0.1, t.sz * 0.55, t.sz * 0.52, "rgba(0,0,10,0.3)");
}

// ---------------------------------------------------------------------------
// Flowers
// ---------------------------------------------------------------------------

export function drawFlower(
  helpers: DrawHelpers,
  f: { tx: number; ty: number; col: string },
  season: Season,
): void {
  if (season === "winter") return;
  const { wr } = helpers;
  const cols = FLOWER_COLS[season];
  if (!cols.length) return;
  const col = cols[((f.tx * 7 + f.ty * 13) % cols.length + cols.length) % cols.length];
  const x = f.tx * TS,
    y = f.ty * TS;
  // Stem
  wr(x + TS / 2 - 1, y + TS * 0.5, 2, TS * 0.4, "#408030");
  // Petals
  wr(x + TS / 2 - 4, y + TS * 0.25, 8, 5, col);
  wr(x + TS / 2 - 2, y + TS * 0.18, 4, 7, col);
  // Centre
  wr(x + TS / 2 - 1, y + TS * 0.28, 2, 3, "#fff0a0");
}
