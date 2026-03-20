import type { Dir, Pal, DeskZone } from "./types";
import {
  TS, DESK_ZONES, BREAK_SPOTS, OUTDOOR_SPOTS, BENCHES,
  ACTIVITIES_OUTDOOR, ACTIVITIES_BREAK, ACTIVITIES_BENCH,
  inPond, seededRng, findPath, WALKABLE, WORLD_COLS, WORLD_ROWS
} from "./world";

/* ── Palette ─────────────────────────────────────────────────── */

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

/* ── Hair styles ────────────────────────────────────────────── */
type HairStyle = "long" | "bob" | "ponytail" | "twintails";
const HAIR_STYLES: Record<string, HairStyle> = {
  lunary: "long", spellcast: "bob", dev: "ponytail", meta: "twintails",
};

/* ── Pixel grid sprite system ────────────────────────────────── */
// 16 wide x 24 tall. Anchor: col 8 (centre), row 23 (bottom).
// Larger grid = more detail, better proportions.
// H=hair h=highlight S=skin s=shadow E=eye W=white L=lash
// T=shirt t=shirtDark P=skirt B=shoe A=accent M=mouth

const SW = 16, SH = 24, AX = 8, AY = 23;

function createGrid(): string[][] {
  return Array.from({ length: SH }, () => Array(SW).fill("."));
}
function paint(g: string[][], x: number, y: number, w: number, h: number, ch: string) {
  for (let r = y; r < y + h && r < SH; r++)
    for (let c = x; c < x + w && c < SW; c++)
      if (r >= 0 && c >= 0) g[r][c] = ch;
}
function toFrame(g: string[][]): string[] { return g.map(r => r.join("")); }
type P = (x: number, y: number, w: number, h: number, c: string) => void;

// ── Face features ──
function drawFace(g: string[][]) {
  // Eyes (row 6) — large cute chibi eyes
  g[6][5] = "W"; g[6][6] = "E";
  g[6][9] = "E"; g[6][10] = "W";
  // Eye shine
  g[5][5] = "L"; g[5][9] = "L";
  // Blush
  g[7][4] = "A"; g[7][11] = "A";
  // Mouth
  g[8][7] = "M"; g[8][8] = "M";
}

function drawSideFace(g: string[][]) {
  g[6][5] = "W"; g[6][6] = "E";
  g[5][5] = "L";
  g[7][4] = "A";
  g[8][6] = "M";
}

// ═══════════════════════════════════════════════════════════════
// HAIR STYLES — Front / Side / Back for each style
// Head occupies rows 0-9, face area rows 4-9
// ═══════════════════════════════════════════════════════════════

// LONG FLOWING (LUNA)
function hairLongFront(g: string[][], r: P) {
  // Hair crown
  r(5, 0, 6, 1, "H");
  r(4, 1, 8, 1, "H"); g[1][7] = "h"; g[1][9] = "h";
  r(4, 2, 8, 1, "H"); g[2][5] = "h"; g[2][8] = "h";
  r(4, 3, 8, 1, "H");
  // Face
  r(4, 4, 8, 6, "S");
  // Side hair flowing long
  r(3, 2, 1, 9, "H"); r(12, 2, 1, 9, "H");
  r(2, 3, 1, 8, "H"); r(13, 3, 1, 8, "H");
  drawFace(g);
}
function hairLongSide(g: string[][], r: P) {
  r(6, 0, 5, 1, "H");
  r(5, 1, 7, 1, "H"); g[1][8] = "h";
  r(5, 2, 7, 1, "H");
  r(5, 3, 7, 1, "H");
  // Flowing back
  r(11, 2, 2, 9, "H"); r(12, 4, 2, 7, "H");
  // Face
  r(5, 4, 6, 6, "S"); r(4, 5, 1, 4, "S");
  g[6][4] = "S"; // nose
  drawSideFace(g);
}
function hairLongBack(g: string[][], r: P) {
  r(5, 0, 6, 1, "H");
  r(4, 1, 8, 1, "H"); g[1][7] = "h"; g[1][9] = "h";
  r(4, 2, 8, 8, "H"); g[3][6] = "h"; g[4][8] = "h"; g[5][7] = "h";
  r(3, 2, 1, 9, "H"); r(12, 2, 1, 9, "H");
  r(2, 3, 1, 8, "H"); r(13, 3, 1, 8, "H");
  g[4][8] = "A"; // ribbon
}

