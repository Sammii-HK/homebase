"use client";

import { useEffect, useRef, useState } from "react";
import PixelSprite, { SPRITES } from "./PixelSprite";

type SpriteKey = keyof typeof SPRITES;

interface Props {
  sprite: SpriteKey;
  name: string;
  glowColor: string;
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export default function AgentSprite({ sprite, name, glowColor }: Props) {
  const [pos, setPos] = useState({ x: rand(15, 70), y: rand(40, 65) });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { pixels, palette } = SPRITES[sprite];

  useEffect(() => {
    const wander = () => {
      setPos({ x: rand(8, 72), y: rand(36, 68) });
      timerRef.current = setTimeout(wander, rand(2000, 4500));
    };
    timerRef.current = setTimeout(wander, rand(400, 1800));
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <div
      className="agent absolute flex flex-col items-center gap-1 pointer-events-none select-none z-20"
      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
    >
      <div
        className="agent-bounce"
        style={{ filter: `drop-shadow(0 0 6px ${glowColor}) drop-shadow(0 2px 0 rgba(0,0,0,0.8))` }}
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
