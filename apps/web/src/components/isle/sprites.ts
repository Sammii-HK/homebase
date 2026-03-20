import type { Dir, Pal, DeskZone } from "./types";
import {
  TS, DESK_ZONES, BREAK_SPOTS, OUTDOOR_SPOTS, BENCHES,
  ACTIVITIES_OUTDOOR, ACTIVITIES_BREAK, ACTIVITIES_BENCH,
  inPond, seededRng, findPath, WALKABLE, WORLD_COLS, WORLD_ROWS
} from "./world";

/* ── Palette ─────────────────────────────────────────────────── */
// Brighter, more saturated colours that read clearly at small zoom

export const CHAR_PALETTES: Record<string, Pal> = {
  lunary: {
    skin: "#fad4b0", hair: "#9040d8", shirt: "#c8a0f0",
    pants: "#8860c8", shoe: "#2a1830", accent: "#d8b0ff",
  },
  spellcast: {
    skin: "#f8d0a8", hair: "#1838a0", shirt: "#50e0d0",
    pants: "#308878", shoe: "#101820", accent: "#70f0e0",
  },
  dev: {
    skin: "#f8d0a8", hair: "#2a6818", shirt: "#68d898",
    pants: "#3a7850", shoe: "#181810", accent: "#80f0a8",
  },
  meta: {
    skin: "#fad4b0", hair: "#d02040", shirt: "#ff90b8",
    pants: "#884060", shoe: "#281018", accent: "#ffa0c8",
  },
};

/* ── Pixel grid sprite system ────────────────────────────────── */
// Each sprite: 13 wide x 20 tall grid. Anchor: col 6 (centre), row 19 (bottom).
// Palette keys:
//   H=hair h=highlight S=skin s=shadow
//   E=eye W=white L=lash T=shirt t=shirtDark P=skirt B=shoe
//   A=accent (ribbon/accessory)

function createGrid(): string[][] {
  return Array.from({ length: 20 }, () => Array(13).fill("."));
}
function paint(g: string[][], x: number, y: number, w: number, h: number, ch: string) {
  for (let r = y; r < y + h && r < 20; r++)
    for (let c = x; c < x + w && c < 13; c++)
      if (r >= 0 && c >= 0) g[r][c] = ch;
}
function toFrame(g: string[][]): string[] { return g.map(r => r.join("")); }

// ── Shared feminine head helper ──
// Front-facing: rows 0-7 (hair + face). Hair flows down sides to row 8.
function drawFemFrontHead(g: string[][], r: (x: number, y: number, w: number, h: number, c: string) => void) {
  // Hair top — full rounded crown
  r(4, 0, 5, 1, "H");
  r(3, 1, 7, 1, "H"); g[1][5] = "h"; g[1][7] = "h"; // highlights
  r(3, 2, 7, 1, "H"); g[2][4] = "h";
  // Face — rows 3-7, set behind hair sides
  r(3, 3, 7, 5, "S");
  // Hair flowing down sides — thick, long, past shoulders
  r(2, 2, 1, 7, "H"); r(10, 2, 1, 7, "H");  // inner
  r(1, 3, 1, 6, "H"); r(11, 3, 1, 6, "H");  // outer
  // Eyelashes — 2px wide for visibility
  g[4][4] = "L"; g[4][5] = "L"; g[4][7] = "L"; g[4][8] = "L";
  // Eyes — larger, 2px wide each (row 5)
  g[5][4] = "W"; g[5][5] = "E"; g[5][7] = "E"; g[5][8] = "W";
  // Blush marks
  g[6][3] = "A"; g[6][9] = "A";
  // Mouth — small line
  g[7][5] = "s"; g[7][6] = "s"; g[7][7] = "s";
}

// Side-facing feminine head
function drawFemSideHead(g: string[][], r: (x: number, y: number, w: number, h: number, c: string) => void) {
  // Hair crown
  r(5, 0, 4, 1, "H");
  r(4, 1, 6, 1, "H"); g[1][6] = "h";
  r(4, 2, 6, 1, "H");
  // Hair back — flowing long behind
  r(9, 2, 2, 7, "H");
  r(10, 3, 2, 6, "H");
  // Face — rows 3-7
  r(4, 3, 5, 5, "S");
  r(3, 4, 1, 3, "S"); // chin/jaw
  g[5][3] = "S"; // nose tip
  // Eyelash
  g[4][4] = "L"; g[4][5] = "L";
  // Eye
  g[5][4] = "W"; g[5][5] = "E";
  // Blush
  g[6][3] = "A";
  // Mouth
  g[7][4] = "s"; g[7][5] = "s";
}

