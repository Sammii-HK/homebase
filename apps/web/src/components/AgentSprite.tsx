"use client";

import { useEffect, useRef, useState } from "react";
import PixelSprite, { SPRITES } from "./PixelSprite";

type SpriteKey = keyof typeof SPRITES;

export type ActivityState = "idle" | "active" | "hot" | "typing" | "running" | "searching" | "thinking";

interface Props {
  sprite: SpriteKey;
  name: string;
  glowColor: string;
  activityState?: ActivityState;
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

// Target position ranges by state
const TARGET: Record<ActivityState, { x: [number, number]; y: [number, number] }> = {
  idle:      { x: [8, 72],  y: [36, 68] },
  active:    { x: [8, 72],  y: [36, 68] },
  hot:       { x: [8, 72],  y: [36, 68] },
  running:   { x: [8, 72],  y: [36, 68] },
  typing:    { x: [45, 75], y: [58, 70] }, // near desk
  searching: { x: [5, 22],  y: [55, 68] }, // near bookshelf
  thinking:  { x: [35, 65], y: [44, 58] }, // centre
};

// Wander interval in ms [min, max] by state
const INTERVAL: Record<ActivityState, [number, number]> = {
  idle:      [2000, 4500],
  active:    [1200, 2800],
  hot:       [600,  1500],
  running:   [180,  450],
  typing:    [1800, 3500],
  searching: [2200, 4200],
  thinking:  [3000, 5500],
};

// CSS transition speed by state
const TRANSITION: Record<ActivityState, string> = {
  idle:      "left 2.5s ease-in-out, top 2.5s ease-in-out",
  active:    "left 1.5s ease-in-out, top 1.5s ease-in-out",
  hot:       "left 0.7s ease-in-out, top 0.7s ease-in-out",
  running:   "left 0.18s linear, top 0.18s linear",
  typing:    "left 1.8s ease-in-out, top 1.8s ease-in-out",
  searching: "left 1.8s ease-in-out, top 1.8s ease-in-out",
  thinking:  "left 2.2s ease-in-out, top 2.2s ease-in-out",
};

// Bounce class by state
function bounceClass(state: ActivityState): string {
  switch (state) {
    case "running":   return "agent-run";
    case "thinking":  return "agent-think";
    case "hot":
    case "typing":    return "agent-bounce-fast";
    default:          return "agent-bounce";
  }
}

export default function AgentSprite({ sprite, name, glowColor, activityState = "idle" }: Props) {
  const [pos, setPos] = useState({ x: rand(15, 70), y: rand(40, 65) });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<ActivityState>(activityState);
  const { pixels, palette } = SPRITES[sprite];

  // Keep stateRef in sync without restarting the wander loop
  useEffect(() => {
    stateRef.current = activityState;
  }, [activityState]);

  useEffect(() => {
    const wander = () => {
      const s = stateRef.current;
      const t = TARGET[s];
      setPos({ x: rand(t.x[0], t.x[1]), y: rand(t.y[0], t.y[1]) });
      const [mn, mx] = INTERVAL[s];
      timerRef.current = setTimeout(wander, rand(mn, mx));
    };
    timerRef.current = setTimeout(wander, rand(400, 1800));
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const glowIntensity = activityState === "hot" || activityState === "typing" || activityState === "running"
    ? `drop-shadow(0 0 10px ${glowColor}) drop-shadow(0 2px 0 rgba(0,0,0,0.8))`
    : `drop-shadow(0 0 6px ${glowColor}) drop-shadow(0 2px 0 rgba(0,0,0,0.8))`;

  return (
    <div
      className="agent absolute flex flex-col items-center gap-1 pointer-events-none select-none z-20"
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transition: TRANSITION[activityState],
      }}
    >
      <div
        className={bounceClass(activityState)}
        style={{ filter: glowIntensity }}
      >
        <PixelSprite pixels={pixels} palette={palette} scale={3} />
      </div>
      <span
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 6,
          color: "rgba(255,255,255,0.45)",
          textShadow: "1px 1px 0 black",
          whiteSpace: "nowrap",
          marginTop: 2,
        }}
      >
        {name}
      </span>
    </div>
  );
}