// BOB (CASTER)
function hairBobFront(g: string[][], r: P) {
  r(5, 0, 6, 1, "H");
  r(4, 1, 8, 1, "H"); g[1][7] = "h";
  r(4, 2, 8, 1, "H"); g[2][6] = "h";
  r(4, 3, 8, 1, "H");
  // Fringe/bangs
  g[4][4] = "H"; g[4][5] = "h"; g[4][6] = "H"; g[4][7] = "h"; g[4][8] = "H"; g[4][9] = "H"; g[4][10] = "h"; g[4][11] = "H";
  // Face
  r(4, 5, 8, 5, "S");
  // Short bob sides — jaw length only (to row 7)
  r(3, 2, 1, 6, "H"); r(12, 2, 1, 6, "H");
  drawFace(g);
}
function hairBobSide(g: string[][], r: P) {
  r(6, 0, 5, 1, "H");
  r(5, 1, 7, 1, "H"); g[1][8] = "h";
  r(5, 2, 7, 1, "H");
  r(5, 3, 7, 1, "H");
  // Fringe
  g[4][5] = "H"; g[4][6] = "h";
  // Short back
  r(11, 2, 1, 6, "H"); r(12, 3, 1, 4, "H");
  // Face
  r(5, 4, 6, 6, "S"); r(4, 5, 1, 4, "S");
  g[6][4] = "S";
  drawSideFace(g);
}
function hairBobBack(g: string[][], r: P) {
  r(5, 0, 6, 1, "H");
  r(4, 1, 8, 1, "H"); g[1][7] = "h";
  r(4, 2, 8, 6, "H"); g[3][6] = "h"; g[4][8] = "h";
  r(3, 2, 1, 6, "H"); r(12, 2, 1, 6, "H");
  // Nape visible
  r(5, 8, 6, 2, "S");
}

// PONYTAIL (DEV)
function hairPonytailFront(g: string[][], r: P) {
  r(5, 0, 6, 1, "H");
  r(4, 1, 8, 1, "H"); g[1][7] = "h";
  r(4, 2, 8, 1, "H");
  r(4, 3, 8, 1, "H");
  // Face
  r(4, 4, 8, 6, "S");
  // Pulled back — shorter sides
  r(3, 2, 1, 5, "H"); r(12, 2, 1, 5, "H");
  // Hair ties (accent)
  g[3][3] = "A"; g[3][12] = "A";
  drawFace(g);
}
function hairPonytailSide(g: string[][], r: P) {
  r(6, 0, 5, 1, "H");
  r(5, 1, 7, 1, "H"); g[1][8] = "h";
  r(5, 2, 7, 1, "H");
  r(5, 3, 6, 1, "H");
  // Hair tie
  g[3][11] = "A";
  // Ponytail flowing behind
  r(11, 4, 1, 2, "H"); r(12, 5, 1, 6, "H"); r(13, 6, 1, 5, "H");
  // Face
  r(5, 4, 6, 6, "S"); r(4, 5, 1, 4, "S");
  g[6][4] = "S";
  drawSideFace(g);
}
function hairPonytailBack(g: string[][], r: P) {
  r(5, 0, 6, 1, "H");
  r(4, 1, 8, 1, "H"); g[1][7] = "h";
  r(4, 2, 8, 2, "H");
  // Hair tie
  g[3][8] = "A";
  // Ponytail hanging centre
  r(7, 4, 2, 7, "H"); g[5][7] = "h"; g[6][8] = "h"; g[7][7] = "h";
  // Nape (skin visible at sides)
  r(4, 4, 3, 4, "S"); r(9, 4, 3, 4, "S");
  // Pulled-back sides
  r(3, 2, 1, 4, "H"); r(12, 2, 1, 4, "H");
}

