"use client";

import { useEffect, useState } from "react";

export interface Stats {
  github: { repos: number; followers: number; commitsToday: number };
  lunary: { mau: number; mrr: number; activeToday: number };
  spellcast: { postsToday: number; scheduled: number; accounts: number };
  meta: { followers: number; reachThisWeek: number; postsThisWeek: number };
  updatedAt: string;
}

const POLL_MS = 60_000;

export function useLiveStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/stats")
        .then((r) => r.json())
        .then(setStats)
        .catch(console.error);

    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, []);

  return stats;
}
