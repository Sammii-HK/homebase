import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// In-memory health history (survives within same instance)
const g = global as typeof globalThis & {
  _healthHistory?: { ts: string; services: Record<string, "ok" | "down"> }[];
};
if (!g._healthHistory) g._healthHistory = [];

export async function GET(req: NextRequest) {
  const denied = checkAuth(req);
  if (denied) return denied;

  try {
    // n8n recent executions
    let recentWorkflows: { id: string; name: string; status: string; startedAt: string; finishedAt: string | null }[] = [];
    try {
      const n8nRes = await fetch("http://localhost:5678/api/v1/executions?limit=10", {
        signal: AbortSignal.timeout(3000),
        cache: "no-store",
      });
      if (n8nRes.ok) {
        const data = await n8nRes.json();
        const execs = Array.isArray(data) ? data : data.data ?? data.results ?? [];
        recentWorkflows = execs.map((e: Record<string, unknown>) => ({
          id: String(e.id ?? ""),
          name: String((e.workflowData as Record<string, unknown>)?.name ?? e.workflowName ?? e.name ?? "Unknown"),
          status: String(e.status ?? (e.finished ? "success" : "running")),
          startedAt: String(e.startedAt ?? e.createdAt ?? ""),
          finishedAt: e.stoppedAt ? String(e.stoppedAt) : null,
        }));
      }
    } catch {
      // n8n not reachable — fine
    }

    // Snapshot current health for history
    const lunaryUrl = process.env.LUNARY_URL ?? "https://lunary.app";
    const spellcastUrl = process.env.SPELLCAST_API_URL ?? "https://api.spellcast.sammii.dev";
    const contentUrl = process.env.CONTENT_CREATOR_URL ?? "https://content.sammii.dev";

    const checks = await Promise.all([
      fetch(`${lunaryUrl}/api/admin/health/db`, { signal: AbortSignal.timeout(5000), cache: "no-store" }).then(r => r.ok ? "ok" as const : "down" as const).catch(() => "down" as const),
      fetch(`${spellcastUrl}/api/health`, { signal: AbortSignal.timeout(5000), cache: "no-store" }).then(r => r.ok ? "ok" as const : "down" as const).catch(() => "down" as const),
      fetch(`${contentUrl}/api/health`, { signal: AbortSignal.timeout(5000), cache: "no-store" }).then(r => r.ok ? "ok" as const : "down" as const).catch(() => "down" as const),
    ]);

    g._healthHistory!.push({
      ts: new Date().toISOString(),
      services: { lunary: checks[0], spellcast: checks[1], contentCreator: checks[2] },
    });

    // Keep only 24h of snapshots
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    g._healthHistory = g._healthHistory!.filter(h => new Date(h.ts).getTime() > cutoff);

    return NextResponse.json({
      recentWorkflows,
      healthHistory: g._healthHistory,
    });
  } catch (e) {
    console.error("[homebase] infra deep fetch failed:", e);
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  }
}
