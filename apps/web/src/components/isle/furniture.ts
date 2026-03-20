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
  RIVER_START_ROW,
  fv,
  seededRng,
  FLOWER_COLS,
} from "./world";

// ---------------------------------------------------------------------------
// Sprite image loader (PNG furniture from pixel-agents, CC0)
// ---------------------------------------------------------------------------

const _spriteCache: Record<string, HTMLImageElement> = {};
function loadSprite(path: string): HTMLImageElement {
  if (_spriteCache[path]) return _spriteCache[path];
  const img = new Image();
  img.src = path;
  _spriteCache[path] = img;
  return img;
}

// Pre-load all furniture sprites
const SPR = {
  deskFront: loadSprite("/sprites/furniture/DESK/DESK_FRONT.png"),
  chairFront: loadSprite("/sprites/furniture/CUSHIONED_CHAIR/CUSHIONED_CHAIR_FRONT.png"),
  chairBack: loadSprite("/sprites/furniture/CUSHIONED_CHAIR/CUSHIONED_CHAIR_BACK.png"),
  chairSide: loadSprite("/sprites/furniture/CUSHIONED_CHAIR/CUSHIONED_CHAIR_SIDE.png"),
  sofaFront: loadSprite("/sprites/furniture/SOFA/SOFA_FRONT.png"),
  sofaBack: loadSprite("/sprites/furniture/SOFA/SOFA_BACK.png"),
  sofaSide: loadSprite("/sprites/furniture/SOFA/SOFA_SIDE.png"),
  coffeeTable: loadSprite("/sprites/furniture/COFFEE_TABLE/COFFEE_TABLE.png"),
  whiteboard: loadSprite("/sprites/furniture/WHITEBOARD/WHITEBOARD.png"),
  bookshelf: loadSprite("/sprites/furniture/BOOKSHELF/BOOKSHELF.png"),
  doubleBookshelf: loadSprite("/sprites/furniture/DOUBLE_BOOKSHELF/DOUBLE_BOOKSHELF.png"),
  plant: loadSprite("/sprites/furniture/PLANT/PLANT.png"),
  plant2: loadSprite("/sprites/furniture/PLANT_2/PLANT_2.png"),
  largePlant: loadSprite("/sprites/furniture/LARGE_PLANT/LARGE_PLANT.png"),
  cactus: loadSprite("/sprites/furniture/CACTUS/CACTUS.png"),
  hangingPlant: loadSprite("/sprites/furniture/HANGING_PLANT/HANGING_PLANT.png"),
  bin: loadSprite("/sprites/furniture/BIN/BIN.png"),
  pcOn1: loadSprite("/sprites/furniture/PC/PC_FRONT_ON_1.png"),
  pcOn2: loadSprite("/sprites/furniture/PC/PC_FRONT_ON_2.png"),
  pcOn3: loadSprite("/sprites/furniture/PC/PC_FRONT_ON_3.png"),
  pcOff: loadSprite("/sprites/furniture/PC/PC_FRONT_OFF.png"),
  pcBack: loadSprite("/sprites/furniture/PC/PC_BACK.png"),
  smallPainting: loadSprite("/sprites/furniture/SMALL_PAINTING/SMALL_PAINTING.png"),
  smallPainting2: loadSprite("/sprites/furniture/SMALL_PAINTING_2/SMALL_PAINTING_2.png"),
  largePainting: loadSprite("/sprites/furniture/LARGE_PAINTING/LARGE_PAINTING.png"),
  woodenChairBack: loadSprite("/sprites/furniture/WOODEN_CHAIR/WOODEN_CHAIR_BACK.png"),
  woodenBench: loadSprite("/sprites/furniture/WOODEN_BENCH/WOODEN_BENCH.png"),
  // Cozy pack outdoor sprites (CC0, IshtarPixels)
  treeYellow: loadSprite("/sprites/cozy_pack/tiles/Slice 116.png"),   // 32x32 round yellow tree
  treeOrange: loadSprite("/sprites/cozy_pack/tiles/Slice 117.png"),   // 32x32 round orange tree
  treePink: loadSprite("/sprites/cozy_pack/tiles/Slice 118.png"),     // 32x32 pointed orange tree
  treeGreen: loadSprite("/sprites/cozy_pack/tiles/Slice 119.png"),    // 32x32 green conifer
  treeDead: loadSprite("/sprites/cozy_pack/tiles/Slice 114.png"),     // 32x32 bare branches
  rockBrown: loadSprite("/sprites/cozy_pack/tiles/Slice 121.png"),    // 16x16 brown rock
  rockGrey: loadSprite("/sprites/cozy_pack/tiles/Slice 122.png"),     // 16x16 grey rock
  rocksCluster: loadSprite("/sprites/cozy_pack/tiles/Slice 123.png"), // 16x16 rocks cluster
  bush1: loadSprite("/sprites/cozy_pack/tiles/Slice 126.png"),        // 16x16 green bush
  bush2: loadSprite("/sprites/cozy_pack/tiles/Slice 127.png"),        // 16x16 green bush variant
  signpost: loadSprite("/sprites/cozy_pack/tiles/Slice 112.png"),     // 16x16 signpost
  signpost2: loadSprite("/sprites/cozy_pack/tiles/Slice 113.png"),    // 16x16 signpost variant
  // Cozy pack grass tiles (with flower/tuft detail baked in)
  grass1: loadSprite("/sprites/cozy_pack/tiles/Slice 35.png"),       // 16x16 plain grass
  grass2: loadSprite("/sprites/cozy_pack/tiles/Slice 40.png"),       // 16x16 grass variant
  grassFlower1: loadSprite("/sprites/cozy_pack/tiles/Slice 60.png"), // 16x16 grass + detail
  grassFlower2: loadSprite("/sprites/cozy_pack/tiles/Slice 61.png"), // 16x16 grass + flowers
  grassFlower3: loadSprite("/sprites/cozy_pack/tiles/Slice 62.png"), // 16x16 grass + detail
  grassFlower4: loadSprite("/sprites/cozy_pack/tiles/Slice 63.png"), // 16x16 grass + flowers
  grassFlower5: loadSprite("/sprites/cozy_pack/tiles/Slice 64.png"), // 16x16 grass + red flowers
  grassFlower6: loadSprite("/sprites/cozy_pack/tiles/Slice 65.png"), // 16x16 grass + red detail
};