// Back-facing feminine head (hair covers everything)
function drawFemBackHead(g: string[][], r: (x: number, y: number, w: number, h: number, c: string) => void) {
  // Full hair coverage — long flowing
  r(4, 0, 5, 1, "H");
  r(3, 1, 7, 1, "H"); g[1][5] = "h"; g[1][7] = "h";
  r(3, 2, 7, 6, "H"); g[2][5] = "h"; g[3][6] = "h"; g[4][5] = "h";
  // Hair flowing past shoulders — wide and long
  r(2, 2, 1, 7, "H"); r(10, 2, 1, 7, "H");
  r(1, 3, 1, 6, "H"); r(11, 3, 1, 6, "H");
  // Ribbon/clip at back
  g[3][6] = "A";
}

// ── Body builders ──
function drawFemBodyFront(g: string[][], r: (x: number, y: number, w: number, h: number, c: string) => void) {
  // Neck (row 8)
  r(5, 8, 3, 1, "S");
  // Shirt collar (row 9)
  r(5, 9, 3, 1, "t");
  // Shirt torso (rows 10-12) — fitted, 5px wide
  r(4, 10, 5, 3, "T"); r(5, 10, 3, 1, "t");
  // Arms (skin coloured, rows 10-12)
  r(3, 10, 1, 3, "S"); r(9, 10, 1, 3, "S");
  r(3, 12, 1, 1, "s"); r(9, 12, 1, 1, "s"); // hands
  // Skirt — A-line flare (rows 13-16), accent stripe
  r(4, 13, 5, 1, "P");   // waist
  r(3, 14, 7, 1, "P");   // hip
  r(2, 15, 9, 1, "P");   // flare
  r(2, 16, 9, 1, "P");   // hem
  // Accent detail on skirt
  g[15][3] = "A"; g[15][9] = "A";
}

function drawFemBodyBack(g: string[][], r: (x: number, y: number, w: number, h: number, c: string) => void) {
  // Neck hidden by hair
  r(5, 8, 3, 1, "s");
  // Shirt collar
  r(5, 9, 3, 1, "t");
  // Shirt torso + arms (shirt-coloured from back)
  r(4, 10, 5, 3, "T"); r(5, 10, 3, 1, "t");
  r(3, 10, 1, 3, "T"); r(9, 10, 1, 3, "T");
  // Skirt — A-line
  r(4, 13, 5, 1, "P");
  r(3, 14, 7, 1, "P");
  r(2, 15, 9, 1, "P");
  r(2, 16, 9, 1, "P");
}

function drawFemBodySide(g: string[][], r: (x: number, y: number, w: number, h: number, c: string) => void) {
  // Neck
  r(5, 8, 3, 1, "S");
  // Shirt collar
  r(5, 9, 3, 1, "t");
  // Shirt torso
  r(4, 10, 5, 3, "T"); r(5, 10, 3, 1, "t");
  // Front arm
  r(3, 10, 1, 3, "S"); r(3, 12, 1, 1, "s");
  // Skirt — A-line
  r(4, 13, 5, 1, "P");
  r(3, 14, 6, 1, "P");
  r(3, 15, 7, 1, "P");
  r(3, 16, 7, 1, "P");
}

// ── Front idle ──
function buildFrontIdle(): string[] {
  const g = createGrid();
  const r = (x: number, y: number, w: number, h: number, c: string) => paint(g, x, y, w, h, c);
  drawFemFrontHead(g, r);
  drawFemBodyFront(g, r);
  // Legs (row 17)
  r(4, 17, 2, 1, "S"); r(7, 17, 2, 1, "S");
  // Shoes (rows 18-19)
  r(4, 18, 2, 2, "B"); r(7, 18, 2, 2, "B");
  return toFrame(g);
}

// ── Front walk 1 ──
function buildFrontWalk1(): string[] {
  const g = createGrid();
  const r = (x: number, y: number, w: number, h: number, c: string) => paint(g, x, y, w, h, c);
  drawFemFrontHead(g, r);
  drawFemBodyFront(g, r);
  // Walk stride: legs apart
  r(3, 17, 2, 1, "S"); r(8, 17, 2, 1, "S");
  r(2, 18, 2, 1, "B"); r(9, 18, 2, 1, "B");
  r(2, 19, 2, 1, "B"); r(9, 19, 2, 1, "B");
  return toFrame(g);
}

