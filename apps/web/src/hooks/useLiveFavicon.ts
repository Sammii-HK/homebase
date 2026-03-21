"use client";

import { useEffect, useRef } from "react";
import {
  createDrawHelpers,
  drawGrass,
  drawPond,
} from "@/components/isle/furniture";
import { getSeason, getTOD } from "@/components/isle/world";
import type { IsleStats } from "@/components/isle/types";

// 64x64 canvas, zoomed in tight on the pond
const SIZE = 64;
const ZOOM = 0.8;
const POND_CX = 312;
const POND_CY = 96;
const PAN_X = SIZE / 2 - POND_CX * ZOOM;
const PAN_Y = SIZE / 2 - POND_CY * ZOOM;

// Visible tile range
const TX0 = Math.floor(-PAN_X / ZOOM / 16) - 1;
const TY0 = Math.floor(-PAN_Y / ZOOM / 16) - 1;
const TX1 = Math.ceil((SIZE - PAN_X) / ZOOM / 16) + 1;
const TY1 = Math.ceil((SIZE - PAN_Y) / ZOOM / 16) + 1;

export function useLiveFavicon(stats: IsleStats | null) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const tickRef = useRef(0);
  const linkRef = useRef<HTMLLinkElement | null>(null);
  const statsRef = useRef(stats);

  useEffect(() => {
    // Create offscreen canvas once
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    canvasRef.current = canvas;

    // Find or create the favicon link element
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    linkRef.current = link;

    function render() {
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      const season = getSeason();
      const tod = getTOD();
      const tick = tickRef.current;

      // Grass background
      const grassCol = season === "winter" ? "#b8c8c0" : season === "autumn" ? "#b09030" : "#58b04a";
      ctx.fillStyle = grassCol;
      ctx.fillRect(0, 0, SIZE, SIZE);

      const helpers = createDrawHelpers(ctx, ZOOM, PAN_X, PAN_Y);

      for (let ty = TY0; ty <= TY1; ty++) {
        for (let tx = TX0; tx <= TX1; tx++) {
          if (tx >= 0 && ty >= 0) drawGrass(helpers, tx, ty, season);
        }
      }

      drawPond(helpers, tod, statsRef.current, tick);

      // Push to favicon
      linkRef.current!.href = canvas.toDataURL("image/png");

      tickRef.current += 1;
      rafRef.current = requestAnimationFrame(render);
    }

    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep stats ref in sync without restarting the loop
  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);
}
