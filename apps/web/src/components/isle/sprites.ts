import type { Dir, DeskZone } from "./types";
import {
  TS, DESK_ZONES, BREAK_SPOTS, OUTDOOR_SPOTS, BENCHES,
  SOFA_SPOTS, RIVER_START_ROW,
  ACTIVITIES_OUTDOOR, ACTIVITIES_BREAK, ACTIVITIES_BENCH, ACTIVITIES_SOFA,
  inPond, seededRng, findPath,
} from "./world";

/* ── PNG sprite sheet system with per-zone base + palette swap ── */
// Each zone uses a DIFFERENT base sprite for unique hair/silhouette,
// then palette-swaps colours to match the zone aesthetic.
// Layout: 112×96 = 7 cols × 3 rows of 16×32 frames
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

/* ── Palette swap system ───────────────────────────────────── */

type RGB = [number, number, number];
interface PaletteMap {
  hair: RGB[];
  shirt: RGB[];
  skin: RGB[];
  pants: RGB[];
}

// Per-sprite source palettes (extracted from each PNG via PIL)
const SRC_PALETTES: Record<string, PaletteMap> = {
  // char_3: silver/white hair, grey shirt, medium skin — LUNA girl
  char_3: {
    hair: [[240, 225, 222], [218, 204, 201], [191, 182, 179], [176, 166, 163]],
    shirt: [[238, 238, 238], [212, 212, 212], [189, 189, 189]],
    skin: [[182, 115, 82], [140, 88, 63]],
    pants: [[76, 76, 76], [53, 53, 53]],
  },
  // char_1: orange/brown hair, warm tones — CASTER girl
  char_1: {
    hair: [[227, 159, 90], [190, 119, 67], [126, 75, 41]],
    shirt: [[238, 238, 238], [212, 212, 212], [189, 189, 189]],
    skin: [[233, 163, 132], [226, 152, 120], [197, 137, 110]],
    pants: [[37, 37, 37], [26, 26, 26], [16, 16, 16]],
  },
  // char_4: brown hair, white shirt, peach skin — DEV girl
  char_4: {
    hair: [[105, 69, 27], [87, 53, 26], [67, 36, 21], [47, 22, 15]],
    shirt: [[255, 255, 255], [238, 238, 238], [212, 212, 212], [189, 189, 189]],
    skin: [[233, 163, 132], [226, 152, 120], [197, 137, 110]],
    pants: [[76, 76, 76], [73, 62, 56], [53, 53, 53]],
  },
  // char_0: dark brown hair, blue shirt, warm skin — META girl
  char_0: {
    hair: [[143, 100, 57], [177, 134, 73], [109, 71, 38], [109, 74, 42]],
    shirt: [[17, 73, 120], [15, 64, 106]],
    skin: [[233, 163, 132], [226, 152, 120], [197, 137, 110]],
    pants: [[73, 62, 56], [53, 53, 53]],
  },
};

// Zone → which base sprite + target palette
interface ZoneCharConfig {
  base: string;   // sprite filename (e.g. "char_3")
  target: PaletteMap;
}

const ZONE_CONFIGS: Record<string, ZoneCharConfig> = {
  lunary: {
    base: "char_3",
    target: {
      hair: [[130, 80, 180], [110, 60, 160], [90, 40, 140], [70, 25, 110]],
      shirt: [[200, 160, 230], [170, 120, 200], [140, 90, 175]],
      skin: [[240, 210, 190], [210, 175, 155]],
      pants: [[60, 45, 75], [38, 28, 50]],
    },
  },
  spellcast: {
    base: "char_1",
    target: {
      hair: [[210, 70, 55], [175, 50, 40], [130, 32, 25]],
      shirt: [[80, 210, 210], [50, 180, 185], [30, 150, 155]],
      skin: [[220, 175, 140], [205, 160, 125], [185, 140, 108]],
      pants: [[45, 45, 45], [30, 30, 30], [20, 20, 20]],
    },
  },
  dev: {
    base: "char_4",
    target: {
      hair: [[50, 50, 50], [38, 38, 38], [28, 28, 28], [18, 18, 18]],
      shirt: [[100, 180, 100], [75, 155, 75], [55, 130, 55], [40, 110, 40]],
      skin: [[160, 105, 68], [145, 92, 58], [125, 78, 48]],
      pants: [[85, 115, 155], [72, 100, 138], [58, 85, 120]],
    },
  },
  meta: {
    base: "char_0",
    target: {
      hair: [[235, 200, 80], [215, 178, 55], [195, 158, 40], [170, 138, 30]],
      shirt: [[245, 140, 185], [215, 85, 145]],
      skin: [[215, 180, 140], [200, 165, 125], [180, 145, 108]],
      pants: [[130, 130, 130], [90, 90, 90]],
    },
  },
};