// TWIN TAILS (META)
function hairTwintailsFront(g: string[][], r: P) {
  r(5, 0, 6, 1, "H");
  r(4, 1, 8, 1, "H"); g[1][7] = "h"; g[1][9] = "h";
  r(4, 2, 8, 1, "H"); g[2][5] = "h";
  r(4, 3, 8, 1, "H");
  // Face
  r(4, 4, 8, 6, "S");
  // Twin tails flowing down sides
  r(2, 2, 1, 9, "H"); r(1, 3, 1, 8, "H"); r(0, 5, 1, 6, "H");
  r(13, 2, 1, 9, "H"); r(14, 3, 1, 8, "H"); r(15, 5, 1, 6, "H");
  // Hair ties
  g[4][2] = "A"; g[4][13] = "A";
  drawFace(g);
}
function hairTwintailsSide(g: string[][], r: P) {
  r(6, 0, 5, 1, "H");
  r(5, 1, 7, 1, "H"); g[1][8] = "h";
  r(5, 2, 7, 1, "H");
  r(5, 3, 6, 1, "H");
  // Visible tail behind
  r(11, 2, 2, 9, "H"); r(13, 4, 1, 7, "H");
  g[4][12] = "A"; // tie
  // Face
  r(5, 4, 6, 6, "S"); r(4, 5, 1, 4, "S");
  g[6][4] = "S";
  drawSideFace(g);
}
function hairTwintailsBack(g: string[][], r: P) {
  r(5, 0, 6, 1, "H");
  r(4, 1, 8, 1, "H"); g[1][7] = "h"; g[1][9] = "h";
  r(4, 2, 8, 3, "H"); g[2][6] = "h";
  // Twin tails
  r(2, 2, 1, 9, "H"); r(1, 3, 1, 8, "H"); r(0, 5, 1, 6, "H");
  r(13, 2, 1, 9, "H"); r(14, 3, 1, 8, "H"); r(15, 5, 1, 6, "H");
  g[4][2] = "A"; g[4][13] = "A";
  // Nape
  r(5, 5, 6, 4, "S");
}

// Hair dispatcher
type HeadFn = (g: string[][], r: P) => void;
const HAIR_FNS: Record<HairStyle, { front: HeadFn; side: HeadFn; back: HeadFn }> = {
  long:      { front: hairLongFront,      side: hairLongSide,      back: hairLongBack },
  bob:       { front: hairBobFront,       side: hairBobSide,       back: hairBobBack },
  ponytail:  { front: hairPonytailFront,  side: hairPonytailSide,  back: hairPonytailBack },
  twintails: { front: hairTwintailsFront, side: hairTwintailsSide, back: hairTwintailsBack },
};

// ═══════════════════════════════════════════════════════════════
// Body (shared) — rows 10-23
// ═══════════════════════════════════════════════════════════════
function drawBodyFront(g: string[][], r: P) {
  // Neck (row 10)
  r(7, 10, 2, 1, "S");
  // Shirt (rows 11-14)
  r(6, 11, 4, 1, "t"); // collar
  r(5, 12, 6, 3, "T"); r(6, 12, 4, 1, "t");
  // Arms
  r(4, 12, 1, 3, "S"); r(11, 12, 1, 3, "S");
  r(4, 14, 1, 1, "s"); r(11, 14, 1, 1, "s"); // hands
  // Skirt (rows 15-18)
  r(5, 15, 6, 1, "P");
  r(4, 16, 8, 1, "P");
  r(3, 17, 10, 1, "P");
  r(3, 18, 10, 1, "P");
  g[17][4] = "A"; g[17][11] = "A"; // accent stripe
}
function drawBodyBack(g: string[][], r: P) {
  r(7, 10, 2, 1, "s");
  r(6, 11, 4, 1, "t");
  r(5, 12, 6, 3, "T"); r(6, 12, 4, 1, "t");
  r(4, 12, 1, 3, "T"); r(11, 12, 1, 3, "T");
  r(5, 15, 6, 1, "P"); r(4, 16, 8, 1, "P");
  r(3, 17, 10, 1, "P"); r(3, 18, 10, 1, "P");
}
function drawBodySide(g: string[][], r: P) {
  r(7, 10, 2, 1, "S");
  r(6, 11, 4, 1, "t");
  r(5, 12, 6, 3, "T"); r(6, 12, 4, 1, "t");
  r(4, 12, 1, 3, "S"); r(4, 14, 1, 1, "s");
  r(5, 15, 6, 1, "P"); r(4, 16, 7, 1, "P");
  r(4, 17, 8, 1, "P"); r(4, 18, 8, 1, "P");
}