// ── Front walk 2 ──
function buildFrontWalk2(): string[] {
  const g = createGrid();
  const r = (x: number, y: number, w: number, h: number, c: string) => paint(g, x, y, w, h, c);
  drawFemFrontHead(g, r);
  drawFemBodyFront(g, r);
  // Walk stride: legs together-ish (opposite phase)
  r(5, 17, 2, 1, "S"); r(7, 17, 2, 1, "S");
  r(4, 18, 2, 1, "B"); r(8, 18, 2, 1, "B");
  r(4, 19, 2, 1, "B"); r(8, 19, 2, 1, "B");
  return toFrame(g);
}

// ── Side idle ──
function buildSideIdle(): string[] {
  const g = createGrid();
  const r = (x: number, y: number, w: number, h: number, c: string) => paint(g, x, y, w, h, c);
  drawFemSideHead(g, r);
  drawFemBodySide(g, r);
  // Legs + shoes
  r(5, 17, 2, 1, "S");
  r(5, 18, 2, 1, "B"); r(5, 19, 2, 1, "B");
  return toFrame(g);
}

// ── Side walk 1 ──
function buildSideWalk1(): string[] {
  const g = createGrid();
  const r = (x: number, y: number, w: number, h: number, c: string) => paint(g, x, y, w, h, c);
  drawFemSideHead(g, r);
  drawFemBodySide(g, r);
  // Walk stride: legs apart
  r(3, 17, 2, 1, "S"); r(7, 17, 2, 1, "S");
  r(2, 18, 2, 1, "B"); r(8, 18, 2, 1, "B");
  r(2, 19, 2, 1, "B"); r(8, 19, 2, 1, "B");
  return toFrame(g);
}

// ── Side walk 2 ──
function buildSideWalk2(): string[] {
  const g = createGrid();
  const r = (x: number, y: number, w: number, h: number, c: string) => paint(g, x, y, w, h, c);
  drawFemSideHead(g, r);
  drawFemBodySide(g, r);
  // Walk stride: opposite phase
  r(5, 17, 2, 1, "S"); r(7, 17, 1, 1, "S");
  r(5, 18, 2, 1, "B"); r(7, 18, 1, 1, "B");
  r(4, 19, 2, 1, "B"); r(7, 19, 1, 1, "B");
  return toFrame(g);
}

// ── Back idle ──
function buildBackIdle(): string[] {
  const g = createGrid();
  const r = (x: number, y: number, w: number, h: number, c: string) => paint(g, x, y, w, h, c);
  drawFemBackHead(g, r);
  drawFemBodyBack(g, r);
  // Legs + shoes
  r(4, 17, 2, 1, "S"); r(7, 17, 2, 1, "S");
  r(4, 18, 2, 2, "B"); r(7, 18, 2, 2, "B");
  return toFrame(g);
}

// ── Back walk 1 ──
function buildBackWalk1(): string[] {
  const g = createGrid();
  const r = (x: number, y: number, w: number, h: number, c: string) => paint(g, x, y, w, h, c);
  drawFemBackHead(g, r);
  drawFemBodyBack(g, r);
  // Walk stride
  r(3, 17, 2, 1, "S"); r(8, 17, 2, 1, "S");
  r(2, 18, 2, 1, "B"); r(9, 18, 2, 1, "B");
  r(2, 19, 2, 1, "B"); r(9, 19, 2, 1, "B");
  return toFrame(g);
}

// ── Back walk 2 ──
function buildBackWalk2(): string[] {
  const g = createGrid();
  const r = (x: number, y: number, w: number, h: number, c: string) => paint(g, x, y, w, h, c);
  drawFemBackHead(g, r);
  drawFemBodyBack(g, r);
  // Walk stride: opposite
  r(5, 17, 2, 1, "S"); r(7, 17, 2, 1, "S");
  r(4, 18, 2, 1, "B"); r(8, 18, 2, 1, "B");
  r(4, 19, 2, 1, "B"); r(8, 19, 2, 1, "B");
  return toFrame(g);
}

