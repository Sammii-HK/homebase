import type { TOD, Season } from "./types";
import { TS, WORLD_W, WORLD_COLS, WORLD_ROWS, seededRng } from "./world";

// ── Sky gradient keyframes (hour → [topR,topG,topB, botR,botG,botB]) ──

interface SkyKey { hour: number; top: [number, number, number]; bot: [number, number, number]; }

const SKY_KEYS: SkyKey[] = [
  { hour: 0,    top: [8, 6, 18],      bot: [12, 10, 22] },
  { hour: 4,    top: [10, 8, 25],     bot: [15, 10, 30] },
  { hour: 5,    top: [30, 15, 50],    bot: [100, 50, 40] },
  { hour: 5.5,  top: [50, 20, 70],    bot: [200, 100, 50] },
  { hour: 6.5,  top: [80, 50, 120],   bot: [230, 140, 70] },
  { hour: 7.5,  top: [60, 110, 190],  bot: [140, 180, 230] },
  { hour: 10,   top: [50, 120, 200],  bot: [120, 180, 240] },
  { hour: 13,   top: [45, 110, 195],  bot: [110, 170, 230] },
  { hour: 16,   top: [60, 100, 180],  bot: [180, 150, 100] },
  { hour: 17.5, top: [140, 60, 40],   bot: [230, 120, 50] },
  { hour: 18.5, top: [100, 30, 50],   bot: [200, 80, 40] },
  { hour: 19.5, top: [40, 15, 60],    bot: [80, 30, 50] },
  { hour: 20.5, top: [15, 10, 35],    bot: [20, 12, 40] },
  { hour: 24,   top: [8, 6, 18],      bot: [12, 10, 22] },
];

