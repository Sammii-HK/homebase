import type { Dir, Pal, DeskZone } from "./types";
import {
  TS, DESK_ZONES, BREAK_SPOTS, OUTDOOR_SPOTS, BENCHES,
  ACTIVITIES_OUTDOOR, ACTIVITIES_BREAK, ACTIVITIES_BENCH,
  inPond, seededRng, findPath, WALKABLE, WORLD_COLS, WORLD_ROWS
} from "./world";

/* ── Palette ─────────────────────────────────────────────────── */

export const CHAR_PALETTES: Record<string, Pal> = {
  lunary: {
    skin: "#f5c9a0", hair: "#7030a8", shirt: "#8058d0",
    pants: "#384880", shoe: "#1a1420", accent: "#a070e0",
  },
  spellcast: {
    skin: "#f0b888", hair: "#202870", shirt: "#40b0a0",
    pants: "#1a3830", shoe: "#101018", accent: "#60d0c0",
  },
  dev: {
    skin: "#f0b888", hair: "#204808", shirt: "#30a868",
    pants: "#2a4828", shoe: "#101008", accent: "#50c878",
  },
  meta: {
    skin: "#f5c9a0", hair: "#a01828", shirt: "#e06090",
    pants: "#482838", shoe: "#201010", accent: "#f080b0",
  },
};

/* ── Pixel grid sprite system ────────────────────────────────── */
// Each sprite: 13 wide x 20 tall grid. Anchor: col 6 (centre), row 19 (bottom).
// Palette keys:
//   H=hair h=highlight S=skin s=shadow c=blush
//   E=eye W=white T=shirt t=shirtDark P=pants B=shoe

function createGrid(): string[][] {
  return Array.from({ length: 20 }, () => Array(13).fill("."));
}
function paint(g: string[][], x: number, y: number, w: number, h: number, ch: string) {
  for (let r = y; r < y + h && r < 20; r++)
    for (let c = x; c < x + w && c < 13; c++)
      if (r >= 0 && c >= 0) g[r][c] = ch;
}
function toFrame(g: string[][]): string[] { return g.map(r => r.join("")); }

// ── Front idle ──
function buildFrontIdle(): string[] {
  const g = createGrid();
  const r = (x: number, y: number, w: number, h: number, c: string) => paint(g, x, y, w, h, c);
  // Hair top
  r(4, 0, 5, 1, "H"); r(3, 1, 7, 2, "H"); r(4, 1, 5, 1, "h");
  // Hair framing sides + forehead
  r(2, 3, 1, 4, "H"); r(10, 3, 1, 4, "H"); r(3, 2, 7, 1, "H");
  // Face — rows 3-7
  r(3, 3, 7, 5, "S"); r(2, 4, 1, 3, "S"); r(10, 4, 1, 3, "S");
  // Eyes + blush
  g[5][4] = "W"; g[5][5] = "E"; g[5][7] = "W"; g[5][8] = "E";
  g[6][3] = "c"; g[6][9] = "c";
  // Neck — connects head row 7 to shirt row 8-9
  r(5, 8, 3, 1, "s"); r(5, 9, 3, 1, "S");
  // Shirt — overlaps neck at row 9, body rows 9-13
  r(4, 9, 5, 1, "t"); r(3, 10, 7, 4, "T"); r(4, 10, 5, 1, "t");
  // Arms — connect to torso at rows 10-12
  r(2, 10, 1, 3, "S"); r(10, 10, 1, 3, "S");
  r(2, 12, 1, 1, "s"); r(10, 12, 1, 1, "s");
  // Belt — shirt overlaps pants at row 13
  r(3, 13, 7, 1, "P");
  // Pants — rows 13-17, legs connect solidly
  r(3, 14, 7, 1, "P");
  r(4, 15, 2, 3, "P"); r(7, 15, 2, 3, "P");
  // Shoes — connect to legs at row 18
  r(4, 18, 2, 1, "B"); r(7, 18, 2, 1, "B");
  r(3, 19, 3, 1, "B"); r(7, 19, 3, 1, "B");
  return toFrame(g);
}

