import type { TOD, Season } from "./types";
import { TS, WORLD_W, seededRng } from "./world";

const SKY_TOP: Record<TOD, string> = {
  dawn: "#1a0c28",
  morning: "#4a80c8",
  afternoon: "#3870b8",
  dusk: "#a03018",
  night: "#08060f",
};

const SKY_BOT: Record<TOD, string> = {
  dawn: "#e07030",
  morning: "#80b0e8",
  afternoon: "#70a8e0",
  dusk: "#e05820",
  night: "#10080f",
};

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
  const x = Math.round(panX);
  const w = Math.round(WORLD_W * zoom);
  const skyH = Math.max(0, Math.round(panY + 2 * TS * zoom));

  // Draw gradient across the ENTIRE world width (not just the garden).
  // Office walls and ceiling tiles are drawn on top later, so the sky
  // naturally peeks through windows.
  const grad = ctx.createLinearGradient(x, 0, x, skyH);
  grad.addColorStop(0, SKY_TOP[tod]);
  grad.addColorStop(1, SKY_BOT[tod]);
  ctx.fillStyle = grad;
  ctx.fillRect(x, 0, w, Math.max(1, skyH));

  // Stars (night and dawn only)
  if (tod === "night" || tod === "dawn") {
    const rng = seededRng("sky-v2");
    ctx.fillStyle = "#fff";
    for (let i = 0; i < 40; i++) {
      const sx = x + rng() * w;
      const sy = rng() * skyH;
      const opacity = 0.4 + rng() * 0.6;
      const size = rng() > 0.7 ? 2 : 1;
      ctx.globalAlpha = opacity;
      ctx.fillRect(Math.round(sx), Math.round(sy), size, size);
    }
    ctx.globalAlpha = 1;

    // Moon
    const img = moonImgs[moonPhaseName];
    if (img && img.complete && skyH > 10) {
      const moonSize = 12 * zoom;
      ctx.drawImage(
        img,
        panX + WORLD_W * zoom * 0.75,
        4,
        moonSize,
        moonSize,
      );
    }
  }

  // Autumn overlay
  if (season === "autumn" && (tod === "afternoon" || tod === "morning")) {
    ctx.fillStyle = "rgba(224,128,32,0.1)";
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
    "new-moon",
    "waxing-cresent-moon",
    "first-quarter",
    "waxing-gibbous-moon",
    "full-moon",
    "waning-gibbous-moon",
    "last-quarter",
    "waning-cresent-moon",
  ];
  const keys = [
    "new-moon",
    "waxing-cresent",
    "first-quarter",
    "waxing-gibbous",
    "full-moon",
    "waning-gibbous",
    "last-quarter",
    "waning-cresent",
  ];
  for (let i = 0; i < phases.length; i++) {
    const img = new Image(64, 64);
    img.src = `/moon-phases/${phases[i]}.svg`;
    imgs[keys[i]] = img;
  }
  return imgs;
}

export function getWorldOverlay(tod: TOD): [string, number] | null {
  if (tod === "night") return ["rgba(0,0,20,0.52)", 1];
  if (tod === "dusk") return ["rgba(40,10,0,0.28)", 1];
  if (tod === "dawn") return ["rgba(20,5,0,0.22)", 1];
  return null;
}