// ── Sitting front (facing down toward camera) ──
function buildSitting(): string[] {
  const g = createGrid();
  const r = (x: number, y: number, w: number, h: number, c: string) => paint(g, x, y, w, h, c);
  drawFemFrontHead(g, r);
  // Neck
  r(5, 8, 3, 1, "S");
  // Shirt collar
  r(5, 9, 3, 1, "t");
  // Shirt torso (rows 10-12)
  r(4, 10, 5, 3, "T"); r(5, 10, 3, 1, "t");
  // Arms on desk (rows 10-13 — reaching forward)
  r(3, 10, 1, 4, "S"); r(9, 10, 1, 4, "S");
  r(3, 13, 1, 1, "s"); r(9, 13, 1, 1, "s");
  // Skirt — seated, wider spread (rows 13-15)
  r(4, 13, 5, 1, "P");
  r(3, 14, 7, 1, "P");
  r(2, 15, 9, 1, "P"); // seat spread
  // Legs (rows 16-17, hanging)
  r(3, 16, 2, 2, "S"); r(8, 16, 2, 2, "S");
  // Shoes (rows 18-19)
  r(3, 18, 2, 2, "B"); r(8, 18, 2, 2, "B");
  return toFrame(g);
}

// ── Sitting back (facing up away from camera) ──
function buildSittingBack(): string[] {
  const g = createGrid();
  const r = (x: number, y: number, w: number, h: number, c: string) => paint(g, x, y, w, h, c);
  drawFemBackHead(g, r);
  // Neck hidden by hair
  r(5, 8, 3, 1, "s");
  // Shirt collar
  r(5, 9, 3, 1, "t");
  // Shirt torso + arms
  r(4, 10, 5, 3, "T"); r(5, 10, 3, 1, "t");
  r(3, 10, 1, 4, "T"); r(9, 10, 1, 4, "T");
  // Skirt — seated spread
  r(4, 13, 5, 1, "P");
  r(3, 14, 7, 1, "P");
  r(2, 15, 9, 1, "P");
  // Legs (rows 16-17)
  r(3, 16, 2, 2, "S"); r(8, 16, 2, 2, "S");
  // Shoes (rows 18-19)
  r(3, 18, 2, 2, "B"); r(8, 18, 2, 2, "B");
  return toFrame(g);
}

const SPRITES = {
  front: { idle: buildFrontIdle(), walk1: buildFrontWalk1(), walk2: buildFrontWalk2() },
  side:  { idle: buildSideIdle(), walk1: buildSideWalk1(), walk2: buildSideWalk2() },
  back:  { idle: buildBackIdle(), walk1: buildBackWalk1(), walk2: buildBackWalk2() },
  sitFront: buildSitting(),
  sitBack:  buildSittingBack(),
};

/* ── Colour mapping ──────────────────────────────────────────── */

function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const cl = (v: number) => Math.max(0, Math.min(255, v));
  return `rgb(${cl((n >> 16) + amt)},${cl(((n >> 8) & 255) + amt)},${cl((n & 255) + amt)})`;
}

function getPalColors(pal: Pal): Record<string, string> {
  return {
    H: pal.hair, h: lighten(pal.hair, 40),
    S: pal.skin, s: lighten(pal.skin, -20),
    E: "#1a1218", W: "#ffffff", L: "#1a1218",
    T: pal.shirt, t: lighten(pal.shirt, -25),
    P: pal.pants, A: pal.accent,
    B: pal.shoe,
  };
}

/* ── Sprite renderer ─────────────────────────────────────────── */

function renderSprite(
  ctx: CanvasRenderingContext2D,
  frame: string[],
  colors: Record<string, string>,
  bx: number, by: number, zoom: number,
  mirror: boolean,
) {
  const W = 13, H = 20, ox = 6, oy = 19;
  for (let row = 0; row < H; row++) {
    const line = frame[row];
    let col = 0;
    while (col < W) {
      const ch = line[col];
      if (ch === ".") { col++; continue; }
      const color = colors[ch];
      if (!color) { col++; continue; }
      let runLen = 1;
      while (col + runLen < W && line[col + runLen] === ch) runLen++;
      ctx.fillStyle = color;
      const px = mirror ? (W - 1 - (col + runLen - 1)) : col;
      ctx.fillRect(
        Math.round(bx + (px - ox) * zoom),
        Math.round(by + (row - oy) * zoom),
        Math.max(1, Math.round(runLen * zoom)),
        Math.max(1, Math.round(zoom)),
      );
      col += runLen;
    }
  }
}

/* ── Char class ─────────────────────────────────────────────── */

