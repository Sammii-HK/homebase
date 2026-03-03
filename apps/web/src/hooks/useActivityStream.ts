"use client";

import { useEffect, useRef, useState } from "react";

export type ToolState = "typing" | "running" | "searching" | "thinking" | "active" | "";

export interface ActivityData {
  activeRooms: string[];
  hotRooms: string[];
  lastTool: string;
  toolState: ToolState;
  isIdle: boolean;
}

const POLL_MS = 3_000;

export function useActivityStream(): ActivityData {
  const [data, setData] = useState<ActivityData>({
    activeRooms: [],
    hotRooms: [],
    lastTool: "",
    toolState: "",
    isIdle: true,
  });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const load = () => {
      if (document.hidden) return;
      fetch("/api/activity")
        .then((r) => r.json())
        .then((json) => {
          setData({
            activeRooms: json.activeRooms ?? [],
            hotRooms: json.hotRooms ?? [],
            lastTool: json.lastTool ?? "",
            toolState: json.toolState ?? "",
            isIdle: (json.activeRooms ?? []).length === 0,
          });
        })
        .catch(console.error);
    };

    const start = () => {
      load();
      timerRef.current = setInterval(load, POLL_MS);
    };

    const stop = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    document.addEventListener("visibilitychange", onVisibility);
    start();
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return data;
}
