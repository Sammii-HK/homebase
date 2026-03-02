"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  emoji: string;
  name: string;
  color: string;
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export default function AgentSprite({ emoji, name, color }: Props) {
  const [pos, setPos] = useState({ x: rand(15, 75), y: rand(40, 70) });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const wander = () => {
      setPos({ x: rand(10, 78), y: rand(38, 72) });
      timerRef.current = setTimeout(wander, rand(2000, 4500));
    };
    timerRef.current = setTimeout(wander, rand(500, 2000));
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <div
      className="agent absolute flex flex-col items-center gap-1 pointer-events-none select-none z-20"
      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
    >
      <div
        className="agent-bounce flex items-center justify-center"
        style={{
          width: 28,
          height: 28,
          background: color,
          border: "2px solid rgba(255,255,255,0.3)",
          boxShadow: `0 0 10px ${color}, 2px 2px 0 rgba(0,0,0,0.8)`,
          imageRendering: "pixelated",
          fontSize: 14,
        }}
      >
        {emoji}
      </div>
      <span
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 6,
          color: "rgba(255,255,255,0.5)",
          textShadow: "1px 1px 0 black",
          whiteSpace: "nowrap",
        }}
      >
        {name}
      </span>
    </div>
  );
}