// ═══════════════════════════════════════════════════════════════
// Leg/feet variations — PROPER WALK CYCLE
// Walk uses 3 frames: idle (standing), stepL (left forward), stepR (right forward)
// The cycle is: stepL → idle → stepR → idle (natural alternating gait)
// Each step: ONE foot goes forward, other stays back. NOT symmetric splay.
// ═══════════════════════════════════════════════════════════════

// Front legs
function legsFrontIdle(g: string[][], r: P) {
  r(5, 19, 2, 1, "S"); r(9, 19, 2, 1, "S"); // thighs
  r(5, 20, 2, 2, "S"); r(9, 20, 2, 2, "S"); // calves
  r(5, 22, 2, 2, "B"); r(9, 22, 2, 2, "B"); // shoes
}
function legsFrontStepL(g: string[][], r: P) {
  // Left foot forward (shifted down-left), right foot back (centre)
  r(4, 19, 2, 1, "S"); r(9, 19, 2, 1, "S");
  r(3, 20, 2, 2, "S"); r(9, 20, 2, 1, "S");
  r(3, 22, 2, 2, "B"); r(9, 21, 2, 2, "B");
}
function legsFrontStepR(g: string[][], r: P) {
  // Right foot forward (shifted down-right), left foot back (centre)
  r(5, 19, 2, 1, "S"); r(10, 19, 2, 1, "S");
  r(5, 20, 2, 1, "S"); r(11, 20, 2, 2, "S");
  r(5, 21, 2, 2, "B"); r(11, 22, 2, 2, "B");
}

// Side legs
function legsSideIdle(g: string[][], r: P) {
  r(6, 19, 3, 1, "S");
  r(6, 20, 3, 2, "S");
  r(6, 22, 3, 2, "B");
}
function legsSideStepL(g: string[][], r: P) {
  // Front leg forward, back leg behind
  r(4, 19, 2, 1, "S"); r(8, 19, 2, 1, "S");
  r(3, 20, 2, 2, "S"); r(9, 20, 2, 1, "S");
  r(3, 22, 2, 2, "B"); r(9, 21, 2, 2, "B");
}
function legsSideStepR(g: string[][], r: P) {
  // Back leg forward, front leg behind (swap)
  r(5, 19, 2, 1, "S"); r(9, 19, 2, 1, "S");
  r(5, 20, 2, 1, "S"); r(9, 20, 2, 2, "S");
  r(5, 21, 2, 2, "B"); r(9, 22, 2, 2, "B");
}

// Back legs (same positions as front)
const legsBackIdle = legsFrontIdle;
const legsBackStepL = legsFrontStepL;
const legsBackStepR = legsFrontStepR;

// ═══════════════════════════════════════════════════════════════
// Sprite set builder
// ═══════════════════════════════════════════════════════════════
interface SpriteSet {
  front: { idle: string[]; stepL: string[]; stepR: string[] };
  side:  { idle: string[]; stepL: string[]; stepR: string[] };
  back:  { idle: string[]; stepL: string[]; stepR: string[] };
  sitFront: string[];
  sitBack: string[];
}