export class Char {
  x: number; y: number; tx: number; ty: number;
  dir: Dir; frame = 0; frameTimer = 0; wanderTimer = 0;
  atDesk = true; isWorking = false;
  activity: string | null = null;
  readonly pal: Pal; readonly zone: DeskZone;
  path: [number, number][] | null = null;
  pathIdx = 0; idleSince = 0;
  breathPhase: number; blinkTimer: number; isBlinking = false;

  constructor(readonly zoneId: string) {
    this.zone = DESK_ZONES.find(z => z.id === zoneId)!;
    this.pal = CHAR_PALETTES[zoneId];
    this.x = this.zone.seatX; this.y = this.zone.seatY;
    this.tx = this.x; this.ty = this.y;
    this.dir = this.zone.facing;
    const r = seededRng(zoneId);
    this.wanderTimer = 3 + r() * 5;
    this.breathPhase = r() * Math.PI * 2;
    this.blinkTimer = 2 + r() * 4;
  }

  update(dt: number) {
    this.breathPhase += dt * 2;
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.isBlinking = true;
      this.blinkTimer = 3 + Math.random() * 4;
      setTimeout(() => { this.isBlinking = false; }, 150);
    }

    if (this.isWorking && !this.atDesk) {
      this.setTarget(this.zone.seatX, this.zone.seatY);
    }

    const dist = Math.hypot(this.x - this.tx, this.y - this.ty);

    if (dist < 1) {
      this.x = this.tx; this.y = this.ty; this.frame = 0;
      if (this.isWorking) {
        this.atDesk = true; this.dir = this.zone.facing;
        this.activity = null; return;
      }
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 5 + Math.random() * 10;
        if (this.atDesk) {
          const allSpots = [...BREAK_SPOTS, ...OUTDOOR_SPOTS];
          let px = 0, py = 0;
          do {
            const p = allSpots[Math.floor(Math.random() * allSpots.length)];
            px = p[0] + (Math.random() - 0.5) * TS;
            py = p[1] + (Math.random() - 0.5) * TS;
          } while (inPond(px, py));
          this.setTarget(px, py);
          this.atDesk = false; this.activity = null;
        } else {
          if (Math.random() < 0.3) {
            this.setTarget(this.zone.seatX, this.zone.seatY);
          } else {
            const allSpots = [...BREAK_SPOTS, ...OUTDOOR_SPOTS];
            let px = 0, py = 0;
            do {
              const p = allSpots[Math.floor(Math.random() * allSpots.length)];
              px = p[0] + (Math.random() - 0.5) * TS;
              py = p[1] + (Math.random() - 0.5) * TS;
            } while (inPond(px, py));
            this.setTarget(px, py);
          }
          this.activity = null;
        }
      }
      if (!this.atDesk && dist < 1 && !this.activity) {
        const nearBench = BENCHES.some(
          (b: { tx: number; ty: number }) => Math.hypot(this.x - b.tx * TS, this.y - b.ty * TS) < 24,
        );
        const nearBreak = this.x < 6 * TS && this.y > 10 * TS;
        if (nearBench) this.activity = ACTIVITIES_BENCH[Math.floor(Math.random() * ACTIVITIES_BENCH.length)];
        else if (nearBreak) this.activity = ACTIVITIES_BREAK[Math.floor(Math.random() * ACTIVITIES_BREAK.length)];
        else this.activity = ACTIVITIES_OUTDOOR[Math.floor(Math.random() * ACTIVITIES_OUTDOOR.length)];
      }
    } else {
      if (this.path && this.pathIdx < this.path.length) {
        const [ntx, nty] = this.path[this.pathIdx];
        const wx = ntx * TS + TS / 2;
        const wy = nty * TS + TS / 2;
        const nd = Math.hypot(this.x - wx, this.y - wy);
        if (nd < 2) {
          this.pathIdx++;
          if (this.pathIdx >= this.path.length) {
            this.x = this.tx; this.y = this.ty; this.path = null; return;
          }
        }
        const dx = wx - this.x; const dy = wy - this.y;
        const step = Math.min(nd, 28 * dt);
        this.x += (dx / nd) * step; this.y += (dy / nd) * step;
        this.dir = Math.abs(dx) > Math.abs(dy)
          ? (dx > 0 ? "right" : "left")
          : (dy > 0 ? "down" : "up");
      } else {
        const dx = this.tx - this.x; const dy = this.ty - this.y;
        const step = Math.min(dist, 28 * dt);
        this.x += (dx / dist) * step; this.y += (dy / dist) * step;
        this.dir = Math.abs(dx) > Math.abs(dy)
          ? (dx > 0 ? "right" : "left")
          : (dy > 0 ? "down" : "up");
      }
      this.frameTimer += dt;
      if (this.frameTimer > 0.18) { this.frame = 1 - this.frame; this.frameTimer = 0; }
      this.activity = null;
    }
  }

  private setTarget(px: number, py: number) {
    this.tx = px; this.ty = py;
    const fromTX = Math.floor(this.x / TS); const fromTY = Math.floor(this.y / TS);
    const toTX = Math.floor(px / TS); const toTY = Math.floor(py / TS);
    this.path = findPath(fromTX, fromTY, toTX, toTY);
    this.pathIdx = 0;
  }
}

