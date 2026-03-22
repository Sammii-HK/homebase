"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { RoomDeepData } from "@/types/dashboard";

interface RoomDataState {
  data: RoomDeepData | null;
  loading: boolean;
  error: string | null;
}

const cache = new Map<string, { data: RoomDeepData; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useRoomData(roomId: string | null): RoomDataState {
  const [state, setState] = useState<RoomDataState>({ data: null, loading: false, error: null });
  const abortRef = useRef<AbortController | null>(null);

  const fetchRoom = useCallback(async (id: string) => {
    // Check cache
    const cached = cache.get(id);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setState({ data: cached.data, loading: false, error: null });
      return;
    }

    setState(s => ({ ...s, loading: true, error: null }));

    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const token = localStorage.getItem("homebase_token");
      const res = await fetch(`/api/stats/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`${res.status}`);

      const data = await res.json();
      cache.set(id, { data, ts: Date.now() });
      setState({ data, loading: false, error: null });
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setState({ data: null, loading: false, error: (e as Error).message });
      }
    }
  }, []);

  useEffect(() => {
    if (!roomId) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    // Only fetch for rooms with deep endpoints
    if (["spellcast", "lunary", "infra", "orbit", "engagement", "events"].includes(roomId)) {
      fetchRoom(roomId === "dev" ? "infra" : roomId);
    }

    return () => abortRef.current?.abort();
  }, [roomId, fetchRoom]);

  return state;
}