function buildSpriteSet(style: HairStyle): SpriteSet {
  const hair = HAIR_FNS[style];

  function make(headFn: HeadFn, bodyFn: (g: string[][], r: P) => void, legsFn: (g: string[][], r: P) => void): string[] {
    const g = createGrid();
    const r: P = (x, y, w, h, c) => paint(g, x, y, w, h, c);
    headFn(g, r);
    bodyFn(g, r);
    legsFn(g, r);
    return toFrame(g);
  }

  return {
    front: {
      idle:  make(hair.front, drawBodyFront, legsFrontIdle),
      stepL: make(hair.front, drawBodyFront, legsFrontStepL),
      stepR: make(hair.front, drawBodyFront, legsFrontStepR),
    },
    side: {
      idle:  make(hair.side, drawBodySide, legsSideIdle),
      stepL: make(hair.side, drawBodySide, legsSideStepL),
      stepR: make(hair.side, drawBodySide, legsSideStepR),
    },
    back: {
      idle:  make(hair.back, drawBodyBack, legsBackIdle),
      stepL: make(hair.back, drawBodyBack, legsBackStepL),
      stepR: make(hair.back, drawBodyBack, legsBackStepR),
    },
    sitFront: (() => {
      const g = createGrid();
      const r: P = (x, y, w, h, c) => paint(g, x, y, w, h, c);
      hair.front(g, r);
      // Sitting body — arms forward, skirt spread
      r(7, 10, 2, 1, "S"); r(6, 11, 4, 1, "t");
      r(5, 12, 6, 3, "T"); r(6, 12, 4, 1, "t");
      r(4, 12, 1, 4, "S"); r(11, 12, 1, 4, "S"); // arms reaching
      r(4, 15, 1, 1, "s"); r(11, 15, 1, 1, "s");
      // Seated skirt — wider spread
      r(5, 15, 6, 1, "P"); r(4, 16, 8, 1, "P"); r(3, 17, 10, 1, "P");
      // Thighs (seated, horizontal)
      r(4, 18, 3, 1, "S"); r(9, 18, 3, 1, "S");
      // Lower legs (hanging down)
      r(4, 19, 2, 2, "S"); r(10, 19, 2, 2, "S");
      // Shoes
      r(4, 21, 2, 2, "B"); r(10, 21, 2, 2, "B");
      return toFrame(g);
    })(),
    sitBack: (() => {
      const g = createGrid();
      const r: P = (x, y, w, h, c) => paint(g, x, y, w, h, c);
      hair.back(g, r);
      r(7, 10, 2, 1, "s"); r(6, 11, 4, 1, "t");
      r(5, 12, 6, 3, "T"); r(6, 12, 4, 1, "t");
      r(4, 12, 1, 4, "T"); r(11, 12, 1, 4, "T");
      r(5, 15, 6, 1, "P"); r(4, 16, 8, 1, "P"); r(3, 17, 10, 1, "P");
      r(4, 18, 3, 1, "S"); r(9, 18, 3, 1, "S");
      r(4, 19, 2, 2, "S"); r(10, 19, 2, 2, "S");
      r(4, 21, 2, 2, "B"); r(10, 21, 2, 2, "B");
      return toFrame(g);
    })(),
  };
}

// Build per-character sprite sets
const CHAR_SPRITES: Record<string, SpriteSet> = {};
for (const [id, style] of Object.entries(HAIR_STYLES)) {
  CHAR_SPRITES[id] = buildSpriteSet(style);
}

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
    M: "#c06060",
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
  for (let row = 0; row < SH; row++) {
    const line = frame[row];
    let col = 0;
    while (col < SW) {
      const ch = line[col];
      if (ch === ".") { col++; continue; }
      const color = colors[ch];
      if (!color) { col++; continue; }
      let runLen = 1;
      while (col + runLen < SW && line[col + runLen] === ch) runLen++;
      ctx.fillStyle = color;
      const px = mirror ? (SW - 1 - (col + runLen - 1)) : col;
      ctx.fillRect(
        Math.round(bx + (px - AX) * zoom),
        Math.round(by + (row - AY) * zoom),
        Math.max(1, Math.round(runLen * zoom)),
        Math.max(1, Math.round(zoom)),
      );
      col += runLen;
    }
  }
}

