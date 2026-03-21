"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createDrawHelpers,
  drawGrass,
  drawPond,
  drawTree,
  drawFlower,
  drawGrassDetail,
} from "@/components/isle/furniture";
import type { IsleStats } from "@/components/isle/types";
import { TREES, FLOWERS, getSeason, getTOD } from "@/components/isle/world";

// Fake stats for previewing each tier
function makeFakeStats(tier: 0 | 1 | 2 | 3): IsleStats {
  const systemsUp = [3, 2, 1, 0][tier];
  return {
    lunary: { mau: 0, mrr: 0, activeToday: 0 },
    spellcast: { postsToday: 0, scheduled: 0, accounts: 0 },
    infra: { systemsUp, totalSystems: 3 },
    meta: { followers: 0, reachThisWeek: 0 },
    engagement: { unread: 0, total: 0 },
    orbit: { online: true, runningAgents: 0, errorAgents: 0, pipelineRunning: false },
    content: { pendingReview: 0, failedPosts: tier === 1 ? 1 : 0, scheduledToday: 0, scheduledTomorrow: 0 },
    seo: { clicks: 0, impressions: 0, ctr: 0 },
    github: { commitsToday: 0 },
    badges: {},
    hotRooms: [],
  } as unknown as IsleStats;
}

// Pond center in world px: (17+2.5)*16=312, (4+2)*16=96
const POND_CX = 312;
const POND_CY = 96;

// At this zoom the pond (80x64 world px) renders ~400x320 on a 512x512 canvas
const ZOOM = 5;
const SIZE = 512;

function renderIcon(canvas: HTMLCanvasElement, animTick = 0, stats?: IsleStats | null) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const panX = SIZE / 2 - POND_CX * ZOOM;
  const panY = SIZE / 2 - POND_CY * ZOOM;

  // Visible world tile range
  const tx0 = Math.floor(-panX / ZOOM / 16) - 1;
  const ty0 = Math.floor(-panY / ZOOM / 16) - 1;
  const tx1 = Math.ceil((SIZE - panX) / ZOOM / 16) + 1;
  const ty1 = Math.ceil((SIZE - panY) / ZOOM / 16) + 1;

  const helpers = createDrawHelpers(ctx, ZOOM, panX, panY);
  const season = getSeason();
  const tod = getTOD();

  // Background fill (matches grass base)
  ctx.fillStyle = season === "winter" ? "#b8c8c0" : season === "autumn" ? "#b09030" : "#58b04a";
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Grass tiles
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (tx >= 0 && ty >= 0) drawGrass(helpers, tx, ty, season);
    }
  }

  // Grass detail (per-tile)
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (tx >= 0 && ty >= 0) drawGrassDetail(helpers, tx, ty, season);
    }
  }

  // Trees that fall in visible range
  for (const t of TREES) {
    const ttx = t.wx / 16;
    const tty = t.wy / 16;
    if (ttx >= tx0 - 2 && ttx <= tx1 + 2 && tty >= ty0 - 2 && tty <= ty1 + 2) {
      drawTree(helpers, t, season, tod);
    }
  }

  // Flowers in visible range
  for (const f of FLOWERS) {
    if (f.tx >= tx0 && f.tx <= tx1 && f.ty >= ty0 && f.ty <= ty1) {
      drawFlower(helpers, f, season);
    }
  }

  // Pond (main subject)
  drawPond(helpers, tod, stats ?? null, animTick);
}

const TIER_LABELS = ["0 — all clear", "1 — heads up", "2 — attention", "3 — critical"];
const TIER_COLORS = ["#2a5a2a", "#5a5a1a", "#5a3010", "#3a1010"];

function TierPreview({ tier, tick }: { tier: 0 | 1 | 2 | 3; tick: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) renderIcon(ref.current, tick, makeFakeStats(tier));
  }, [tick, tier]);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <canvas ref={ref} width={128} height={128} style={{ imageRendering: "pixelated", border: `2px solid ${TIER_COLORS[tier]}`, borderRadius: 12 }} />
      <span style={{ color: "#888", fontFamily: "monospace", fontSize: 10 }}>{TIER_LABELS[tier]}</span>
    </div>
  );
}

export default function IconGen() {
  const router = useRouter();
  const canvas512 = useRef<HTMLCanvasElement>(null);
  const canvas192 = useRef<HTMLCanvasElement>(null);
  const [tick, setTick] = useState(0);
  const rafRef = useRef<number>(0);

  // Gate behind auth
  useEffect(() => {
    fetch("/api/auth/session").then(r => {
      if (!r.ok) router.replace("/");
    });
  }, [router]);

  useEffect(() => {
    let t = 0;
    function loop() {
      t += 1;
      setTick(t);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    if (canvas512.current) renderIcon(canvas512.current, tick);
  }, [tick]);

  useEffect(() => {
    if (!canvas192.current || !canvas512.current) return;
    const ctx = canvas192.current.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas512.current, 0, 0, 192, 192);
  }, [tick]);

  const [saved, setSaved] = useState<string | null>(null);

  async function saveToPublic() {
    if (!canvas512.current || !canvas192.current) return;
    setSaved("saving...");
    const png512 = canvas512.current.toDataURL("image/png");
    const png192 = canvas192.current.toDataURL("image/png");
    const res = await fetch("/api/save-icons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ png512, png192 }),
    });
    setSaved(res.ok ? "saved to public/" : "error");
  }

  return (
    <div style={{ background: "#111", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: 32 }}>
      <h1 style={{ color: "#fff", fontFamily: "monospace", fontSize: 14 }}>Homebase PWA Icon — Pond</h1>

      <canvas
        ref={canvas512}
        width={512}
        height={512}
        style={{ imageRendering: "pixelated", border: "2px solid #333", borderRadius: 24 }}
      />

      <canvas
        ref={canvas192}
        width={192}
        height={192}
        style={{ imageRendering: "pixelated", border: "2px solid #333", borderRadius: 12 }}
      />

      <button
        onClick={saveToPublic}
        style={{ background: "#3a2a5a", color: "#fff", border: "1px solid #6a4aaa", borderRadius: 8, padding: "10px 24px", cursor: "pointer", fontFamily: "monospace", fontSize: 13 }}
      >
        Save icon-512, icon-192 + favicon to public/
      </button>

      {saved && <p style={{ color: saved === "saved to public/" ? "#88ff88" : "#ff8888", fontFamily: "monospace", fontSize: 12 }}>{saved}</p>}

      <div style={{ marginTop: 8 }}>
        <p style={{ color: "#555", fontFamily: "monospace", fontSize: 11, textAlign: "center", marginBottom: 12 }}>all 4 health tiers</p>
        <div style={{ display: "flex", gap: 16 }}>
          {([0, 1, 2, 3] as const).map(t => <TierPreview key={t} tier={t} tick={tick} />)}
        </div>
      </div>

      <p style={{ color: "#444", fontFamily: "monospace", fontSize: 11 }}>
        Wait for sprites to load before saving.
      </p>
    </div>
  );
}
