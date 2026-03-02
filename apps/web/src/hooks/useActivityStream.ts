"use client";

import { useEffect, useState } from "react";

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

  useEffect(() => {
    const load = () =>
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

    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, []);

  return data;
}