/* ── Char class ─────────────────────────────────────────────── */

// Sitting offset — pushes character down into chair visually
const SITTING_OFFSET = 4;

export class Char {
  x: number; y: number; tx: number; ty: number;
  dir: Dir; walkFrame = 0; frameTimer = 0; wanderTimer = 0;
  atDesk = true; isWorking = false;
  activity: string | null = null;
  readonly pal: Pal; readonly zone: DeskZone;
  readonly sprites: SpriteSet;
  path: [number, number][] | null = null;
  pathIdx = 0; idleSince = 0;
  breathPhase: number; blinkTimer: number; isBlinking = false;

  constructor(readonly zoneId: string) {
    this.zone = DESK_ZONES.find(z => z.id === zoneId)!;
    this.pal = CHAR_PALETTES[zoneId];
    this.sprites = CHAR_SPRITES[zoneId];
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
      this.x = this.tx; this.y = this.ty; this.walkFrame = 0;
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
      // Walk cycle: 4 steps — stepL(0) → idle(1) → stepR(2) → idle(3)
      this.frameTimer += dt;
      if (this.frameTimer > 0.15) {
        this.walkFrame = (this.walkFrame + 1) % 4;
        this.frameTimer = 0;
      }
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
  const sitting = ch.atDesk;
  // Sitting offset — push character DOWN into the chair
  const sittingOff = sitting ? SITTING_OFFSET : 0;
  const by = panY + (ch.y + sittingOff) * zoom;
  const colors = getPalColors(ch.pal);
  const isMoving = Math.hypot(ch.x - ch.tx, ch.y - ch.ty) > 1;

  // Blink
  const drawColors = { ...colors };
  if (ch.isBlinking) {
    drawColors.W = ch.pal.skin;
    drawColors.E = lighten(ch.pal.skin, -20);
  }

  // Breathing bob
  const breathOff = sitting ? 0 : Math.sin(ch.breathPhase) * 0.3;

  // Shadow
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(bx, panY + (ch.y + sittingOff) * zoom + zoom, zoom * 6, zoom * 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Select sprite frame
  const sp = ch.sprites;
  let frame: string[];
  let mirror = false;

  if (sitting) {
    frame = ch.dir === "up" ? sp.sitBack : sp.sitFront;
  } else if (isMoving) {
    // Walk cycle: [stepL, idle, stepR, idle]
    const walkCycle = [0, 1, 2, 1]; // 0=stepL, 1=idle, 2=stepR
    const cycleIdx = walkCycle[ch.walkFrame];
    const dirFrames = ch.dir === "down" ? sp.front
      : ch.dir === "up" ? sp.back : sp.side;
    if (ch.dir === "left") mirror = true;
    frame = cycleIdx === 0 ? dirFrames.stepL
      : cycleIdx === 2 ? dirFrames.stepR
      : dirFrames.idle;
  } else {
    if (ch.dir === "down") frame = sp.front.idle;
    else if (ch.dir === "up") frame = sp.back.idle;
    else { frame = sp.side.idle; mirror = ch.dir === "left"; }
  }

  renderSprite(ctx, frame, drawColors, bx, by + breathOff * zoom, zoom, mirror);

  // Activity / state bubble
  const showActivity = !ch.isWorking && ch.activity && !ch.atDesk;
  const showState = ch.isWorking;
  const bubbleLabel = showState ? "WORKING"
    : showActivity ? ch.activity!.slice(0, 20) : null;

  if (bubbleLabel) {
    const lby = by - 26 * zoom;
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
    const nby = by - (bubbleLabel ? 44 : 26) * zoom;
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