function colorDist(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return (r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2;
}

function classifyPixel(
  r: number, g: number, b: number,
  srcPalette: PaletteMap,
): { cat: keyof PaletteMap; idx: number } | null {
  let bestCat: keyof PaletteMap | null = null;
  let bestIdx = 0;
  let bestDist = 2500;

  for (const cat of ["hair", "shirt", "skin", "pants"] as (keyof PaletteMap)[]) {
    const palette = srcPalette[cat];
    for (let i = 0; i < palette.length; i++) {
      const [pr, pg, pb] = palette[i];
      const d = colorDist(r, g, b, pr, pg, pb);
      if (d < bestDist) {
        bestDist = d;
        bestCat = cat;
        bestIdx = i;
      }
    }
  }

  return bestCat ? { cat: bestCat, idx: bestIdx } : null;
}

function createPaletteSwappedSheet(
  baseImg: HTMLImageElement,
  srcPalette: PaletteMap,
  targetPalette: PaletteMap,
): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = baseImg.naturalWidth;
  cv.height = baseImg.naturalHeight;
  const ctx = cv.getContext("2d")!;
  ctx.drawImage(baseImg, 0, 0);

  const imgData = ctx.getImageData(0, 0, cv.width, cv.height);
  const d = imgData.data;

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;

    const match = classifyPixel(d[i], d[i + 1], d[i + 2], srcPalette);
    if (match) {
      const target = targetPalette[match.cat];
      const idx = Math.min(match.idx, target.length - 1);
      d[i] = target[idx][0];
      d[i + 1] = target[idx][1];
      d[i + 2] = target[idx][2];
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return cv;
}

/* ── Sheet loading + palette swap cache ────────────────────── */

const _baseSheets: Record<string, HTMLImageElement> = {};
const _swappedSheets: Record<string, HTMLCanvasElement> = {};
let _loadStarted = false;

function loadAllSheets() {
  if (_loadStarted) return;
  if (typeof window === "undefined") return;
  _loadStarted = true;

  // Collect unique base sprites needed
  const basesNeeded = new Set<string>();
  for (const cfg of Object.values(ZONE_CONFIGS)) {
    basesNeeded.add(cfg.base);
  }

  for (const baseName of basesNeeded) {
    const img = new Image();
    img.src = `/sprites/characters/${baseName}.png`;
    _baseSheets[baseName] = img;
    img.onload = () => {
      // Generate swapped sheets for all zones using this base
      for (const [zoneId, cfg] of Object.entries(ZONE_CONFIGS)) {
        if (cfg.base !== baseName) continue;
        const srcPalette = SRC_PALETTES[baseName];
        if (!srcPalette) continue;
        _swappedSheets[zoneId] = createPaletteSwappedSheet(img, srcPalette, cfg.target);
      }
    };
  }
}

// Eagerly start loading
loadAllSheets();

function getSheet(zoneId: string): HTMLImageElement | HTMLCanvasElement {
  if (_swappedSheets[zoneId]) return _swappedSheets[zoneId];
  // Fall back to unswapped base while loading
  const cfg = ZONE_CONFIGS[zoneId];
  if (cfg && _baseSheets[cfg.base]) return _baseSheets[cfg.base];
  return {} as HTMLImageElement;
}

/* ── Char class ─────────────────────────────────────────────── */

export class Char {
  x: number; y: number; tx: number; ty: number;
  dir: Dir; walkFrame = 0; frameTimer = 0; wanderTimer = 0;
  atDesk = true; isWorking = false;
  activity: string | null = null;
  onSofa = false;
  typingTimer = 0;
  typingFrame = 0;
  readonly zone: DeskZone;
  path: [number, number][] | null = null;
  pathIdx = 0; idleSince = 0;

  constructor(readonly zoneId: string) {
    this.zone = DESK_ZONES.find(z => z.id === zoneId)!;
    this.x = this.zone.seatX; this.y = this.zone.seatY;
    this.tx = this.x; this.ty = this.y;
    this.dir = this.zone.facing;
    const r = seededRng(zoneId);
    this.wanderTimer = 3 + r() * 5;
  }

  update(dt: number) {
    // Typing animation timer
    if (this.isWorking && this.atDesk) {
      this.typingTimer += dt;
      if (this.typingTimer > 0.4) {
        this.typingTimer = 0;
        this.typingFrame = this.typingFrame === 0 ? 1 : 0;
      }
    }

    if (this.isWorking && !this.atDesk) {
      this.setTarget(this.zone.seatX, this.zone.seatY);
      this.onSofa = false;
    }

    const dist = Math.hypot(this.x - this.tx, this.y - this.ty);

    if (dist < 1) {
      this.x = this.tx; this.y = this.ty; this.walkFrame = 0;
      if (this.isWorking) {
        this.atDesk = true; this.dir = this.zone.facing;
        this.activity = null; this.onSofa = false; return;
      }
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 5 + Math.random() * 10;
        if (this.atDesk) {
          const allSpots = [...BREAK_SPOTS, ...OUTDOOR_SPOTS, ...SOFA_SPOTS];
          let px = 0, py = 0;
          do {
            const p = allSpots[Math.floor(Math.random() * allSpots.length)];
            px = p[0] + (Math.random() - 0.5) * TS;
            py = p[1] + (Math.random() - 0.5) * TS;
          } while (inPond(px, py));
          this.setTarget(px, py);
          this.atDesk = false; this.activity = null; this.onSofa = false;
        } else {
          if (Math.random() < 0.3) {
            this.setTarget(this.zone.seatX, this.zone.seatY);
            this.onSofa = false;
          } else {
            const allSpots = [...BREAK_SPOTS, ...OUTDOOR_SPOTS, ...SOFA_SPOTS];
            let px = 0, py = 0;
            do {
              const p = allSpots[Math.floor(Math.random() * allSpots.length)];
              px = p[0] + (Math.random() - 0.5) * TS;
              py = p[1] + (Math.random() - 0.5) * TS;
            } while (inPond(px, py));
            this.setTarget(px, py);
            this.onSofa = false;
          }
          this.activity = null;
        }
      }
      if (!this.atDesk && dist < 1 && !this.activity) {
        const nearSofa = SOFA_SPOTS.some(
          (s) => Math.hypot(this.x - s[0], this.y - s[1]) < 20,
        );
        const nearBench = BENCHES.some(
          (b: { tx: number; ty: number }) => Math.hypot(this.x - b.tx * TS, this.y - b.ty * TS) < 24,
        );
        const nearBreak = this.x < 6 * TS && this.y > 10 * TS;
        const nearRiver = Math.floor(this.y / TS) >= RIVER_START_ROW - 2;

        if (nearSofa) {
          this.activity = ACTIVITIES_SOFA[Math.floor(Math.random() * ACTIVITIES_SOFA.length)];
          this.onSofa = true;
          this.dir = "down";
        } else if (nearBench) {
          this.activity = ACTIVITIES_BENCH[Math.floor(Math.random() * ACTIVITIES_BENCH.length)];
        } else if (nearBreak) {
          this.activity = ACTIVITIES_BREAK[Math.floor(Math.random() * ACTIVITIES_BREAK.length)];
        } else if (nearRiver && Math.random() < 0.4) {
          this.activity = "fishing";
        } else {
          this.activity = ACTIVITIES_OUTDOOR[Math.floor(Math.random() * ACTIVITIES_OUTDOOR.length)];
        }
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
        this.tx = this.x; this.ty = this.y;
        this.walkFrame = 0;
        return;
      }
      this.frameTimer += dt;
      if (this.frameTimer > 0.15) {
        this.walkFrame = (this.walkFrame + 1) % 4;
        this.frameTimer = 0;
      }
      this.activity = null;
      this.onSofa = false;
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
  const sheet = getSheet(ch.zoneId);
  // Check if the sheet is ready (works for both Image and Canvas)
  if (sheet instanceof HTMLImageElement && (!sheet.complete || !sheet.naturalWidth)) return;
  if (sheet instanceof HTMLCanvasElement && !sheet.width) return;

  const sitting = ch.atDesk || ch.onSofa;
  const sittingOff = sitting ? SITTING_OFFSET : 0;
  const isMoving = Math.hypot(ch.x - ch.tx, ch.y - ch.ty) > 1;

  // Determine which frame to draw
  const row = DIR_ROW[ch.dir];
  let col: number;

  if (isMoving) {
    col = WALK_CYCLE[ch.walkFrame];
  } else if (ch.isWorking && ch.atDesk) {
    col = 4 + ch.typingFrame;
  } else if (ch.activity === "reading") {
    col = 6;
  } else {
    col = 0;
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
  const worldBottom = panY + 14 * TS * zoom;
  if (shadowY < worldBottom) {
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(panX + ch.x * zoom, shadowY, zoom * 5, zoom * 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Draw sprite — handle mirroring for left direction
  const mirror = ch.dir === "left";

  if (mirror) {
    ctx.save();
    ctx.translate(Math.round(drawX + drawW), Math.round(drawY));
    ctx.scale(-1, 1);
    ctx.drawImage(sheet, sx, sy, FRAME_W, FRAME_H, 0, 0, Math.round(drawW), Math.round(drawH));
    ctx.restore();
  } else {
    ctx.drawImage(sheet, sx, sy, FRAME_W, FRAME_H, Math.round(drawX), Math.round(drawY), Math.round(drawW), Math.round(drawH));
  }

  // --- Activity visual indicators ---
  const bx = panX + ch.x * zoom;
  const charTopY = drawY;

  if (!isMoving && ch.activity && !ch.isWorking) {
    drawActivityVisual(ctx, ch, zoom, bx, charTopY);
  }

  // Activity / state bubble
  const showActivity = !ch.isWorking && ch.activity && !ch.atDesk;
  const showState = ch.isWorking;
  const bubbleLabel = showState ? "WORKING"
    : showActivity ? ch.activity!.slice(0, 20) : null;

  const by = charTopY;

  if (bubbleLabel) {
    const lby = by - 4 * zoom;
    const bCol = showState ? ch.zone.monitorGlow : "rgba(60,40,80,0.85)";
    ctx.font = `${Math.max(9, Math.round(9 * zoom / 2))}px 'Courier New',monospace`;
    ctx.textAlign = "center";
    const tw = ctx.measureText(bubbleLabel).width;
    ctx.fillStyle = bCol;
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

/* ── Activity visual indicators ────────────────────────────── */

function drawActivityVisual(
  ctx: CanvasRenderingContext2D,
  ch: Char,
  zoom: number,
  bx: number,
  topY: number,
) {
  const time = Date.now() / 1000;
  const sz = zoom;

  switch (ch.activity) {
    case "stargazing": {
      const tx = bx + 6 * sz;
      const ty = topY + 8 * sz;
      ctx.strokeStyle = "#8a7050";
      ctx.lineWidth = Math.max(1, sz);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + 4 * sz, ty - 6 * sz);
      ctx.stroke();
      ctx.fillStyle = "#60a0c0";
      ctx.beginPath();
      ctx.arc(tx + 4 * sz, ty - 6 * sz, 1.5 * sz, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case "fishing": {
      const rx = bx + 3 * sz;
      const ry = topY + 6 * sz;
      ctx.strokeStyle = "#8a6030";
      ctx.lineWidth = Math.max(1, sz * 0.7);
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + 8 * sz, ry - 10 * sz);
      ctx.stroke();
      ctx.strokeStyle = "#c0c0c0";
      ctx.lineWidth = Math.max(0.5, sz * 0.3);
      ctx.beginPath();
      ctx.moveTo(rx + 8 * sz, ry - 10 * sz);
      const bobY = ry + 10 * sz + Math.sin(time * 2) * 2 * sz;
      ctx.lineTo(rx + 10 * sz, bobY);
      ctx.stroke();
      ctx.fillStyle = "#e04040";
      ctx.beginPath();
      ctx.arc(rx + 10 * sz, bobY, sz, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case "scrolling": {
      const px = bx - 1 * sz;
      const py = topY + 18 * sz;
      ctx.fillStyle = "#2a2a30";
      ctx.fillRect(px, py, 3 * sz, 4 * sz);
      ctx.fillStyle = "#4060a0";
      ctx.fillRect(px + 0.5 * sz, py + 0.5 * sz, 2 * sz, 3 * sz);
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillRect(px + 0.5 * sz, py + 0.5 * sz, 1 * sz, 0.5 * sz);
      break;
    }

    case "stretching": {
      ctx.strokeStyle = ch.zone.monitorGlow;
      ctx.lineWidth = Math.max(1, sz * 0.7);
      ctx.beginPath();
      ctx.moveTo(bx - 3 * sz, topY + 4 * sz);
      ctx.lineTo(bx - 4 * sz, topY - 2 * sz);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bx + 3 * sz, topY + 4 * sz);
      ctx.lineTo(bx + 4 * sz, topY - 2 * sz);
      ctx.stroke();
      break;
    }

    case "napping": {
      const zx = bx + 4 * sz;
      const zy = topY - 2 * sz;
      ctx.font = `bold ${Math.max(8, Math.round(8 * sz))}px sans-serif`;
      ctx.fillStyle = `rgba(180,180,220,${0.5 + 0.3 * Math.sin(time * 2)})`;
      ctx.textAlign = "left";
      ctx.fillText("z", zx, zy);
      ctx.font = `bold ${Math.max(6, Math.round(6 * sz))}px sans-serif`;
      ctx.fillText("z", zx + 3 * sz, zy - 4 * sz);
      ctx.font = `bold ${Math.max(5, Math.round(5 * sz))}px sans-serif`;
      ctx.fillText("z", zx + 5 * sz, zy - 7 * sz);
      ctx.textAlign = "left";
      break;
    }
  }
}
