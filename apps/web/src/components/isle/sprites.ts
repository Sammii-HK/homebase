import type { Dir, Pal, DeskZone } from "./types";
import {
  TS, DESK_ZONES, BREAK_SPOTS, OUTDOOR_SPOTS, BENCHES,
  ACTIVITIES_OUTDOOR, ACTIVITIES_BREAK, ACTIVITIES_BENCH,
  inPond, seededRng, findPath, WALKABLE, WORLD_COLS, WORLD_ROWS
} from "./world";

/* ── Themed character palettes ──────────────────────────────── */

export const CHAR_PALETTES: Record<string, Pal> = {
  lunary: {
    skin: "#f5c9a0",
    hair: "#600890",
    shirt: "#8058d0",
    pants: "#284880",
    shoe: "#1a1008",
  },
  spellcast: {
    skin: "#f0b888",
    hair: "#282880",
    shirt: "#40b0a0",
    pants: "#1a3830",
    shoe: "#101018",
  },
  dev: {
    skin: "#f0b888",
    hair: "#204808",
    shirt: "#30b878",
    pants: "#2a4828",
    shoe: "#101008",
  },
  meta: {
    skin: "#f5c9a0",
    hair: "#a01020",
    shirt: "#f06898",
    pants: "#380028",
    shoe: "#280808",
  },
};

/* ── Char class ─────────────────────────────────────────────── */

export class Char {
  x: number;
  y: number;
  tx: number;
  ty: number;
  dir: Dir;
  frame = 0;
  frameTimer = 0;
  wanderTimer = 0;
  atDesk = true;
  isWorking = false;
  activity: string | null = null;
  readonly pal: Pal;
  readonly zone: DeskZone;
  path: [number, number][] | null = null;
  pathIdx = 0;
  idleSince = 0;

  constructor(readonly zoneId: string) {
    this.zone = DESK_ZONES.find(z => z.id === zoneId)!;
    this.pal = CHAR_PALETTES[zoneId];
    this.x = this.zone.seatX;
    this.y = this.zone.seatY;
    this.tx = this.x;
    this.ty = this.y;
    this.dir = this.zone.facing;
    const r = seededRng(zoneId);
    this.wanderTimer = 3 + r() * 5;
  }