function buildFrontWalk1(): string[] {
  const g = createGrid();
  const r = (x: number, y: number, w: number, h: number, c: string) => paint(g, x, y, w, h, c);
  // Hair
  r(4, 0, 5, 1, "H"); r(3, 1, 7, 2, "H"); r(4, 1, 5, 1, "h");
  r(2, 3, 1, 4, "H"); r(10, 3, 1, 4, "H"); r(3, 2, 7, 1, "H");
  // Face
  r(3, 3, 7, 5, "S"); r(2, 4, 1, 3, "S"); r(10, 4, 1, 3, "S");
  g[5][4] = "W"; g[5][5] = "E"; g[5][7] = "W"; g[5][8] = "E";
  g[6][3] = "c"; g[6][9] = "c";
  // Neck
  r(5, 8, 3, 1, "s"); r(5, 9, 3, 1, "S");
  // Shirt
  r(4, 9, 5, 1, "t"); r(3, 10, 7, 4, "T"); r(4, 10, 5, 1, "t");
  // Arms
  r(2, 10, 1, 3, "S"); r(10, 10, 1, 3, "S");
  r(2, 12, 1, 1, "s"); r(10, 12, 1, 1, "s");
  // Belt + pants — left leg forward, right leg back
  r(3, 13, 7, 1, "P"); r(3, 14, 7, 1, "P");
  r(3, 15, 3, 3, "P"); r(8, 15, 2, 3, "P");
  // Shoes
  r(3, 18, 3, 1, "B"); r(8, 18, 2, 1, "B");
  r(2, 19, 4, 1, "B"); r(8, 19, 3, 1, "B");
  return toFrame(g);
}

function buildFrontWalk2(): string[] {
  const g = createGrid();
  const r = (x: number, y: number, w: number, h: number, c: string) => paint(g, x, y, w, h, c);
  // Hair
  r(4, 0, 5, 1, "H"); r(3, 1, 7, 2, "H"); r(4, 1, 5, 1, "h");
  r(2, 3, 1, 4, "H"); r(10, 3, 1, 4, "H"); r(3, 2, 7, 1, "H");
  // Face
  r(3, 3, 7, 5, "S"); r(2, 4, 1, 3, "S"); r(10, 4, 1, 3, "S");
  g[5][4] = "W"; g[5][5] = "E"; g[5][7] = "W"; g[5][8] = "E";
  g[6][3] = "c"; g[6][9] = "c";
  // Neck
  r(5, 8, 3, 1, "s"); r(5, 9, 3, 1, "S");
  // Shirt
  r(4, 9, 5, 1, "t"); r(3, 10, 7, 4, "T"); r(4, 10, 5, 1, "t");
  // Arms
  r(2, 10, 1, 3, "S"); r(10, 10, 1, 3, "S");
  r(2, 12, 1, 1, "s"); r(10, 12, 1, 1, "s");
  // Belt + pants — right leg forward, left leg back
  r(3, 13, 7, 1, "P"); r(3, 14, 7, 1, "P");
  r(4, 15, 2, 3, "P"); r(7, 15, 3, 3, "P");
  // Shoes
  r(4, 18, 2, 1, "B"); r(7, 18, 3, 1, "B");
  r(3, 19, 3, 1, "B"); r(7, 19, 4, 1, "B");
  return toFrame(g);
}

function buildSideIdle(): string[] {
  const g = createGrid();
  const r = (x: number, y: number, w: number, h: number, c: string) => paint(g, x, y, w, h, c);
  // Hair — back of head covered
  r(5, 0, 4, 1, "H"); r(4, 1, 6, 2, "H"); r(5, 1, 4, 1, "h");
  r(9, 2, 1, 5, "H"); r(8, 1, 2, 2, "H"); r(4, 2, 5, 1, "H");
  // Face — rows 3-7, nose protrudes 1px left
  r(4, 3, 5, 5, "S"); r(3, 4, 1, 3, "S");
  g[5][3] = "S"; // nose protrusion
  // Eye (only one visible in side view)
  g[5][5] = "W"; g[5][6] = "E";
  g[6][4] = "c";
  // Neck — connects face to shirt
  r(5, 8, 3, 1, "s"); r(5, 9, 3, 1, "S");
  // Shirt
  r(4, 9, 5, 1, "t"); r(4, 10, 5, 4, "T"); r(5, 10, 3, 1, "t");
  // Front arm — visible extending down
  r(3, 10, 1, 3, "S"); r(3, 12, 1, 1, "s");
  // Belt + pants — connect shirt to legs
  r(4, 13, 5, 1, "P"); r(4, 14, 5, 1, "P");
  r(5, 15, 3, 3, "P");
  // Shoes — connect to legs
  r(5, 18, 3, 1, "B"); r(4, 19, 4, 1, "B");
  return toFrame(g);
}

