// Isle canvas engine — main renderer

import type { ClickTarget, IsleStats, DeskZone, BadgeInfo } from "./types";
import {
  TS, OFFICE_COLS, WORLD_COLS, WORLD_ROWS, WORLD_W, WORLD_H,
  DOOR_ROW_START, DOOR_ROW_END,
  DESK_ZONES, FURNITURE, FLOWERS, TREES, BENCHES,
  ROCKS, BUSHES, SIGNPOST,
  getSeason, getTOD,
} from "./world";
import { drawSky, loadMoonImages, getMoonPhaseName, getWorldOverlay } from "./sky";
import {
  createDrawHelpers,
  drawOfficeFloor, drawOfficeWall, drawRightWall, drawDoor, drawGrass,
  drawDesk, drawChair, drawRug, drawSofa, drawCoffeeTable,
  drawWhiteboard, drawWhiteboardData, drawWaterCooler, drawFilingCabinet,
  drawBookshelf, drawLamp, drawPlantFurn, drawBench,
  drawWindow, drawPond, drawTree, drawFlower,
  drawPath, drawLantern, LANTERN_SPOTS, drawWindowLight, drawGrassDetail,
  drawRock, drawBush, drawSignpost,
} from "./furniture";
import { Char, drawChar } from "./sprites";
import { ParticleSystem } from "./particles";