function lerpColor(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function getSkyColors(hour: number): { top: [number, number, number]; bot: [number, number, number] } {
  let lo = SKY_KEYS[0], hi = SKY_KEYS[1];
  for (let i = 0; i < SKY_KEYS.length - 1; i++) {
    if (hour >= SKY_KEYS[i].hour && hour < SKY_KEYS[i + 1].hour) {
      lo = SKY_KEYS[i];
      hi = SKY_KEYS[i + 1];
      break;
    }
  }
  const t = (hour - lo.hour) / (hi.hour - lo.hour);
  return {
    top: lerpColor(lo.top, hi.top, t),
    bot: lerpColor(lo.bot, hi.bot, t),
  };
}

// ── Stars ──

interface Star { x: number; y: number; size: number; baseOpacity: number; phase: number; twinkleSpeed: number; }

const STARS: Star[] = [];
{
  const rng = seededRng("sky-stars-v3");
  for (let i = 0; i < 60; i++) {
    STARS.push({
      x: rng(),
      y: rng() * 0.9,
      size: rng() > 0.8 ? 2 : 1,
      baseOpacity: 0.3 + rng() * 0.5,
      phase: rng() * Math.PI * 2,
      twinkleSpeed: 1.5 + rng() * 2.5,
    });
  }
}

// ── Clouds ──

interface Cloud { x: number; y: number; w: number; h: number; speed: number; opacity: number; }

const CLOUDS: Cloud[] = [];
{
  const rng = seededRng("clouds-v3");
  for (let i = 0; i < 8; i++) {
    CLOUDS.push({
      x: rng() * WORLD_W * 1.5 - WORLD_W * 0.25,
      y: rng() * 25 + 3,
      w: 25 + rng() * 45,
      h: 8 + rng() * 10,
      speed: 1 + rng() * 2.5,
      opacity: 0.4 + rng() * 0.35,
    });
  }
}

// ── Main draw ──

export function drawSky(
  ctx: CanvasRenderingContext2D,
  tod: TOD,
  season: Season,
  zoom: number,
  panX: number,
  panY: number,
  moonImgs: Record<string, HTMLImageElement>,
  moonPhaseName: string,
): void {
  // Sky spans full canvas width so there's no gap at the edges
  const canvasW = ctx.canvas.width;
  const x = 0;
  const w = canvasW;
  // Sky fills from top of canvas down into the top edge of the world
  const skyH = Math.max(0, Math.round(panY + 1.5 * TS * zoom));
  const time = Date.now() / 1000;

  // Smooth sky gradient based on actual time
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  const { top, bot } = getSkyColors(hour);

  const grad = ctx.createLinearGradient(x, 0, x, skyH);
  grad.addColorStop(0, `rgb(${top[0]},${top[1]},${top[2]})`);
  grad.addColorStop(1, `rgb(${bot[0]},${bot[1]},${bot[2]})`);
  ctx.fillStyle = grad;
  ctx.fillRect(x, 0, w, Math.max(1, skyH));

  // Stars — visible when sky is dark enough (avg brightness < 80)
  const avgBright = (top[0] + top[1] + top[2]) / 3;
  if (avgBright < 80) {
    const starAlpha = Math.min(1, (80 - avgBright) / 60);
    for (const s of STARS) {
      const sx = x + s.x * w;
      const sy = s.y * skyH;
      // Twinkling
      const twinkle = Math.sin(time * s.twinkleSpeed + s.phase);
      const alpha = Math.max(0, s.baseOpacity + twinkle * 0.3) * starAlpha;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#fff";
      ctx.fillRect(Math.round(sx), Math.round(sy), s.size, s.size);
      // Cross sparkle on big stars
      if (s.size >= 2 && twinkle > 0.5) {
        ctx.globalAlpha = alpha * 0.4;
        ctx.fillRect(Math.round(sx - 1), Math.round(sy), 1, s.size);
        ctx.fillRect(Math.round(sx + s.size), Math.round(sy), 1, s.size);
        ctx.fillRect(Math.round(sx), Math.round(sy - 1), s.size, 1);
        ctx.fillRect(Math.round(sx), Math.round(sy + s.size), s.size, 1);
      }
    }
    ctx.globalAlpha = 1;

    // Moon — arc across sky based on time
    const img = moonImgs[moonPhaseName];
    if (img && img.complete && skyH > 10) {
      const moonSize = 14 * zoom;
      let moonProgress: number;
      if (hour >= 18) {
        moonProgress = (hour - 18) / 12;
      } else if (hour < 6) {
        moonProgress = 0.5 + hour / 12;
      } else {
        moonProgress = -1;
      }

      if (moonProgress >= 0 && moonProgress <= 1) {
        const moonX = panX + w * (0.85 - moonProgress * 0.7);
        const arcHeight = skyH * 0.8;
        const moonY = 4 + arcHeight * (1 - 4 * moonProgress * (1 - moonProgress));
        const moonAlpha = moonProgress < 0.05 ? moonProgress / 0.05
          : moonProgress > 0.95 ? (1 - moonProgress) / 0.05
          : 1;
        ctx.globalAlpha = Math.max(0, Math.min(1, moonAlpha * starAlpha));
        ctx.drawImage(img, moonX, Math.max(2, moonY), moonSize, moonSize);
        // Subtle moon glow
        ctx.globalAlpha *= 0.08;
        ctx.fillStyle = "#c8d0ff";
        ctx.beginPath();
        ctx.arc(moonX + moonSize / 2, Math.max(2, moonY) + moonSize / 2, moonSize * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  // Sun — arcs across the sky during daytime (6am-6pm)
  if (hour >= 5.5 && hour <= 18.5 && skyH > 10) {
    // Progress: 0 at sunrise (6am), 0.5 at zenith (noon), 1 at sunset (6pm)
    const sunProgress = Math.max(0, Math.min(1, (hour - 6) / 12));
    const sunRadius = 8 * zoom;

    // Position: arc from left to right
    const sunX = panX + w * (0.15 + sunProgress * 0.7);
    const arcH = skyH * 0.85;
    const sunY = 4 + arcH * (1 - 4 * sunProgress * (1 - sunProgress));

    // Fade in/out near horizon
    const sunAlpha = sunProgress < 0.05 ? sunProgress / 0.05
      : sunProgress > 0.95 ? (1 - sunProgress) / 0.05
      : 1;
    // Also handle the pre-rise/post-set fade (5.5-6 and 18-18.5)
    const edgeAlpha = hour < 6 ? (hour - 5.5) / 0.5
      : hour > 18 ? (18.5 - hour) / 0.5
      : 1;
    const alpha = Math.max(0, Math.min(1, sunAlpha * edgeAlpha));

    // Colour shifts: orange/red near horizon, yellow-white at zenith
    const zenithDist = Math.abs(sunProgress - 0.5) * 2; // 0 at noon, 1 at edges
    const r = Math.round(255);
    const g = Math.round(200 + (1 - zenithDist) * 55); // 200-255
    const b = Math.round(50 + (1 - zenithDist) * 150); // 50-200
    const sunColor = `rgb(${r},${g},${b})`;

    // Warm glow halo
    ctx.globalAlpha = alpha * 0.12;
    const glowGrad = ctx.createRadialGradient(sunX, Math.max(4, sunY), 0, sunX, Math.max(4, sunY), sunRadius * 4);
    glowGrad.addColorStop(0, sunColor);
    glowGrad.addColorStop(1, "transparent");
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(sunX, Math.max(4, sunY), sunRadius * 4, 0, Math.PI * 2);
    ctx.fill();

    // Sun disc
    ctx.globalAlpha = alpha;
    const discGrad = ctx.createRadialGradient(sunX, Math.max(4, sunY), 0, sunX, Math.max(4, sunY), sunRadius);
    discGrad.addColorStop(0, "#fffff0");
    discGrad.addColorStop(0.6, sunColor);
    discGrad.addColorStop(1, `rgba(${r},${g - 50},${Math.max(0, b - 50)},0.3)`);
    ctx.fillStyle = discGrad;
    ctx.beginPath();
    ctx.arc(sunX, Math.max(4, sunY), sunRadius, 0, Math.PI * 2);
    ctx.fill();

    // Sun rays — short radiating lines that rotate slowly
    const rayCount = 8;
    const rayLen = sunRadius * 1.8;
    const rayRotation = time * 0.15; // slow rotation
    ctx.strokeStyle = sunColor;
    ctx.lineWidth = Math.max(1, zoom * 0.5);
    ctx.globalAlpha = alpha * 0.3;
    for (let i = 0; i < rayCount; i++) {
      const angle = rayRotation + (i / rayCount) * Math.PI * 2;
      const inner = sunRadius * 1.2;
      ctx.beginPath();
      ctx.moveTo(
        sunX + Math.cos(angle) * inner,
        Math.max(4, sunY) + Math.sin(angle) * inner,
      );
      ctx.lineTo(
        sunX + Math.cos(angle) * rayLen,
        Math.max(4, sunY) + Math.sin(angle) * rayLen,
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Clouds — in the sky band above the world
  if (avgBright > 20 && skyH > 10) {
    const cloudAlpha = Math.min(0.9, avgBright / 120);
    for (const c of CLOUDS) {
      const cx = ((c.x + time * c.speed) % (WORLD_W * 1.5)) - WORLD_W * 0.25;
      const screenX = panX + cx * zoom;
      // Position clouds in the sky band (0 to skyH), not world coords
      const screenY = (c.y / 35) * skyH;
      const cw = c.w * zoom;
      const ch = c.h * zoom;

      ctx.globalAlpha = c.opacity * cloudAlpha;
      const cloudCol = avgBright > 100 ? "#ffffff"
        : avgBright > 60 ? "#e8e0e8"
        : "#a898b0";

      // Fluffy multi-blob cloud shape (5 overlapping ellipses)
      ctx.fillStyle = cloudCol;
      // Main body
      ctx.beginPath();
      ctx.ellipse(screenX, screenY, cw * 0.45, ch * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      // Left puff
      ctx.beginPath();
      ctx.ellipse(screenX - cw * 0.3, screenY + ch * 0.05, cw * 0.3, ch * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      // Right puff
      ctx.beginPath();
      ctx.ellipse(screenX + cw * 0.32, screenY + ch * 0.02, cw * 0.35, ch * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      // Top bump
      ctx.beginPath();
      ctx.ellipse(screenX + cw * 0.05, screenY - ch * 0.2, cw * 0.25, ch * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      // Top-right bump
      ctx.beginPath();
      ctx.ellipse(screenX + cw * 0.2, screenY - ch * 0.12, cw * 0.2, ch * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Seasonal sky tint
  if (season === "autumn" && avgBright > 60) {
    ctx.fillStyle = "rgba(224,128,32,0.06)";
    ctx.fillRect(x, 0, w, Math.max(1, skyH));
  }
  if (season === "winter" && avgBright > 60) {
    ctx.fillStyle = "rgba(180,200,230,0.04)";
    ctx.fillRect(x, 0, w, Math.max(1, skyH));
  }
}

export function getMoonPhaseName(Astronomy: any, date: Date): string {
  const a = Astronomy.MoonPhase(date);
  if (a < 22.5 || a >= 337.5) return "new-moon";
  if (a < 67.5) return "waxing-cresent";
  if (a < 112.5) return "first-quarter";
  if (a < 157.5) return "waxing-gibbous";
  if (a < 202.5) return "full-moon";
  if (a < 247.5) return "waning-gibbous";
  if (a < 292.5) return "last-quarter";
  return "waning-cresent";
}

export function loadMoonImages(): Record<string, HTMLImageElement> {
  const imgs: Record<string, HTMLImageElement> = {};
  const phases = [
    "new-moon", "waxing-cresent-moon", "first-quarter",
    "waxing-gibbous-moon", "full-moon", "waning-gibbous-moon",
    "last-quarter", "waning-cresent-moon",
  ];
  const keys = [
    "new-moon", "waxing-cresent", "first-quarter",
    "waxing-gibbous", "full-moon", "waning-gibbous",
    "last-quarter", "waning-cresent",
  ];
  for (let i = 0; i < phases.length; i++) {
    const img = new Image(64, 64);
    img.src = `/moon-phases/${phases[i]}.svg`;
    imgs[keys[i]] = img;
  }
  return imgs;
}

export function getWorldOverlay(tod: TOD): [string, number] | null {
  const hour = new Date().getHours() + new Date().getMinutes() / 60;
  // Smooth overlay based on actual hour
  if (hour >= 20.5 || hour < 5) {
    return [`rgba(0,0,25,0.45)`, 1];
  }
  if (hour >= 19.5 && hour < 20.5) {
    const t = (hour - 19.5) / 1;
    return [`rgba(10,5,25,${(0.15 + t * 0.3).toFixed(2)})`, 1];
  }
  if (hour >= 18 && hour < 19.5) {
    const t = (hour - 18) / 1.5;
    return [`rgba(40,10,0,${(0.08 + t * 0.12).toFixed(2)})`, 1];
  }
  if (hour >= 5 && hour < 6.5) {
    const t = 1 - (hour - 5) / 1.5;
    return [`rgba(20,5,10,${(t * 0.2).toFixed(2)})`, 1];
  }
  return null;
}
