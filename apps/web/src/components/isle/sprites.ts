import type { Dir, DeskZone } from "./types";
import {
  TS, DESK_ZONES, BREAK_SPOTS, OUTDOOR_SPOTS, BENCHES,
  ACTIVITIES_OUTDOOR, ACTIVITIES_BREAK, ACTIVITIES_BENCH,
  inPond, seededRng, findPath,
} from "./world";

/* ── PNG sprite sheet system ─────────────────────────────────── */
// Character sprites from pixel-agents (JIK-A-4 Metro City, CC0)
// Each sheet: 112×96 = 7 cols × 3 rows of 16×32 frames
// Row 0: DOWN   Row 1: UP   Row 2: RIGHT (LEFT = mirrored RIGHT)
// Col 0: idle   Col 1-3: walk   Col 4-5: typing   Col 6: reading

const FRAME_W = 16;
const FRAME_H = 32;

// Direction → spritesheet row
const DIR_ROW: Record<Dir, number> = {
  down: 0, up: 1, right: 2, left: 2,
};

// Walk animation: cycle through [idle, walk1, walk2, walk1]
const WALK_CYCLE = [0, 1, 2, 1];

// Sitting offset — pushes character down into chair visually
const SITTING_OFFSET = 6;

// Character → spritesheet assignment
const CHAR_SHEETS: Record<string, string> = {
  lunary: "/sprites/characters/char_0.png",
  spellcast: "/sprites/characters/char_1.png",
  dev: "/sprites/characters/char_2.png",
  meta: "/sprites/characters/char_3.png",
};

// Shared image cache
const sheetCache: Record<string, HTMLImageElement> = {};

function loadSheet(src: string): HTMLImageElement {
  if (sheetCache[src]) return sheetCache[src];
  if (typeof window === "undefined") return {} as HTMLImageElement;
  const img = new Image();
  img.src = src;
  sheetCache[src] = img;
  return img;
}

// Pre-load all character sheets
for (const src of Object.values(CHAR_SHEETS)) loadSheet(src);

/* ── Char class ─────────────────────────────────────────────── */

export class Char {
  x: number; y: number; tx: number; ty: number;
  dir: Dir; walkFrame = 0; frameTimer = 0; wanderTimer = 0;
  atDesk = true; isWorking = false;
  activity: string | null = null;
  readonly zone: DeskZone;
  readonly sheet: HTMLImageElement;
  path: [number, number][] | null = null;
  pathIdx = 0; idleSince = 0;

  constructor(readonly zoneId: string) {
    this.zone = DESK_ZONES.find(z => z.id === zoneId)!;
    this.sheet = loadSheet(CHAR_SHEETS[zoneId] ?? CHAR_SHEETS.lunary);
    this.x = this.zone.seatX; this.y = this.zone.seatY;
    this.tx = this.x; this.ty = this.y;
    this.dir = this.zone.facing;
    const r = seededRng(zoneId);
    this.wanderTimer = 3 + r() * 5;
  }

  update(dt: number) {
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
            this.x = this.tx; this.y = this.ty; this.path = null; this.walkFrame = 0; return;
          }
        }
        const dx = wx - this.x; const dy = wy - this.y;
        const step = Math.min(nd, 28 * dt);
        this.x += (dx / nd) * step; this.y += (dy / nd) * step;
        this.dir = Math.abs(dx) > Math.abs(dy)
          ? (dx > 0 ? "right" : "left")
          : (dy > 0 ? "down" : "up");
      } else {
        // No valid path — cancel movement instead of clipping through obstacles
        this.tx = this.x; this.ty = this.y;
        this.walkFrame = 0;
        return;
      }
      // Walk cycle: 4 steps — stepL → idle → stepR → idle
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
  const sheet = ch.sheet;
  if (!sheet.complete || !sheet.naturalWidth) return; // not loaded yet

  const sitting = ch.atDesk;
  const sittingOff = sitting ? SITTING_OFFSET : 0;
  const isMoving = Math.hypot(ch.x - ch.tx, ch.y - ch.ty) > 1;

  // Determine which frame to draw
  const row = DIR_ROW[ch.dir];
  let col: number;

  if (isMoving) {
    col = WALK_CYCLE[ch.walkFrame];
  } else {
    col = 0; // idle — always return to neutral standing/sitting pose
  }

  // Source rect from spritesheet
  const sx = col * FRAME_W;
  const sy = row * FRAME_H;

  // Destination — anchor at centre-bottom of sprite
  const drawW = FRAME_W * zoom;
  const drawH = FRAME_H * zoom;
  const drawX = panX + ch.x * zoom - drawW / 2;
  const drawY = panY + (ch.y + sittingOff) * zoom - drawH;

  // Shadow
  const shadowY = panY + (ch.y + sittingOff) * zoom;
  // Only draw shadow if within world bounds
  const worldBottom = panY + 14 * TS * zoom;
  if (shadowY < worldBottom) {
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(
      panX + ch.x * zoom,
      shadowY,
      zoom * 5, zoom * 1.5, 0, 0, Math.PI * 2,
    );
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Draw sprite — handle mirroring for left direction
  const mirror = ch.dir === "left";

  if (mirror) {
    ctx.save();
    ctx.translate(Math.round(drawX + drawW), Math.round(drawY));
    ctx.scale(-1, 1);
    ctx.drawImage(
      sheet,
      sx, sy, FRAME_W, FRAME_H,
      0, 0, Math.round(drawW), Math.round(drawH),
    );
    ctx.restore();
  } else {
    ctx.drawImage(
      sheet,
      sx, sy, FRAME_W, FRAME_H,
      Math.round(drawX), Math.round(drawY),
      Math.round(drawW), Math.round(drawH),
    );
  }

  // Activity / state bubble
  const showActivity = !ch.isWorking && ch.activity && !ch.atDesk;
  const showState = ch.isWorking;
  const bubbleLabel = showState ? "WORKING"
    : showActivity ? ch.activity!.slice(0, 20) : null;

  const bx = panX + ch.x * zoom;
  const by = drawY;

  if (bubbleLabel) {
    const lby = by - 4 * zoom;
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
    const nby = by - (bubbleLabel ? 18 : 4) * zoom;
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
