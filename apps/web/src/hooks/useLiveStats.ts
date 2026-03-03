"use client";

import { useEffect, useRef, useState } from "react";

export interface Stats {
  github: { repos: number; followers: number; commitsToday: number };
  lunary: { mau: number; mrr: number; activeToday: number };
  spellcast: { postsToday: number; scheduled: number; accounts: number };
  meta: { followers: number; reachThisWeek: number; postsThisWeek: number };
  updatedAt: string;
}

export interface LiveEvent {
  id: number;
  type: "new-user" | "new-sub" | "online" | "offline";
  ts: number;
  label?: string;
}

const POLL_MS = 60_000;
const EVENT_TTL = 5_000;
let eventCounter = 0;

export function useLiveStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const prevRef = useRef<Stats | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const load = () => {
      if (document.hidden) return;
      fetch("/api/stats")
        .then((r) => r.json())
        .then((next: Stats) => {
          const prev = prevRef.current;
          if (prev) {
            const newEvents: LiveEvent[] = [];
            const now = Date.now();
            if (next.lunary.mau > prev.lunary.mau)
              newEvents.push({ id: ++eventCounter, type: "new-user", ts: now });
            if (next.lunary.mrr > prev.lunary.mrr)
              newEvents.push({ id: ++eventCounter, type: "new-sub", ts: now });
            if (next.lunary.activeToday > 0 && prev.lunary.activeToday === 0)
              newEvents.push({ id: ++eventCounter, type: "online", ts: now, label: String(next.lunary.activeToday) });
            if (next.lunary.activeToday === 0 && prev.lunary.activeToday > 0)
              newEvents.push({ id: ++eventCounter, type: "offline", ts: now });
            if (newEvents.length > 0)
              setEvents((e) => [...e, ...newEvents].slice(-5));
          }
          prevRef.current = next;
          setStats(next);
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

  // Auto-expire events older than EVENT_TTL
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setEvents((prev) => prev.filter((e) => now - e.ts < EVENT_TTL));
    }, 1_000);
    return () => clearInterval(id);
  }, []);

  return { stats, events };
}