  update(dt: number) {
    // If working, go to desk
    if (this.isWorking && !this.atDesk) {
      this.setTarget(this.zone.seatX, this.zone.seatY);
    }

    const dist = Math.hypot(this.x - this.tx, this.y - this.ty);

    if (dist < 1) {
      // Arrived at target
      this.x = this.tx;
      this.y = this.ty;
      this.frame = 0;

      if (this.isWorking) {
        this.atDesk = true;
        this.dir = this.zone.facing;
        this.activity = null;
        return;
      }

      // Idle wandering
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 5 + Math.random() * 10;
        if (this.atDesk) {
          // Leave desk — pick spot with random offset to avoid stacking
          const allSpots = [...BREAK_SPOTS, ...OUTDOOR_SPOTS];
          let px = 0, py = 0;
          do {
            const p = allSpots[Math.floor(Math.random() * allSpots.length)];
            px = p[0] + (Math.random() - 0.5) * TS;
            py = p[1] + (Math.random() - 0.5) * TS;
          } while (inPond(px, py));
          this.setTarget(px, py);
          this.atDesk = false;
          this.activity = null;
        } else {
          const r = Math.random();
          if (r < 0.3) {
            // Return to desk
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

      // Assign activity when stationary and away from desk
      if (!this.atDesk && dist < 1 && !this.activity) {
        const nearBench = BENCHES.some(
          (b: { tx: number; ty: number }) => Math.hypot(this.x - b.tx * TS, this.y - b.ty * TS) < 24
        );
        const nearBreak = this.x < 6 * TS && this.y > 10 * TS;
        if (nearBench) {
          this.activity = ACTIVITIES_BENCH[Math.floor(Math.random() * ACTIVITIES_BENCH.length)];
        } else if (nearBreak) {
          this.activity = ACTIVITIES_BREAK[Math.floor(Math.random() * ACTIVITIES_BREAK.length)];
        } else {
          this.activity = ACTIVITIES_OUTDOOR[Math.floor(Math.random() * ACTIVITIES_OUTDOOR.length)];
        }
      }
    } else {
      // Moving -- follow path if we have one
      if (this.path && this.pathIdx < this.path.length) {
        const [ntx, nty] = this.path[this.pathIdx];
        const wx = ntx * TS + TS / 2;
        const wy = nty * TS + TS / 2;
        const nd = Math.hypot(this.x - wx, this.y - wy);
        if (nd < 2) {
          this.pathIdx++;
          if (this.pathIdx >= this.path.length) {
            this.x = this.tx;
            this.y = this.ty;
            this.path = null;
            return;
          }
        }
        const dx = wx - this.x;
        const dy = wy - this.y;
        const step = Math.min(nd, 28 * dt);
        this.x += (dx / nd) * step;
        this.y += (dy / nd) * step;
        this.dir = Math.abs(dx) > Math.abs(dy)
          ? (dx > 0 ? "right" : "left")
          : (dy > 0 ? "down" : "up");
      } else {
        // No path, move directly (fallback)
        const dx = this.tx - this.x;
        const dy = this.ty - this.y;
        const step = Math.min(dist, 28 * dt);
        this.x += (dx / dist) * step;
        this.y += (dy / dist) * step;
        this.dir = Math.abs(dx) > Math.abs(dy)
          ? (dx > 0 ? "right" : "left")
          : (dy > 0 ? "down" : "up");
      }
      this.frameTimer += dt;
      if (this.frameTimer > 0.18) {
        this.frame = 1 - this.frame;
        this.frameTimer = 0;
      }
      this.activity = null;
    }
  }

  private setTarget(px: number, py: number) {
    this.tx = px;
    this.ty = py;
    // Try BFS pathfinding
    const fromTX = Math.floor(this.x / TS);
    const fromTY = Math.floor(this.y / TS);
    const toTX = Math.floor(px / TS);
    const toTY = Math.floor(py / TS);
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
  panY: number
) {
  const p = ch.pal;
  const ps = zoom;
  const bx = panX + ch.x * zoom;
  const by = panY + ch.y * zoom;

  function px2(lx: number, ly: number, w: number, h: number, col: string) {
    ctx.fillStyle = col;
    ctx.fillRect(
      Math.round(bx + (lx - 6) * ps),
      Math.round(by + (ly - 20) * ps),
      Math.max(1, Math.round(w * ps)),
      Math.max(1, Math.round(h * ps))
    );
  }

  function lighten(hex: string, amt: number): string {
    const n = parseInt(hex.replace("#", ""), 16);
    const cl = (v: number) => Math.max(0, Math.min(255, v));
    return `rgb(${cl((n >> 16) + amt)},${cl(((n >> 8) & 255) + amt)},${cl((n & 255) + amt)})`;
  }

  const walk = ch.frame === 1 && Math.hypot(ch.x - ch.tx, ch.y - ch.ty) > 1;
  const ls = walk ? 1 : 0;

  // Sitting pose when at desk and working
  const sitting = ch.atDesk && ch.isWorking;

  // Shadow
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(bx, by - ps * 0.5, ps * 5, ps * 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  if (sitting) {
    // Sitting pose -- legs bent, body lower
    // Shoes (flat, together)
    px2(3, 17, 3, 2, p.shoe); px2(7, 17, 3, 2, p.shoe);
    // Shorter legs (bent at knee)
    px2(4, 14, 2, 3, p.pants); px2(7, 14, 2, 3, p.pants);
    // Horizontal thigh
    px2(3, 13, 7, 2, p.pants);
    // Body
    px2(2, 5, 9, 8, p.shirt); px2(3, 4, 7, 2, p.shirt);
    // Arms resting on desk
    if (ch.dir === "left" || ch.dir === "right") {
      const ax = ch.dir === "left" ? 10 : 1;
      px2(ax, 6, 2, 5, p.skin); px2(ax, 10, 2, 2, p.skin);
    } else {
      px2(1, 6, 2, 5, p.skin); px2(10, 6, 2, 5, p.skin);
      px2(1, 10, 2, 2, p.skin); px2(10, 10, 2, 2, p.skin);
    }
  } else {
    // Standing/walking pose
    const ud = ch.dir === "down" || ch.dir === "up";
    // Shoes
    if (ud) { px2(3, 19 + ls, 3, 2, p.shoe); px2(7, 19 - ls, 3, 2, p.shoe); }
    else { px2(4, 19, 4, 2, p.shoe); }
    // Legs
    if (ud) { px2(4, 14 + ls, 2, 5, p.pants); px2(7, 14 - ls, 2, 5, p.pants); }
    else { px2(4, 14, 4, 5, p.pants); }
    // Body
    px2(2, 7, 9, 8, p.shirt); px2(3, 6, 7, 2, p.shirt);
    // Arms
    if (ch.dir === "left" || ch.dir === "right") {
      const ax = ch.dir === "left" ? 10 : 1;
      px2(ax, 8, 2, 5, p.skin); px2(ax, 12, 2, 2, p.skin);
    } else {
      px2(1, 8, 2, 5, p.skin); px2(10, 8, 2, 5, p.skin);
      px2(1, 12, 2, 2, p.skin); px2(10, 12, 2, 2, p.skin);
    }
  }

  // Hair behind (same for both poses)
  const yo = sitting ? -2 : 0;
  px2(2, 0 + yo, 9, 8, p.hair); px2(1, 2 + yo, 11, 7, p.hair);
  px2(2, 7 + yo, 3, 8, p.hair); px2(8, 7 + yo, 3, 8, p.hair);
  px2(3, 1 + yo, 3, 5, lighten(p.hair, 28));
  // Head
  px2(3, 1 + yo, 7, 8, p.skin); px2(2, 3 + yo, 2, 3, p.skin); px2(9, 3 + yo, 2, 3, p.skin);
  // Hair top
  px2(3, 0 + yo, 7, 3, p.hair); px2(2, 1 + yo, 9, 3, p.hair);
  if (ch.dir !== "up") { px2(4, 3 + yo, 5, 1, p.hair); px2(3, 2 + yo, 2, 1, p.hair); px2(8, 2 + yo, 2, 1, p.hair); }
  // Face
  if (ch.dir !== "up") {
    if (ch.dir === "down") {
      px2(4, 5 + yo, 2, 2, "#1a1218"); px2(7, 5 + yo, 2, 2, "#1a1218");
      px2(4, 5 + yo, 1, 1, "#fff"); px2(7, 5 + yo, 1, 1, "#fff");
      px2(3, 6 + yo, 2, 1, lighten(p.skin, -12)); px2(8, 6 + yo, 2, 1, lighten(p.skin, -12));
      px2(5, 7 + yo, 3, 1, lighten(p.skin, -22));
    } else {
      const ex = ch.dir === "left" ? 4 : 7;
      px2(ex, 5 + yo, 2, 2, "#1a1218"); px2(ex, 5 + yo, 1, 1, "#fff");
      px2(ch.dir === "left" ? 3 : 9, 7 + yo, 1, 1, lighten(p.skin, -18));
    }
  } else {
    // Back of head — full hair coverage, no neck gap
    px2(2, 3 + yo, 9, 6, p.hair);
    px2(3, 2 + yo, 7, 7, p.hair);
    // Subtle highlight for depth
    px2(4, 4 + yo, 5, 3, lighten(p.hair, 10));
    px2(5, 3 + yo, 3, 2, lighten(p.hair, 18));
  }

  // Activity / state bubble
  const showActivity = !ch.isWorking && ch.activity && !ch.atDesk;
  const showState = ch.isWorking;
  const bubbleLabel = showState
    ? "WORKING"
    : showActivity
    ? ch.activity!.slice(0, 20)
    : null;

  if (bubbleLabel) {
    const lby = by - 25 * ps;
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
    const nby = by - (bubbleLabel ? 42 : 25) * ps;
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