function buildSideWalk1(): string[] {
  const g = createGrid();
  const r = (x: number, y: number, w: number, h: number, c: string) => paint(g, x, y, w, h, c);
  // Hair
  r(5, 0, 4, 1, "H"); r(4, 1, 6, 2, "H"); r(5, 1, 4, 1, "h");
  r(9, 2, 1, 5, "H"); r(8, 1, 2, 2, "H"); r(4, 2, 5, 1, "H");
  // Face + nose
  r(4, 3, 5, 5, "S"); r(3, 4, 1, 3, "S");
  g[5][3] = "S";
  g[5][5] = "W"; g[5][6] = "E"; g[6][4] = "c";
  // Neck
  r(5, 8, 3, 1, "s"); r(5, 9, 3, 1, "S");
  // Shirt
  r(4, 9, 5, 1, "t"); r(4, 10, 5, 4, "T"); r(5, 10, 3, 1, "t");
  // Front arm
  r(3, 10, 1, 3, "S"); r(3, 12, 1, 1, "s");
  // Belt + pants — legs split for stride (front leg forward)
  r(4, 13, 5, 1, "P"); r(4, 14, 5, 1, "P");
  r(3, 15, 3, 3, "P"); r(7, 15, 2, 3, "P");
  // Shoes
  r(3, 18, 3, 1, "B"); r(7, 18, 2, 1, "B");
  r(2, 19, 4, 1, "B"); r(7, 19, 3, 1, "B");
  return toFrame(g);
}

function buildSideWalk2(): string[] {
  const g = createGrid();
  const r = (x: number, y: number, w: number, h: number, c: string) => paint(g, x, y, w, h, c);
  // Hair
  r(5, 0, 4, 1, "H"); r(4, 1, 6, 2, "H"); r(5, 1, 4, 1, "h");
  r(9, 2, 1, 5, "H"); r(8, 1, 2, 2, "H"); r(4, 2, 5, 1, "H");
  // Face + nose
  r(4, 3, 5, 5, "S"); r(3, 4, 1, 3, "S");
  g[5][3] = "S";
  g[5][5] = "W"; g[5][6] = "E"; g[6][4] = "c";
  // Neck
  r(5, 8, 3, 1, "s"); r(5, 9, 3, 1, "S");
  // Shirt
  r(4, 9, 5, 1, "t"); r(4, 10, 5, 4, "T"); r(5, 10, 3, 1, "t");
  // Front arm
  r(3, 10, 1, 3, "S"); r(3, 12, 1, 1, "s");
  // Belt + pants — legs together (back leg forward)
  r(4, 13, 5, 1, "P"); r(4, 14, 5, 1, "P");
  r(5, 15, 2, 3, "P"); r(6, 15, 3, 3, "P");
  // Shoes
  r(5, 18, 2, 1, "B"); r(6, 18, 3, 1, "B");
  r(4, 19, 5, 1, "B");
  return toFrame(g);
}

function buildBackIdle(): string[] {
  const g = createGrid();
  const r = (x: number, y: number, w: number, h: number, c: string) => paint(g, x, y, w, h, c);
  // Hair — covers entire back of head rows 0-7
  r(4, 0, 5, 1, "H"); r(3, 1, 7, 7, "H");
  r(4, 1, 5, 1, "h"); r(4, 2, 5, 3, "h");
  // Neck
  r(5, 8, 3, 1, "s");
  // Shirt + arms (shirt-coloured arms on back view)
  r(4, 9, 5, 1, "t"); r(3, 10, 7, 4, "T"); r(4, 10, 5, 1, "t");
  r(2, 10, 1, 3, "T"); r(10, 10, 1, 3, "T");
  // Belt + pants
  r(3, 13, 7, 1, "P"); r(3, 14, 7, 1, "P");
  r(4, 15, 2, 3, "P"); r(7, 15, 2, 3, "P");
  // Shoes
  r(4, 18, 2, 1, "B"); r(7, 18, 2, 1, "B");
  r(3, 19, 3, 1, "B"); r(7, 19, 3, 1, "B");
  return toFrame(g);
}

function buildBackWalk1(): string[] {
  const g = createGrid();
  const r = (x: number, y: number, w: number, h: number, c: string) => paint(g, x, y, w, h, c);
  // Hair
  r(4, 0, 5, 1, "H"); r(3, 1, 7, 7, "H");
  r(4, 1, 5, 1, "h"); r(4, 2, 5, 3, "h");
  // Neck
  r(5, 8, 3, 1, "s");
  // Shirt + arms
  r(4, 9, 5, 1, "t"); r(3, 10, 7, 4, "T"); r(4, 10, 5, 1, "t");
  r(2, 10, 1, 3, "T"); r(10, 10, 1, 3, "T");
  // Belt + pants — left leg forward
  r(3, 13, 7, 1, "P"); r(3, 14, 7, 1, "P");
  r(3, 15, 3, 3, "P"); r(8, 15, 2, 3, "P");
  // Shoes
  r(3, 18, 3, 1, "B"); r(8, 18, 2, 1, "B");
  r(2, 19, 4, 1, "B"); r(8, 19, 3, 1, "B");
  return toFrame(g);
}