/** Draw a sprite image at world coordinates with zoom/pan */
function drawSpriteAt(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  wx: number, wy: number,
  zoom: number, panX: number, panY: number,
  flipH = false,
) {
  if (!img.complete || !img.naturalWidth) return;
  const dw = img.naturalWidth * zoom;
  const dh = img.naturalHeight * zoom;
  const dx = Math.round(panX + wx * zoom);
  const dy = Math.round(panY + wy * zoom);
  if (flipH) {
    ctx.save();
    ctx.translate(dx + dw, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, Math.round(dw), Math.round(dh));
    ctx.restore();
  } else {
    ctx.drawImage(img, dx, dy, Math.round(dw), Math.round(dh));
  }
}

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

  function spr(img: HTMLImageElement, wx: number, wy: number, flipH = false) {
    drawSpriteAt(ctx, img, wx, wy, zoom, panX, panY, flipH);
  }

  return { wr, we, lighten, spr, ctx, zoom, panX, panY };
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
  const { wr, we, spr } = helpers;
  const x = zone.deskX;
  const y = zone.deskY;
  const dw = 3 * TS;

  // PNG desk sprite (48x32) — tabletop surface aligns with deskY
  spr(SPR.deskFront, x, y - 16);

  // PC on desk — sprite (16x32), placed on the desk surface
  const pcX = x + dw / 2 - 8;
  const pcY = y - 24; // sits on top of desk
  if (zone.facing === "up") {
    // Player sees the front of the monitor
    spr(SPR.pcOff, pcX, pcY);
    // Overlay data-reactive screen content on the PC monitor
    // PC screen area is roughly 10x7 pixels, starting at pcX+3, pcY+4
    const mx = pcX + 3;
    const my = pcY + 3;
    if (isActive) {
      // Working — code lines in zone accent colour
      wr(mx, my, 10, 7, "#081a10");
      const g = zone.monitorGlow;
      const offset = animTick % 4;
      const lines = [
        { w: 4, x: 0 }, { w: 7, x: 0 }, { w: 3, x: 1 },
        { w: 6, x: 0 }, { w: 5, x: 0 },
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
      drawMonitorData(wr, we, mx, my, zone, stats, animTick);
    }
  } else {
    // Player sees the back of the monitor
    spr(SPR.pcBack, pcX, pcY);
  }

  // Zone-specific desk decorations
  const mx = x + dw / 2 - 5;
  const my = y + 1;
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
  const { spr } = helpers;
  // Chair sprite is 16x16 — centre on seat position
  const cx = zone.seatX - 8;
  const cy = zone.seatY - 8;
  const img = zone.facing === "up" ? SPR.chairBack : SPR.chairFront;
  spr(img, cx, cy);
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
  const { spr } = helpers;
  const x = f.tx * TS;
  const y = f.ty * TS;
  // Sofa sprite is 32x16 — draw it scaled to fill the furniture area
  // Draw two sofa sprites side by side for the 3-tile width, or stretch one
  const sw = (f.tw ?? 3) * TS;
  const sh = (f.th ?? 2) * TS;
  // Centre the sofa sprite in the furniture area
  const sx = x + (sw - 32) / 2;
  const sy = y + (sh - 16) / 2;
  spr(SPR.sofaFront, sx, sy);
  // Draw a second one next to it for wider sofas
  if (sw > 40) {
    spr(SPR.sofaFront, sx + 32, sy);
  }
}