/* ── Character drawing ──────────────────────────────────────── */

export function drawChar(
  ctx: CanvasRenderingContext2D,
  ch: Char,
  zoom: number,
  panX: number,
  panY: number,
) {
  const bx = panX + ch.x * zoom;
  const by = panY + ch.y * zoom;
  const colors = getPalColors(ch.pal);
  const isMoving = Math.hypot(ch.x - ch.tx, ch.y - ch.ty) > 1;

  // Blink: replace eye colours with skin
  const drawColors = { ...colors };
  if (ch.isBlinking) {
    drawColors.W = ch.pal.skin;
    drawColors.E = lighten(ch.pal.skin, -20);
  }

  // Breathing: subtle vertical bob
  const breathOff = Math.sin(ch.breathPhase) * 0.4;

  // Shadow — ellipse under feet
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(bx, by + zoom, zoom * 5, zoom * 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Select sprite frame
  let frame: string[];
  let mirror = false;
  const sitting = ch.atDesk;

  if (sitting) {
    frame = ch.dir === "up" ? SPRITES.sitBack : SPRITES.sitFront;
  } else if (isMoving) {
    const wf = ch.frame === 0 ? "walk1" : "walk2";
    if (ch.dir === "down") frame = SPRITES.front[wf];
    else if (ch.dir === "up") frame = SPRITES.back[wf];
    else { frame = SPRITES.side[wf]; mirror = ch.dir === "left"; }
  } else {
    if (ch.dir === "down") frame = SPRITES.front.idle;
    else if (ch.dir === "up") frame = SPRITES.back.idle;
    else { frame = SPRITES.side.idle; mirror = ch.dir === "left"; }
  }

  renderSprite(ctx, frame, drawColors, bx, by + breathOff * zoom, zoom, mirror);

  // Hair bob animation when walking
  if (isMoving && !sitting) {
    const bobOff = Math.sin(ch.breathPhase * 3) * 0.3;
    // Extra hair sway pixel at bottom of hair (cosmetic)
    const hairCol = ch.pal.hair;
    ctx.fillStyle = hairCol;
    const hx = mirror ? bx + 5 * zoom : bx - 5 * zoom;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(
      Math.round(hx + bobOff * zoom),
      Math.round(by + (breathOff - 11) * zoom),
      Math.max(1, Math.round(zoom)),
      Math.max(1, Math.round(zoom * 2)),
    );
    ctx.globalAlpha = 1;
  }

  // Activity / state bubble
  const showActivity = !ch.isWorking && ch.activity && !ch.atDesk;
  const showState = ch.isWorking;
  const bubbleLabel = showState ? "WORKING"
    : showActivity ? ch.activity!.slice(0, 20) : null;

  if (bubbleLabel) {
    const lby = by - 24 * zoom;
    const col = showState ? ch.zone.monitorGlow : "rgba(60,40,80,0.85)";
    ctx.font = `${Math.max(9, Math.round(9 * zoom / 2))}px 'Courier New',monospace`;
    ctx.textAlign = "center";
    const tw = ctx.measureText(bubbleLabel).width;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.roundRect(bx - tw / 2 - 4, lby - 12, tw + 8, 13, 4);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(bubbleLabel, bx, lby - 1);
    ctx.textAlign = "left";
  }

  // Name label
  {
    const nby = by - (bubbleLabel ? 40 : 24) * zoom;
    const nm = ch.zone.label.slice(0, 16);
    ctx.font = `bold ${Math.max(8, Math.round(8 * zoom / 2))}px sans-serif`;
    ctx.textAlign = "center";
    const tw = ctx.measureText(nm).width;
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.beginPath();
    ctx.roundRect(bx - tw / 2 - 4, nby - 11, tw + 8, 12, 3);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(nm, bx, nby - 1);
    ctx.textAlign = "left";
  }
}
