// Isle canvas engine — particle system
// Fireflies, falling leaves, cherry blossoms, snow, dust motes

import type { Particle, Season, TOD } from "./types";
import { TS, WORLD_COLS, WORLD_ROWS, OFFICE_COLS } from "./world";

const POOL_SIZE = 200;

export class ParticleSystem {
  private particles: Particle[] = [];
  private pool: Particle[] = [];
  private spawnTimer = 0;

  constructor() {
    // Pre-allocate particle pool
    for (let i = 0; i < POOL_SIZE; i++) {
      this.pool.push(this.createBlank());
    }
  }

  private createBlank(): Particle {
    return {
      x: 0, y: 0, vx: 0, vy: 0,
      life: 0, maxLife: 0, size: 1,
      color: "#fff", opacity: 0, phase: 0,
      type: "dust", rotation: 0,
    };
  }

  private spawn(): Particle | null {
    if (this.pool.length === 0) return null;
    const p = this.pool.pop()!;
    this.particles.push(p);
    return p;
  }

  private recycle(idx: number) {
    const p = this.particles.splice(idx, 1)[0];
    p.life = 0;
    this.pool.push(p);
  }

  update(dt: number, season: Season, tod: TOD, time: number) {
    this.spawnTimer += dt;

    // Spawn particles based on conditions
    if (this.spawnTimer > 0.15) {
      this.spawnTimer = 0;
      this.spawnAmbient(season, tod, time);
    }

    // Update all live particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;

      if (p.life <= 0) {
        this.recycle(i);
        continue;
      }

      // Type-specific movement
      switch (p.type) {
        case "firefly":
          p.x += Math.sin(time * 1.5 + p.phase) * 8 * dt;
          p.y += Math.cos(time * 1.2 + p.phase * 1.3) * 6 * dt;
          p.opacity = 0.3 + Math.sin(time * 3 + p.phase) * 0.4;
          break;

        case "leaf":
          p.x += p.vx + Math.sin(time * 0.8 + p.phase) * 15 * dt;
          p.y += p.vy;
          p.rotation += dt * 1.5;
          p.opacity = Math.min(1, p.life / 2) * 0.7;
          break;

        case "blossom":
          p.x += p.vx + Math.sin(time * 0.6 + p.phase) * 12 * dt;
          p.y += p.vy + Math.sin(time * 0.9 + p.phase * 0.7) * 3 * dt;
          p.rotation += dt * 0.8;
          p.opacity = Math.min(1, p.life / 2) * 0.8;
          break;

        case "snow":
          p.x += Math.sin(time * 0.4 + p.phase) * 10 * dt;
          p.y += p.vy;
          p.opacity = Math.min(1, p.life / 3) * 0.85;
          break;

        case "dust":
          p.x += p.vx + Math.sin(time * 0.3 + p.phase) * 3 * dt;
          p.y += p.vy;
          p.opacity = Math.min(1, p.life / 4) * 0.15;
          break;

        case "sparkle":
          p.y += p.vy;
          p.opacity = Math.sin((p.life / p.maxLife) * Math.PI) * 0.9;
          break;
      }

      // Bounds check (garden area only for outdoor particles)
      const maxX = WORLD_COLS * TS;
      const maxY = WORLD_ROWS * TS;
      if (p.x < 0 || p.x > maxX || p.y < -20 || p.y > maxY + 20) {
        this.recycle(i);
      }
    }
  }

  private spawnAmbient(season: Season, tod: TOD, time: number) {
    const gardenLeft = OFFICE_COLS * TS;
    const gardenRight = WORLD_COLS * TS;
    const worldH = WORLD_ROWS * TS;

    // Fireflies — night only, garden area
    if (tod === "night" || tod === "dusk") {
      if (this.particles.filter(p => p.type === "firefly").length < 12) {
        const p = this.spawn();
        if (p) {
          p.type = "firefly";
          p.x = gardenLeft + Math.random() * (gardenRight - gardenLeft);
          p.y = worldH * 0.3 + Math.random() * worldH * 0.6;
          p.vx = 0;
          p.vy = 0;
          p.life = 6 + Math.random() * 8;
          p.maxLife = p.life;
          p.size = 1.5 + Math.random();
          p.color = Math.random() > 0.3 ? "#c0ff60" : "#80ffa0";
          p.opacity = 0.5;
          p.phase = Math.random() * Math.PI * 2;
          p.rotation = 0;
        }
      }
    }

    // Falling leaves — autumn
    if (season === "autumn") {
      if (this.particles.filter(p => p.type === "leaf").length < 15) {
        const p = this.spawn();
        if (p) {
          p.type = "leaf";
          p.x = gardenLeft + Math.random() * (gardenRight - gardenLeft);
          p.y = -5;
          p.vx = (Math.random() - 0.3) * 8;
          p.vy = 12 + Math.random() * 8;
          p.life = 8 + Math.random() * 6;
          p.maxLife = p.life;
          p.size = 2 + Math.random() * 2;
          const leafCols = ["#c05820", "#e07830", "#d0a020", "#a04010", "#cc6020"];
          p.color = leafCols[Math.floor(Math.random() * leafCols.length)];
          p.opacity = 0.7;
          p.phase = Math.random() * Math.PI * 2;
          p.rotation = Math.random() * Math.PI * 2;
        }
      }
    }

    // Cherry blossoms — spring
    if (season === "spring") {
      if (this.particles.filter(p => p.type === "blossom").length < 18) {
        const p = this.spawn();
        if (p) {
          p.type = "blossom";
          p.x = gardenLeft + Math.random() * (gardenRight - gardenLeft);
          p.y = -5;
          p.vx = (Math.random() - 0.4) * 6;
          p.vy = 8 + Math.random() * 5;
          p.life = 10 + Math.random() * 8;
          p.maxLife = p.life;
          p.size = 1.5 + Math.random() * 1.5;
          const blossomCols = ["#ffb8d0", "#ffc8e0", "#ffe0ef", "#ff90b0", "#ffd0e8"];
          p.color = blossomCols[Math.floor(Math.random() * blossomCols.length)];
          p.opacity = 0.8;
          p.phase = Math.random() * Math.PI * 2;
          p.rotation = Math.random() * Math.PI * 2;
        }
      }
    }

    // Snow — winter
    if (season === "winter") {
      if (this.particles.filter(p => p.type === "snow").length < 25) {
        const p = this.spawn();
        if (p) {
          p.type = "snow";
          p.x = Math.random() * (gardenRight);
          p.y = -5;
          p.vx = 0;
          p.vy = 6 + Math.random() * 6;
          p.life = 12 + Math.random() * 8;
          p.maxLife = p.life;
          p.size = 1 + Math.random() * 2;
          p.color = Math.random() > 0.5 ? "#fff" : "#e0e8ff";
          p.opacity = 0.8;
          p.phase = Math.random() * Math.PI * 2;
          p.rotation = 0;
        }
      }
    }

    // Dust motes — always, subtle
    if (Math.random() < 0.3) {
      if (this.particles.filter(p => p.type === "dust").length < 10) {
        const p = this.spawn();
        if (p) {
          p.type = "dust";
          p.x = Math.random() * gardenRight;
          p.y = Math.random() * worldH;
          p.vx = (Math.random() - 0.5) * 2;
          p.vy = -1 - Math.random() * 2;
          p.life = 8 + Math.random() * 12;
          p.maxLife = p.life;
          p.size = 1;
          p.color = tod === "night" ? "#8090c0" : "#ffe8c0";
          p.opacity = 0.12;
          p.phase = Math.random() * Math.PI * 2;
          p.rotation = 0;
        }
      }
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    zoom: number,
    panX: number,
    panY: number,
    time: number,
  ) {
    for (const p of this.particles) {
      const sx = panX + p.x * zoom;
      const sy = panY + p.y * zoom;
      const sz = Math.max(1, p.size * zoom);

      ctx.globalAlpha = Math.max(0, Math.min(1, p.opacity));

      switch (p.type) {
        case "firefly": {
          // Glow halo
          const glowR = sz * 3;
          const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
          grad.addColorStop(0, p.color);
          grad.addColorStop(1, "transparent");
          ctx.fillStyle = grad;
          ctx.fillRect(sx - glowR, sy - glowR, glowR * 2, glowR * 2);
          // Core dot
          ctx.fillStyle = "#ffffcc";
          ctx.fillRect(Math.round(sx - sz / 2), Math.round(sy - sz / 2), Math.max(1, Math.round(sz)), Math.max(1, Math.round(sz)));
          break;
        }

        case "leaf": {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          // Leaf shape: small diamond
          ctx.beginPath();
          ctx.moveTo(0, -sz);
          ctx.lineTo(sz * 0.6, 0);
          ctx.lineTo(0, sz);
          ctx.lineTo(-sz * 0.6, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          break;
        }

        case "blossom": {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          // Petal shape: small circle cluster
          for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const px = Math.cos(angle) * sz * 0.4;
            const py = Math.sin(angle) * sz * 0.4;
            ctx.beginPath();
            ctx.arc(px, py, sz * 0.5, 0, Math.PI * 2);
            ctx.fill();
          }
          // Centre
          ctx.fillStyle = "#ffe0a0";
          ctx.beginPath();
          ctx.arc(0, 0, sz * 0.25, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;
        }

        case "snow": {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(sx, sy, sz * 0.5, 0, Math.PI * 2);
          ctx.fill();
          break;
        }

        case "dust": {
          ctx.fillStyle = p.color;
          ctx.fillRect(Math.round(sx), Math.round(sy), Math.max(1, Math.round(sz)), Math.max(1, Math.round(sz)));
          break;
        }

        case "sparkle": {
          ctx.fillStyle = p.color;
          ctx.fillRect(Math.round(sx - sz / 2), Math.round(sy - sz / 2), Math.max(1, Math.round(sz)), Math.max(1, Math.round(sz)));
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  get count() { return this.particles.length; }
}