export function drawCoffeeTable(helpers: DrawHelpers, f: FurniturePiece): void {
  const { spr } = helpers;
  // COFFEE_TABLE.png is 32x32 — draw at tile position
  spr(SPR.coffeeTable, f.tx * TS, f.ty * TS);
}

export function drawWhiteboard(helpers: DrawHelpers, f: FurniturePiece): void {
  const { spr } = helpers;
  // WHITEBOARD.png is 32x32 — centre in the 3-tile space
  const x = f.tx * TS;
  const y = f.ty * TS;
  spr(SPR.whiteboard, x + 8, y - 8);
}

export function drawWaterCooler(helpers: DrawHelpers, f: FurniturePiece): void {
  const { spr } = helpers;
  // Use the cactus sprite as a water cooler stand-in (similar tall shape)
  // Or just use plant_2 for now
  spr(SPR.plant2, f.tx * TS, f.ty * TS - 16);
}

export function drawFilingCabinet(helpers: DrawHelpers, f: FurniturePiece): void {
  const { spr } = helpers;
  // Use double bookshelf sprite (32x32) — fits 1x2 tile filing cabinet
  spr(SPR.doubleBookshelf, f.tx * TS - 8, f.ty * TS);
}

export function drawBookshelf(helpers: DrawHelpers, tx: number, ty: number): void {
  const { spr } = helpers;
  // DOUBLE_BOOKSHELF.png is 32x32 — sits on the wall (2 tiles wide)
  spr(SPR.doubleBookshelf, tx * TS, ty * TS);
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
  const { spr } = helpers;
  const x = f.tx * TS;
  const y = f.ty * TS;
  const t = (f.variant ?? 0) % 4;
  // Plant sprites are 16x32 or 32x48 — draw anchored at bottom of tile
  const plants = [SPR.plant, SPR.plant2, SPR.cactus, SPR.largePlant];
  const img = plants[t];
  if (t === 3) {
    // Large plant is 32x48 — offset up and left
    spr(img, x - 8, y - 32);
  } else {
    // Small plants are 16x32 — offset up
    spr(img, x, y - 16);
  }
}

// ---------------------------------------------------------------------------
// Outdoor furniture
// ---------------------------------------------------------------------------