export class IsleRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private zoom = 2;
  private targetZoom = 2;
  private panX = 0;
  private panY = 0;
  private panVelX = 0;
  private panVelY = 0;
  private zoomFocusX = 0;
  private zoomFocusY = 0;
  private animTick = 0;
  private lastTime = 0;
  private rafId = 0;
  private tickId = 0;
  private chars: Char[] = [];
  private moonImgs: Record<string, HTMLImageElement> = {};
  private moonPhase = "full-moon";
  private Astronomy: any = null;
  private stats: IsleStats | null = null;
  private drag = false;
  private dSX = 0;
  private dSY = 0;
  private pSX = 0;
  private pSY = 0;
  private lastDragX = 0;
  private lastDragY = 0;
  private keysDown = new Set<string>();
  private onClickTarget: ((target: ClickTarget) => void) | null = null;
  private destroyed = false;
  private particles: ParticleSystem;
  // Pinch-to-zoom
  private pinchDist = 0;
  private pinchMidX = 0;
  private pinchMidY = 0;

  constructor(canvas: HTMLCanvasElement, onClick: (target: ClickTarget) => void) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = false;
    this.onClickTarget = onClick;

    // Particle system
    this.particles = new ParticleSystem();

    // Create 4 permanent characters
    this.chars = [
      new Char("lunary"),
      new Char("spellcast"),
      new Char("dev"),
      new Char("meta"),
    ];

    // Load moon images
    this.moonImgs = loadMoonImages();

    // Load astronomy-engine dynamically (client-side only)
    import("astronomy-engine").then(A => {
      this.Astronomy = A;
      this.moonPhase = getMoonPhaseName(A, new Date());
    }).catch(() => {});

    // Bind events
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);

    canvas.addEventListener("mousedown", this.handleMouseDown);
    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("mouseup", this.handleMouseUp);
    canvas.addEventListener("wheel", this.handleWheel, { passive: false });
    canvas.addEventListener("touchstart", this.handleTouchStart, { passive: false });
    canvas.addEventListener("touchmove", this.handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", this.handleTouchEnd);
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);

    // Animation ticker
    this.tickId = window.setInterval(() => { this.animTick++; }, 400);

    // Initial sizing + start loop
    this.resize();
    this.rafId = requestAnimationFrame(ts => { this.lastTime = ts; this.loop(ts); });
  }

  // ── Public API ──

  updateData(stats: IsleStats) {
    this.stats = stats;
    // Update character working state with debounce to prevent flapping
    for (const ch of this.chars) {
      const badge = stats.badges[ch.zoneId];
      const shouldWork = stats.hotRooms.includes(ch.zoneId) || (badge?.alert ?? false);
      if (shouldWork) {
        ch.isWorking = true;
        ch.idleSince = 0;
      } else if (ch.isWorking) {
        // Delay going idle — prevent scene reset flapping
        if (ch.idleSince === 0) {
          ch.idleSince = Date.now();
        } else if (Date.now() - ch.idleSince > 15000) {
          ch.isWorking = false;
          ch.idleSince = 0;
        }
      }
    }
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.imageSmoothingEnabled = false;
    this.zoom = Math.max(1, Math.min(4,
      Math.min(this.canvas.width / WORLD_W, this.canvas.height / WORLD_H) * 0.92
    ));
    this.targetZoom = this.zoom;
    this.panX = (this.canvas.width - WORLD_W * this.zoom) / 2;
    this.panY = (this.canvas.height - WORLD_H * this.zoom) / 2;
    this.clampPan();
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    clearInterval(this.tickId);
    this.canvas.removeEventListener("mousedown", this.handleMouseDown);
    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("mouseup", this.handleMouseUp);
    this.canvas.removeEventListener("wheel", this.handleWheel);
    this.canvas.removeEventListener("touchstart", this.handleTouchStart);
    this.canvas.removeEventListener("touchmove", this.handleTouchMove);
    this.canvas.removeEventListener("touchend", this.handleTouchEnd);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
  }

  // ── Pan / zoom ──

  private clampPan() {
    const cw = this.canvas.width, ch = this.canvas.height;
    const ww = WORLD_W * this.zoom, wh = WORLD_H * this.zoom;
    this.panX = ww < cw ? (cw - ww) / 2 : Math.min(0, Math.max(cw - ww, this.panX));
    this.panY = wh < ch ? (ch - wh) / 2 : Math.min(0, Math.max(ch - wh, this.panY));
  }

  private screenToWorld(sx: number, sy: number): [number, number] {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const cx = (sx - rect.left) * dpr;
    const cy = (sy - rect.top) * dpr;
    return [(cx - this.panX) / this.zoom, (cy - this.panY) / this.zoom];
  }

  private handleMouseDown(e: MouseEvent) {
    this.drag = true;
    this.panVelX = 0; this.panVelY = 0;
    this.dSX = e.clientX; this.dSY = e.clientY;
    this.lastDragX = e.clientX; this.lastDragY = e.clientY;
    this.pSX = this.panX; this.pSY = this.panY;
  }

  private handleMouseMove(e: MouseEvent) {
    if (!this.drag) return;
    const dpr = window.devicePixelRatio || 1;
    this.panX = this.pSX + (e.clientX - this.dSX) * dpr;
    this.panY = this.pSY + (e.clientY - this.dSY) * dpr;
    // Track velocity for momentum
    this.panVelX = (e.clientX - this.lastDragX) * dpr * 8;
    this.panVelY = (e.clientY - this.lastDragY) * dpr * 8;
    this.lastDragX = e.clientX;
    this.lastDragY = e.clientY;
    this.clampPan();
  }

  private handleMouseUp(e: MouseEvent) {
    if (this.drag && Math.hypot(e.clientX - this.dSX, e.clientY - this.dSY) < 5) {
      this.handleClick(e.clientX, e.clientY);
      this.panVelX = 0; this.panVelY = 0;
    }
    // Otherwise momentum carries from panVelX/Y
    this.drag = false;
  }

  private handleWheel(e: WheelEvent) {
    e.preventDefault();
    const dpr = window.devicePixelRatio || 1;
    const f = e.deltaY < 0 ? 1.15 : 0.87;
    const rect = this.canvas.getBoundingClientRect();
    // Store focus point for smooth zoom lerp
    this.zoomFocusX = (e.clientX - rect.left) * dpr;
    this.zoomFocusY = (e.clientY - rect.top) * dpr;
    this.targetZoom = Math.max(0.5, Math.min(10, this.targetZoom * f));
  }

  // Keyboard handlers — WASD / arrows for panning, +/- for zoom
  private handleKeyDown(e: KeyboardEvent) {
    const k = e.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "=", "-"].includes(k)) {
      this.keysDown.add(k);
      if (["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
    }
  }

  private handleKeyUp(e: KeyboardEvent) {
    this.keysDown.delete(e.key.toLowerCase());
  }

  // Touch handlers
  private touchId: number | null = null;

  private handleTouchStart(e: TouchEvent) {
    e.preventDefault();
    if (e.touches.length === 2) {
      // Pinch-to-zoom
      const t0 = e.touches[0], t1 = e.touches[1];
      this.pinchDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      this.pinchMidX = (t0.clientX + t1.clientX) / 2;
      this.pinchMidY = (t0.clientY + t1.clientY) / 2;
      this.drag = false;
      this.touchId = null;
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      this.touchId = t.identifier;
      this.drag = true;
      this.panVelX = 0; this.panVelY = 0;
      this.dSX = t.clientX; this.dSY = t.clientY;
      this.lastDragX = t.clientX; this.lastDragY = t.clientY;
      this.pSX = this.panX; this.pSY = this.panY;
    }
  }

  private handleTouchMove(e: TouchEvent) {
    e.preventDefault();
    if (e.touches.length === 2) {
      // Pinch-to-zoom
      const t0 = e.touches[0], t1 = e.touches[1];
      const newDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      if (this.pinchDist > 0) {
        const scale = newDist / this.pinchDist;
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        const midX = ((t0.clientX + t1.clientX) / 2 - rect.left) * dpr;
        const midY = ((t0.clientY + t1.clientY) / 2 - rect.top) * dpr;
        const bx = (midX - this.panX) / this.zoom;
        const by = (midY - this.panY) / this.zoom;
        this.zoom = Math.max(0.5, Math.min(10, this.zoom * scale));
        this.targetZoom = this.zoom;
        this.panX = midX - bx * this.zoom;
        this.panY = midY - by * this.zoom;
        this.clampPan();
      }
      this.pinchDist = newDist;
      return;
    }
    if (!this.drag || this.touchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === this.touchId) {
        const dpr = window.devicePixelRatio || 1;
        this.panX = this.pSX + (t.clientX - this.dSX) * dpr;
        this.panY = this.pSY + (t.clientY - this.dSY) * dpr;
        this.panVelX = (t.clientX - this.lastDragX) * dpr * 8;
        this.panVelY = (t.clientY - this.lastDragY) * dpr * 8;
        this.lastDragX = t.clientX; this.lastDragY = t.clientY;
        this.clampPan();
      }
    }
  }

  private handleTouchEnd(e: TouchEvent) {
    if (e.touches.length < 2) this.pinchDist = 0;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === this.touchId) {
        if (Math.hypot(t.clientX - this.dSX, t.clientY - this.dSY) < 10) {
          this.handleClick(t.clientX, t.clientY);
          this.panVelX = 0; this.panVelY = 0;
        }
        this.drag = false;
        this.touchId = null;
      }
    }
  }

  private handleClick(sx: number, sy: number) {
    const [wx, wy] = this.screenToWorld(sx, sy);
    for (const zone of DESK_ZONES) {
      if (wx >= zone.hitX && wx <= zone.hitX + zone.hitW &&
          wy >= zone.hitY && wy <= zone.hitY + zone.hitH) {
        this.onClickTarget?.({ type: "desk", roomKey: zone.id });
        return;
      }
    }
  }

  // ── Game loop ──

  private loop(ts: number) {
    if (this.destroyed) return;
    const dt = Math.min(0.1, (ts - this.lastTime) / 1000);
    this.lastTime = ts;

    // Smooth zoom lerp — keeps focus point stable
    if (Math.abs(this.zoom - this.targetZoom) > 0.002) {
      const bx = (this.zoomFocusX - this.panX) / this.zoom;
      const by = (this.zoomFocusY - this.panY) / this.zoom;
      this.zoom += (this.targetZoom - this.zoom) * 0.12;
      this.panX = this.zoomFocusX - bx * this.zoom;
      this.panY = this.zoomFocusY - by * this.zoom;
      this.clampPan();
    }

    // Keyboard pan (WASD / arrows)
    const panSpeed = 350 * dt;
    if (this.keysDown.has("w") || this.keysDown.has("arrowup")) this.panY += panSpeed;
    if (this.keysDown.has("s") || this.keysDown.has("arrowdown")) this.panY -= panSpeed;
    if (this.keysDown.has("a") || this.keysDown.has("arrowleft")) this.panX += panSpeed;
    if (this.keysDown.has("d") || this.keysDown.has("arrowright")) this.panX -= panSpeed;
    // Keyboard zoom (+/-)
    if (this.keysDown.has("=")) {
      this.zoomFocusX = this.canvas.width / 2;
      this.zoomFocusY = this.canvas.height / 2;
      this.targetZoom = Math.min(10, this.targetZoom * (1 + 1.5 * dt));
    }
    if (this.keysDown.has("-")) {
      this.zoomFocusX = this.canvas.width / 2;
      this.zoomFocusY = this.canvas.height / 2;
      this.targetZoom = Math.max(0.5, this.targetZoom * (1 - 1.5 * dt));
    }
    if (this.keysDown.size > 0) this.clampPan();

    // Pan momentum (decays after drag release)
    if (!this.drag && (Math.abs(this.panVelX) > 0.5 || Math.abs(this.panVelY) > 0.5)) {
      this.panX += this.panVelX * dt;
      this.panY += this.panVelY * dt;
      this.panVelX *= 0.92;
      this.panVelY *= 0.92;
      this.clampPan();
    }

    for (const ch of this.chars) ch.update(dt);

    // Update particles
    const season = getSeason(), tod = getTOD();
    const time = ts / 1000;
    this.particles.update(dt, season, tod, time);

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Background
    const hr = new Date().getHours();
    ctx.fillStyle = hr < 6 || hr >= 21 ? "#07050e" : "#150e06";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.renderScene();
    this.drawHUD();

    this.rafId = requestAnimationFrame(t => this.loop(t));
  }

  // ── Scene render ──

  private renderScene() {
    const ctx = this.ctx;
    const season = getSeason(), tod = getTOD();
    const helpers = createDrawHelpers(ctx, this.zoom, this.panX, this.panY);

    // Sky (now full width!)
    drawSky(ctx, tod, season, this.zoom, this.panX, this.panY, this.moonImgs, this.moonPhase);

    // Tiles
    for (let ty = 0; ty < WORLD_ROWS; ty++) {
      for (let tx = 0; tx < WORLD_COLS; tx++) {
        const inOffice = tx < OFFICE_COLS;
        const isTopWall = ty === 0;
        const isBotWall = ty === WORLD_ROWS - 1;
        const isLeftWall = tx === 0 && inOffice;
        const isRightWall = tx === OFFICE_COLS - 1;
        const isDoor = ty >= DOOR_ROW_START && ty <= DOOR_ROW_END;

        if (inOffice) {
          if ((isTopWall || isBotWall || isLeftWall) && !isDoor) drawOfficeWall(helpers, tx, ty);
          else if (isRightWall && !isDoor) drawRightWall(helpers, tx, ty);
          else if (isRightWall && isDoor) drawDoor(helpers, tx, ty);
          else drawOfficeFloor(helpers, tx, ty);
        } else {
          drawGrass(helpers, tx, ty, season);
          drawGrassDetail(helpers, tx, ty, season);
        }
      }
    }

    // Floor-level elements — drawn before z-sorted pass so they're always behind
    for (const f of FURNITURE) {
      if (f.type === "rug") drawRug(helpers, f);
    }
    drawPath(helpers);
    drawPond(helpers, tod, this.stats, this.animTick);

    // Z-sorted drawables
    interface D { y: number; draw: () => void; }
    const ds: D[] = [];

    // Bookshelves (top wall)
    for (const tx of [1, 5]) {
      ds.push({ y: TS, draw: () => drawBookshelf(helpers, tx, 0) });
    }

    // Windows (top wall) + light rays
    for (const tx of [3, 9]) {
      ds.push({ y: 0, draw: () => { drawWindow(helpers, tx, 0, tod); drawWindowLight(helpers, tx, 0, tod); } });
    }

    // Lamps
    for (const [lx, ly] of [[2, 4], [9, 4], [2, 8], [9, 8]]) {
      ds.push({ y: ly * TS, draw: () => drawLamp(helpers, lx, ly, tod) });
    }

    // Corner plants (fixed)
    for (const [i, [px, py]] of ([[0, [0, 1]], [1, [0, 12]], [2, [10, 1]], [3, [10, 12]]] as [number, [number, number]][])) {
      ds.push({ y: (py + 1) * TS, draw: () => drawPlantFurn(helpers, { id: `cp${i}`, type: "plant", tx: px, ty: py, variant: i }) });
    }

    // Moveable furniture (not rugs)
    for (const f of FURNITURE) {
      if (f.type === "rug") continue;
      const fy = (f.ty + (f.th ?? 1)) * TS;
      ds.push({
        y: fy,
        draw: () => {
          if (f.type === "sofa") drawSofa(helpers, f);
          else if (f.type === "coffeetable") drawCoffeeTable(helpers, f);
          else if (f.type === "plant") drawPlantFurn(helpers, f);
          else if (f.type === "whiteboard") drawWhiteboardData(helpers, f, this.stats);
          else if (f.type === "watercooler") drawWaterCooler(helpers, f);
          else if (f.type === "filing") drawFilingCabinet(helpers, f);
        },
      });
    }

    // Desks + chairs — natural Y sorting
    for (const zone of DESK_ZONES) {
      const isActive = this.stats?.hotRooms.includes(zone.id) ?? false;
      const badge = this.stats?.badges[zone.id] ?? { alert: false };
      // Chair behind character
      ds.push({
        y: zone.seatY - 2,
        draw: () => drawChair(helpers, zone),
      });
      // Desk at its natural Y — draws behind for top-row, in front for bottom-row
      ds.push({
        y: zone.deskY + TS,
        draw: () => drawDesk(helpers, zone, this.animTick, isActive, badge.alert, this.stats),
      });
    }

    // Benches
    for (const b of BENCHES) ds.push({ y: b.ty * TS + TS, draw: () => drawBench(helpers, b) });

    // Garden lanterns
    for (const [lx, ly] of LANTERN_SPOTS) {
      ds.push({ y: ly * TS + TS, draw: () => drawLantern(helpers, lx, ly, tod) });
    }

    // Rocks
    for (const r of ROCKS) ds.push({ y: r.ty * TS + TS, draw: () => drawRock(helpers, r) });

    // Bushes
    for (const b of BUSHES) ds.push({ y: b.ty * TS + TS, draw: () => drawBush(helpers, b) });

    // Signpost
    ds.push({ y: SIGNPOST.ty * TS + TS, draw: () => drawSignpost(helpers, SIGNPOST) });

    // Flowers
    for (const f of FLOWERS) ds.push({ y: f.ty * TS + TS, draw: () => drawFlower(helpers, f, season) });

    // Trees
    for (const t of TREES) ds.push({ y: t.wy + t.sz, draw: () => drawTree(helpers, t, season, tod) });

    // Characters — sort by foot Y
    for (const ch of this.chars) ds.push({ y: ch.y, draw: () => drawChar(ctx, ch, this.zoom, this.panX, this.panY) });

    ds.sort((a, b) => a.y - b.y);
    for (const d of ds) d.draw();

    // Particles (fireflies, leaves, blossoms, snow, dust)
    this.particles.draw(ctx, this.zoom, this.panX, this.panY, Date.now() / 1000);

    // TOD overlay
    const overlay = getWorldOverlay(tod);
    if (overlay) {
      helpers.wr(0, 0, WORLD_W, WORLD_H, overlay[0]);
      // Punch-through glow for lamps and monitors
      if (tod === "night" || tod === "dusk") {
        const { we } = helpers;
        for (const [lx, ly] of [[2, 4], [9, 4], [2, 8], [9, 8]]) {
          we((lx + 0.8) * TS, (ly + 1) * TS, 22, 16, "rgba(255,200,80,0.07)");
        }
        // Monitor glow bleeds onto desk in zone accent colour
        const glowCols: Record<string, string> = {
          lunary: "rgba(160,80,240,0.06)",
          spellcast: "rgba(40,200,220,0.06)",
          dev: "rgba(60,200,100,0.06)",
          meta: "rgba(220,80,160,0.06)",
        };
        for (const zone of DESK_ZONES) {
          we(zone.deskX + TS * 1.5, zone.deskY + TS * 0.5, 9, 7, glowCols[zone.id] ?? "rgba(80,160,255,0.06)");
        }
        // Outdoor moonlight
        helpers.wr(OFFICE_COLS * TS, 0, (WORLD_COLS - OFFICE_COLS) * TS, WORLD_ROWS * TS, "rgba(100,120,180,0.06)");
      }
    }

  }

  // ── HUD ──

  private drawHUD() {
    const ctx = this.ctx;
    const season = getSeason();
    const hr = new Date().getHours();

    // Info box
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath(); ctx.roundRect(8, 8, 160, 40, 6); ctx.fill();
    ctx.font = "bold 11px sans-serif"; ctx.fillStyle = "#c8f0e0";
    ctx.fillText("HOMEBASE", 16, 24);
    ctx.font = "9px monospace"; ctx.fillStyle = "#7ec8a0";
    const active = this.chars.filter(c => c.isWorking).length;
    ctx.fillText(`${active} active \u00B7 ${4 - active} idle \u00B7 ${season}`, 16, 38);

    // Clock
    const t = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    ctx.font = "11px monospace";
    const tw = ctx.measureText(t).width;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath(); ctx.roundRect(this.canvas.width - tw - 22, 8, tw + 14, 22, 6); ctx.fill();
    ctx.fillStyle = hr < 6 || hr >= 20 ? "#c8d0ff" : "#fff8d0";
    ctx.fillText(t, this.canvas.width - tw - 15, 23);
  }
}