function buildBackWalk2(): string[] {
  const g = createGrid();
  const r = (x: number, y: number, w: number, h: number, c: string) => paint(g, x, y, w, h, c);
  // Hair
  r(4, 0, 5, 1, "H"); r(3, 1, 7, 7, "H");
  r(4, 1, 5, 1, "h"); r(4, 2, 5, 3, "h");
  // Neck
  r(5, 8, 3, 1, "s");
  // Shirt + arms
  r(4, 9, 5, 1, "t"); r(3, 10, 7, 4, "T"); r(4, 10, 5, 1, "t");
  r(2, 10, 1, 3, "T"); r(10, 10, 1, 3, "T");
  // Belt + pants — right leg forward
  r(3, 13, 7, 1, "P"); r(3, 14, 7, 1, "P");
  r(4, 15, 2, 3, "P"); r(7, 15, 3, 3, "P");
  // Shoes
  r(4, 18, 2, 1, "B"); r(7, 18, 3, 1, "B");
  r(3, 19, 3, 1, "B"); r(7, 19, 4, 1, "B");
  return toFrame(g);
}

function buildSitting(): string[] {
  const g = createGrid();
  const r = (x: number, y: number, w: number, h: number, c: string) => paint(g, x, y, w, h, c);
  // Sitting sprite shifted down so character sits INTO the chair
  // Head starts at row 3 instead of 0, total visual height ~17 rows
  // Hair
  r(4, 3, 5, 1, "H"); r(3, 4, 7, 2, "H"); r(4, 4, 5, 1, "h");
  r(2, 6, 1, 4, "H"); r(10, 6, 1, 4, "H"); r(3, 5, 7, 1, "H");
  // Face — rows 6-10
  r(3, 6, 7, 5, "S"); r(2, 7, 1, 3, "S"); r(10, 7, 1, 3, "S");
  g[8][4] = "W"; g[8][5] = "E"; g[8][7] = "W"; g[8][8] = "E";
  g[9][3] = "c"; g[9][9] = "c";
  // Neck
  r(5, 11, 3, 1, "s"); r(5, 12, 3, 1, "S");
  // Shirt — rows 12-15
  r(4, 12, 5, 1, "t"); r(3, 13, 7, 3, "T"); r(4, 13, 5, 1, "t");
  // Arms
  r(2, 13, 1, 3, "S"); r(10, 13, 1, 3, "S");
  r(2, 15, 1, 1, "s"); r(10, 15, 1, 1, "s");
  // Seated thighs — horizontal, extending outward (rows 16-17)
  r(2, 16, 9, 2, "P");
  // Lower legs hanging down (rows 18-19)
  r(3, 18, 2, 1, "P"); r(8, 18, 2, 1, "P");
  // Shoes at bottom
  r(3, 19, 2, 1, "B"); r(8, 19, 2, 1, "B");
  return toFrame(g);
}

function buildSittingBack(): string[] {
  const g = createGrid();
  const r = (x: number, y: number, w: number, h: number, c: string) => paint(g, x, y, w, h, c);
  // Sitting back — shifted down like front sitting
  // Hair covers back of head rows 3-10
  r(4, 3, 5, 1, "H"); r(3, 4, 7, 7, "H");
  r(4, 4, 5, 1, "h"); r(4, 5, 5, 3, "h");
  // Neck
  r(5, 11, 3, 1, "s");
  // Shirt + arms — rows 12-15
  r(4, 12, 5, 1, "t"); r(3, 13, 7, 3, "T"); r(4, 13, 5, 1, "t");
  r(2, 13, 1, 3, "T"); r(10, 13, 1, 3, "T");
  // Seated thighs — horizontal (rows 16-17)
  r(2, 16, 9, 2, "P");
  // Lower legs hanging down
  r(3, 18, 2, 1, "P"); r(8, 18, 2, 1, "P");
  // Shoes
  r(3, 19, 2, 1, "B"); r(8, 19, 2, 1, "B");
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
    H: pal.hair, h: lighten(pal.hair, 30),
    S: pal.skin, s: lighten(pal.skin, -18), c: lighten(pal.skin, -8),
    E: "#1a1218", W: "#ffffff",
    T: pal.shirt, t: lighten(pal.shirt, -22),
    P: pal.pants,
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

  // Shadow
  ctx.globalAlpha = 0.18;
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
