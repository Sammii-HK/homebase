import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export type OrbitLogEntryType =
  | "content_generated"
  | "post_scheduled"
  | "engagement_replied"
  | "error"
  | "info";

export interface OrbitLogEntry {
  ts: string;
  type: OrbitLogEntryType;
  summary: string;
  count?: number;
}

export interface OrbitLogResponse {
  orbitLog: OrbitLogEntry[];
  lastActive: string | null;
  generatedToday: number;
  errorsToday: number;
}

function classifyAction(action: string, detail: string): OrbitLogEntryType {
  const lower = (action + " " + detail).toLowerCase();
  if (lower.includes("error") || lower.includes("fail") || lower.includes("exception")) return "error";
  if (lower.includes("generat") || lower.includes("draft") || lower.includes("creat")) return "content_generated";
  if (lower.includes("schedul") || lower.includes("publish") || lower.includes("post")) return "post_scheduled";
  if (lower.includes("reply") || lower.includes("engag") || lower.includes("comment")) return "engagement_replied";
  return "info";
}

function buildSummary(entry: Record<string, unknown>): string {
  const action = String(entry.action ?? "");
  const detail = String(entry.detail ?? entry.description ?? "");
  const agent = String(entry.agent ?? "");
  if (detail) return detail.slice(0, 120);
  if (action && agent) return `${agent}: ${action}`;
  if (action) return action;
  return "Agent activity";
}

async function getFromOrbit(): Promise<OrbitLogEntry[]> {
  const orbitUrl = process.env.ORBIT_URL ?? "http://localhost:3001";

  // Try /api/state (has an activity array) and /api/history in parallel
  const [stateRes, historyRes] = await Promise.all([
    fetch(`${orbitUrl}/api/state`, {
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    }).catch(() => null),
    fetch(`${orbitUrl}/api/history`, {
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    }).catch(() => null),
  ]);

  const entries: OrbitLogEntry[] = [];

  // Parse /api/history if available
  if (historyRes?.ok) {
    try {
      const histData = await historyRes.json();
      const raw: Record<string, unknown>[] = Array.isArray(histData)
        ? histData
        : histData.history ?? histData.entries ?? histData.data ?? [];
      for (const item of raw.slice(0, 50)) {
        const ts = String(item.ts ?? item.timestamp ?? item.createdAt ?? "");
        const action = String(item.action ?? item.type ?? "");
        const detail = String(item.detail ?? item.summary ?? item.description ?? "");
        entries.push({
          ts,
          type: classifyAction(action, detail),
          summary: buildSummary(item),
          count: item.count ? Number(item.count) : undefined,
        });
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Parse activity from /api/state if history had nothing useful
  if (entries.length === 0 && stateRes?.ok) {
    try {
      const stateData = await stateRes.json();
      const activityRaw: Record<string, unknown>[] = stateData.activity ?? [];
      for (const item of activityRaw.slice(0, 50)) {
        const ts = String(item.ts ?? item.timestamp ?? "");
        const action = String(item.action ?? "");
        const detail = String(item.detail ?? "");
        entries.push({
          ts,
          type: classifyAction(action, detail),
          summary: buildSummary(item),
          count: item.count ? Number(item.count) : undefined,
        });
      }
    } catch {
      // Ignore parse errors
    }
  }

  return entries;
}

async function getFromN8n(): Promise<OrbitLogEntry[]> {
  const n8nKey = process.env.N8N_API_KEY;
  if (!n8nKey) return [];

  try {
    const res = await fetch("http://localhost:5678/api/v1/executions?pageSize=20", {
      headers: { "X-N8N-API-KEY": n8nKey },
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (!res.ok) return [];

    const data = await res.json();
    const executions: Record<string, unknown>[] = Array.isArray(data)
      ? data
      : data.data ?? data.executions ?? [];

    return executions.slice(0, 20).map((exec) => {
      const status = String(exec.status ?? exec.finished ?? "");
      const name = String(exec.workflowData
        ? (exec.workflowData as Record<string, unknown>).name ?? "n8n workflow"
        : exec.name ?? "n8n workflow");
      const ts = String(exec.startedAt ?? exec.stoppedAt ?? exec.createdAt ?? "");
      const isError = status === "error" || status === "crashed";

      return {
        ts,
        type: (isError ? "error" : "info") as OrbitLogEntryType,
        summary: `${name} — ${status || "ran"}`,
        count: undefined,
      };
    });
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  // Try Orbit first, fall back to n8n
  let entries: OrbitLogEntry[] = [];
  let orbitOnline = false;

  try {
    entries = await getFromOrbit();
    orbitOnline = entries.length > 0;
  } catch {
    // Orbit offline
  }

  if (!orbitOnline) {
    try {
      entries = await getFromN8n();
    } catch {
      // n8n also unavailable
    }
  }

  // Filter to last 24h and sort newest first
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recent = entries
    .filter((e) => e.ts && e.ts >= cutoff)
    .sort((a, b) => (b.ts > a.ts ? 1 : -1))
    .slice(0, 20);

  const todayStr = new Date().toISOString().slice(0, 10);

  const generatedToday = recent.filter(
    (e) => e.type === "content_generated" && e.ts.startsWith(todayStr)
  ).length;

  const errorsToday = recent.filter(
    (e) => e.type === "error" && e.ts.startsWith(todayStr)
  ).length;

  const lastActive = recent.length > 0 ? recent[0].ts : null;

  const response: OrbitLogResponse = {
    orbitLog: recent.slice(0, 10),
    lastActive,
    generatedToday,
    errorsToday,
  };

  return NextResponse.json(response);
}