export function drawBench(helpers: DrawHelpers, b: { tx: number; ty: number }): void {
  const { spr } = helpers;
  // Draw 3 wooden bench sprites side by side (each is 16x16)
  spr(SPR.woodenBench, b.tx * TS, b.ty * TS);
  spr(SPR.woodenBench, (b.tx + 1) * TS, b.ty * TS);
  spr(SPR.woodenBench, (b.tx + 2) * TS, b.ty * TS);
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

// Tree sprite variants per season — picks from cozy pack sprites
const TREE_SPRITES_BY_SEASON: Record<Season, (() => HTMLImageElement)[]> = {
  spring: [() => SPR.treeGreen, () => SPR.treeYellow, () => SPR.treePink],
  summer: [() => SPR.treeGreen, () => SPR.treeYellow, () => SPR.treeGreen],
  autumn: [() => SPR.treeOrange, () => SPR.treePink, () => SPR.treeYellow],
  winter: [() => SPR.treeDead, () => SPR.treeGreen, () => SPR.treeDead],
};

export function drawTree(
  helpers: DrawHelpers,
  t: { wx: number; wy: number; sz: number },
  season: Season,
  tod: TOD,
): void {
  const { we, wr, spr } = helpers;
  const rv = seededRng(`tree${t.wx},${t.wy}`);
  const variant = Math.floor(rv() * 3);

  // Pick sprite based on season + deterministic variant
  const sprites = TREE_SPRITES_BY_SEASON[season];
  const treeImg = sprites[variant % sprites.length]();

  // Ground shadow
  const cx = t.wx + t.sz / 2;
  we(cx, t.wy + t.sz * 0.9, t.sz * 0.5, t.sz * 0.12, "#0a1a08", 0.25);

  // Draw the sprite — trees are 32x32, anchor at bottom-centre
  // Scale based on tree size (sz ranges from ~9-23)
  const scale = t.sz / 20; // normalise to roughly 1x
  const drawW = 32 * scale;
  const drawH = 32 * scale;
  const drawX = t.wx + t.sz / 2 - drawW / 2;
  const drawY = t.wy + t.sz - drawH;

  if (treeImg.complete && treeImg.naturalWidth) {
    const { ctx, zoom, panX, panY } = helpers;
    const dx = Math.round(panX + drawX * zoom);
    const dy = Math.round(panY + drawY * zoom);
    const dw = Math.round(drawW * zoom);
    const dh = Math.round(drawH * zoom);

    // Winter trees get lower opacity
    if (season === "winter" && variant !== 1) {
      ctx.globalAlpha = 0.7;
    }
    ctx.drawImage(treeImg, dx, dy, dw, dh);
    ctx.globalAlpha = 1;

    // Snow caps in winter
    if (season === "winter") {
      we(cx, t.wy + t.sz * 0.3, t.sz * 0.3, t.sz * 0.08, "#e8f0f8", 0.8);
      we(cx - t.sz * 0.1, t.wy + t.sz * 0.4, t.sz * 0.2, t.sz * 0.06, "#dce8f0", 0.65);
    }
  }

  // Night overlay
  if (tod === "night") {
    we(cx, t.wy + t.sz * 0.4, t.sz * 0.4, t.sz * 0.35, "rgba(0,0,20,0.25)");
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

// ---------------------------------------------------------------------------
// Garden rocks (cozy pack sprites)
// ---------------------------------------------------------------------------

const ROCK_SPRITES = [
  () => SPR.rockBrown,
  () => SPR.rockGrey,
  () => SPR.rocksCluster,
  () => SPR.rockBrown,
];

export function drawRock(helpers: DrawHelpers, r: { tx: number; ty: number; variant: number }): void {
  const { spr } = helpers;
  const img = ROCK_SPRITES[r.variant % ROCK_SPRITES.length]();
  spr(img, r.tx * TS, r.ty * TS);
}

// ---------------------------------------------------------------------------
// Garden bushes (cozy pack sprites)
// ---------------------------------------------------------------------------

export function drawBush(helpers: DrawHelpers, b: { tx: number; ty: number; variant: number }): void {
  const { spr } = helpers;
  const img = b.variant === 0 ? SPR.bush1 : SPR.bush2;
  spr(img, b.tx * TS, b.ty * TS);
}

// ---------------------------------------------------------------------------
// Signpost (cozy pack sprite)
// ---------------------------------------------------------------------------

export function drawSignpost(helpers: DrawHelpers, s: { tx: number; ty: number }): void {
  const { spr } = helpers;
  spr(SPR.signpost, s.tx * TS, s.ty * TS);
}

// ---------------------------------------------------------------------------
// Stepping stone path — from office door through the garden
// ---------------------------------------------------------------------------

const PATH_STONES: { x: number; y: number; w: number; h: number }[] = (() => {
  const rng = seededRng("path-stones-v2");
  const stones: { x: number; y: number; w: number; h: number }[] = [];
  // Path starts at the door (col 12, rows 5-7) and winds to the garden
  const waypoints: [number, number][] = [
    [12.5, 6], [13.5, 6], [14.5, 6.3], [15.5, 6.5],
    [16.5, 7], [17.5, 7.2], [18.5, 7], [19.5, 6.5],
    [20.5, 6], [21.5, 5.5], [22.5, 5.5], [23.5, 6],
    [24.5, 6.5], [25.5, 7],
  ];
  for (const [wx, wy] of waypoints) {
    const ox = (rng() - 0.5) * 2;
    const oy = (rng() - 0.5) * 1.5;
    stones.push({
      x: wx * TS + ox,
      y: wy * TS + oy,
      w: 4 + rng() * 3,
      h: 3 + rng() * 2,
    });
  }
  return stones;
})();

export function drawPath(helpers: DrawHelpers): void {
  const { wr, we, lighten } = helpers;
  for (const s of PATH_STONES) {
    // Stone shadow
    we(s.x + 0.5, s.y + s.h * 0.4, s.w * 0.5, s.h * 0.35, "#2a3a1a", 0.2);
    // Main stone
    we(s.x, s.y, s.w * 0.5, s.h * 0.4, "#989088");
    // Highlight top
    we(s.x - 0.3, s.y - s.h * 0.1, s.w * 0.4, s.h * 0.2, "#a8a098");
    // Dark crack detail
    wr(s.x - s.w * 0.15, s.y - 0.2, s.w * 0.2, 0.4, "#706860");
  }
}

// ---------------------------------------------------------------------------
// Garden lanterns — warm glow at night, subtle posts during day
// ---------------------------------------------------------------------------

const LANTERN_SPOTS: [number, number][] = [
  [13, 3], [13, 9], [20, 2], [20, 10], [26, 5], [26, 9],
];

export function drawLantern(helpers: DrawHelpers, lx: number, ly: number, tod: TOD): void {
  const { wr, we } = helpers;
  const x = lx * TS + TS / 2;
  const y = ly * TS;

  // Post
  wr(x - 0.5, y + 4, 1.5, TS - 4, "#5a4030");
  wr(x, y + 4, 0.8, TS - 4, "#7a5840"); // highlight strip

  // Lantern housing
  wr(x - 2, y + 1, 5, 4, "#5a4030");
  wr(x - 1.5, y + 1.5, 4, 3, "#4a3020");

  // Light glow based on time of day
  if (tod === "night" || tod === "dusk") {
    // Warm inner light
    wr(x - 1, y + 2, 3, 2, "#f0c060");
    wr(x - 0.5, y + 2.2, 2, 1.5, "#f8d878");
    // Glow radius
    we(x + 0.5, y + 6, 12, 10, "rgba(255,200,80,0.06)");
    we(x + 0.5, y + 4, 6, 5, "rgba(255,220,100,0.08)");
    // Ground light pool
    we(x + 0.5, y + TS, 10, 4, "rgba(255,200,80,0.04)");
  } else {
    // Daytime — just the glass panels
    wr(x - 1, y + 2, 3, 2, "#c8b898");
  }

  // Cap
  wr(x - 2.5, y, 6, 1.5, "#5a4030");
  wr(x - 1, y - 0.5, 3, 1, "#6a5040");
}

// Exports for the lantern spots
export { LANTERN_SPOTS };

// ---------------------------------------------------------------------------
// Window light rays — beams of light cast onto office floor
// ---------------------------------------------------------------------------

export function drawWindowLight(
  helpers: DrawHelpers,
  tx: number,
  ty: number,
  tod: TOD,
): void {
  const { ctx, zoom, panX, panY } = helpers;
  // Only in morning/afternoon when sun is out
  if (tod === "night" || tod === "dusk") return;

  const x = tx * TS;
  const y = ty * TS;

  // Light beam trapezoid from window down onto floor
  const beamTop = y + TS + 2;
  const beamBot = y + TS * 5;
  const beamW = TS * 2;

  // Morning light angles right, afternoon angles left
  const offset = tod === "morning" ? TS * 1.5 : tod === "dawn" ? TS * 2 : -TS * 0.5;

  ctx.save();
  ctx.globalAlpha = tod === "dawn" ? 0.04 : 0.03;
  ctx.fillStyle = "#ffe8a0";
  ctx.beginPath();
  ctx.moveTo(panX + (x + 1) * zoom, panY + beamTop * zoom);
  ctx.lineTo(panX + (x + beamW - 1) * zoom, panY + beamTop * zoom);
  ctx.lineTo(panX + (x + beamW + offset + 4) * zoom, panY + beamBot * zoom);
  ctx.lineTo(panX + (x + offset - 4) * zoom, panY + beamBot * zoom);
  ctx.closePath();
  ctx.fill();

  // Dust motes in the light beam (static, decorative)
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = "#fff8d0";
  const rng = seededRng(`wlight${tx}`);
  for (let i = 0; i < 6; i++) {
    const mx = x + rng() * beamW + offset * rng();
    const my = beamTop + rng() * (beamBot - beamTop) * 0.8;
    ctx.fillRect(
      Math.round(panX + mx * zoom),
      Math.round(panY + my * zoom),
      Math.max(1, Math.round(zoom)),
      Math.max(1, Math.round(zoom)),
    );
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Enhanced grass details — tufts, wild herbs, small mushrooms
// ---------------------------------------------------------------------------

export function drawGrassDetail(
  helpers: DrawHelpers,
  tx: number,
  ty: number,
  season: Season,
): void {
  const { wr, we } = helpers;
  const x = tx * TS;
  const y = ty * TS;
  const v = fv(tx, ty);
  const v2 = ((v * 1000) | 0) % 100;

  if (season === "winter") return; // snow covers detail

  // Grass tufts (2-3 blades) — ~30% of outdoor tiles
  if (v2 < 30 && tx >= OFFICE_COLS + 1) {
    const gc = season === "autumn" ? "#8a7828" : season === "summer" ? "#2a7818" : "#389830";
    const gx = x + ((v * 11) % 12);
    const gy = y + TS - 1;
    // Three blades at slightly different angles
    wr(gx, gy - 4, 0.6, 4, gc);
    wr(gx + 1.5, gy - 3.5, 0.6, 3.5, gc);
    wr(gx - 1, gy - 3, 0.6, 3, gc);
  }

  // Tiny mushrooms — rare, ~5% of outdoor tiles
  if (v2 >= 85 && v2 < 90 && tx >= OFFICE_COLS + 1) {
    const mx = x + ((v * 8) % 11);
    const my = y + TS - 2;
    // Stem
    wr(mx, my, 1, 2, "#e0d8c0");
    // Cap
    we(mx + 0.5, my - 0.5, 2, 1.2, season === "autumn" ? "#c04020" : "#d8a060");
    // White spots on cap
    wr(mx - 0.5, my - 1, 0.6, 0.6, "#f0e8d0");
    wr(mx + 1, my - 0.8, 0.5, 0.5, "#f0e8d0");
  }

  // Small pebbles — ~10% of tiles
  if (v2 >= 60 && v2 < 70 && tx >= OFFICE_COLS + 1) {
    const px = x + ((v * 13) % 13);
    const py = y + ((v * 9) % 12);
    wr(px, py, 1.5, 1, "#888078");
    wr(px + 3, py + 2, 1, 0.8, "#908880");
  }
}

// ---------------------------------------------------------------------------
// River / stream at the bottom of the world
// ---------------------------------------------------------------------------

// Water lily positions (seeded, in river area)
const WATER_LILIES: { x: number; y: number; sz: number; hasFlower: boolean }[] = (() => {
  const rng = seededRng("water-lilies-v2");
  const lilies: { x: number; y: number; sz: number; hasFlower: boolean }[] = [];
  for (let i = 0; i < 8; i++) {
    lilies.push({
      x: rng() * WORLD_COLS * TS,
      y: (RIVER_START_ROW + 1 + rng() * 3) * TS, // middle of river
      sz: 3 + rng() * 3,
      hasFlower: rng() > 0.4,
    });
  }
  return lilies;
})();

// Fish shadow paths (seeded)
const FISH_SHADOWS: { startX: number; y: number; speed: number; length: number; phase: number }[] = (() => {
  const rng = seededRng("fish-shadows-v1");
  const fish: { startX: number; y: number; speed: number; length: number; phase: number }[] = [];
  for (let i = 0; i < 6; i++) {
    fish.push({
      startX: rng() * WORLD_COLS * TS,
      y: (RIVER_START_ROW + 1.5 + rng() * 2.5) * TS,
      speed: 8 + rng() * 12,
      length: 3 + rng() * 4,
      phase: rng() * Math.PI * 2,
    });
  }
  return fish;
})();

export function drawRiver(
  helpers: DrawHelpers,
  tod: TOD,
  animTick: number,
): void {
  const { wr, we } = helpers;
  const riverY = RIVER_START_ROW * TS;
  const riverH = (WORLD_ROWS - RIVER_START_ROW) * TS;
  const worldW = WORLD_COLS * TS;
  const time = Date.now() / 1000;

  // Riverbank — earthy strip along the top edge
  wr(0, riverY - 2, worldW, 5, "#6a5838");
  wr(0, riverY, worldW, 3, "#7a6848");
  // Bank grass edge
  for (let tx = 0; tx < WORLD_COLS; tx++) {
    const v = fv(tx, RIVER_START_ROW);
    const gx = tx * TS;
    if (v > 0.25) {
      wr(gx + ((v * 7) % 12), riverY - 3, 2, 4, "#4a8038");
      wr(gx + ((v * 11) % 14), riverY - 2, 1.5, 3, "#58a044");
    }
    if (v > 0.6) {
      wr(gx + ((v * 3) % 8), riverY - 1, 1, 2, "#3a7028");
    }
    if (v > 0.8) {
      wr(gx + ((v * 5) % 10), riverY, 2.5, 2, "#808078");
      wr(gx + ((v * 5) % 10) + 0.3, riverY + 0.2, 1.5, 1, "#909088");
    }
  }

  // Water body
  let waterBase: string, waterLight: string, waterDark: string;
  if (tod === "night") {
    waterBase = "#0a1830"; waterLight = "#101e3a"; waterDark = "#060e20";
  } else if (tod === "dusk" || tod === "dawn") {
    waterBase = "#2a3878"; waterLight = "#3a4888"; waterDark = "#1a2860";
  } else {
    waterBase = "#1870b8"; waterLight = "#2088d0"; waterDark = "#1060a0";
  }

  wr(0, riverY + 3, worldW, riverH - 3, waterBase);

  // Flowing water ripple lines
  const flowSpeed = time * 15;
  for (let row = 0; row < 5; row++) {
    const ry = riverY + 5 + row * (TS * 0.9);
    const offset = (flowSpeed + row * 35) % worldW;

    for (let i = 0; i < 8; i++) {
      const rx = ((offset + i * 65 + row * 25) % (worldW + 40)) - 20;
      const rw = 10 + (i % 4) * 6;
      wr(rx, ry + Math.sin(time * 0.5 + i * 2 + row) * 1.5, rw, 0.8, waterLight);
    }

    for (let i = 0; i < 5; i++) {
      const dx = ((offset * 0.6 + i * 110 + row * 45) % (worldW + 60)) - 30;
      wr(dx, ry + 4, 6 + (i % 3) * 4, 0.7, waterDark);
    }
  }

  // Fish shadows — dark elongated shapes drifting with the current
  for (const fish of FISH_SHADOWS) {
    const fx = ((fish.startX + time * fish.speed) % (worldW + 40)) - 20;
    const fy = fish.y + Math.sin(time * 0.6 + fish.phase) * 3;
    const fAlpha = 0.12 + Math.sin(time * 0.4 + fish.phase) * 0.04;

    // Body shadow
    we(fx, fy, fish.length, fish.length * 0.3, `rgba(0,0,20,${fAlpha.toFixed(2)})`, fAlpha);
    // Tail shadow
    we(fx - fish.length * 0.8, fy, fish.length * 0.4, fish.length * 0.25,
      `rgba(0,0,20,${(fAlpha * 0.7).toFixed(2)})`, fAlpha * 0.7);
  }

  // Water lilies — lily pads with optional flowers
  const bob = Math.sin(time * 0.8) * 0.6;
  for (const lily of WATER_LILIES) {
    const lx = lily.x + Math.sin(time * 0.3 + lily.x * 0.1) * 2; // gentle drift
    const ly = lily.y + bob * (lily.sz / 4);
    const s = lily.sz;

    // Pad
    we(lx, ly, s, s * 0.65, "#308028");
    we(lx, ly, s * 0.85, s * 0.5, "#389030");
    // Veins
    wr(lx - s * 0.6, ly, s * 1.2, 0.3, "#206818");
    wr(lx - s * 0.3, ly - s * 0.2, s * 0.6, 0.25, "#206818");
    // Notch
    wr(lx + s * 0.5, ly - 0.4, s * 0.4, s * 0.3, waterBase);

    // Flower
    if (lily.hasFlower) {
      const flx = lx + s * 0.2;
      const fly = ly - s * 0.5;
      // Outer petals
      we(flx, fly, s * 0.5, s * 0.4, "#f0a0c0", 0.85);
      we(flx - s * 0.15, fly + s * 0.05, s * 0.35, s * 0.3, "#f8b0d0", 0.8);
      we(flx + s * 0.15, fly - s * 0.05, s * 0.35, s * 0.3, "#f0a0c0", 0.8);
      // Inner petals
      we(flx, fly, s * 0.25, s * 0.2, "#f8c8e0", 0.9);
      // Yellow centre
      we(flx, fly, s * 0.12, s * 0.1, "#f0d040", 0.95);
    }
  }

  // Shimmer highlights (daytime)
  if (tod !== "night") {
    const shimmerCol = tod === "dusk" || tod === "dawn" ? "#f0a860" : "#c0e8ff";
    for (let i = 0; i < 14; i++) {
      const sx = ((flowSpeed * 0.5 + i * 38) % worldW);
      const sy = riverY + 8 + ((i * 7 + Math.floor(time * 0.3)) % (riverH - 14));
      const sa = 0.18 + Math.sin(time * 2.5 + i * 1.7) * 0.1;
      if (sa > 0.12) {
        wr(sx, sy, 2.5, 0.8, shimmerCol);
        wr(sx + 4, sy + 0.5, 1.5, 0.6, shimmerCol);
      }
    }
  }

  // Bottom edge — darker water/riverbed
  wr(0, riverY + riverH - 4, worldW, 4, waterDark);
  const rng = seededRng("river-bed-v2");
  for (let i = 0; i < 20; i++) {
    const px = rng() * worldW;
    const py = riverY + riverH - 3 + rng() * 2;
    wr(px, py, 1.5 + rng(), 1, "#4a4038");
  }
}
