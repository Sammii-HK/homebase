import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";
import { writeMetricsSnapshot, readMetricsSnapshot } from "@/lib/metrics-snapshot";

interface HeartbeatPayload {
  ts: string;
  services: Record<string, { status: string; [key: string]: unknown }>;
  docker?: string;
  launchAgents?: string;
  metrics?: {
    dau?: number;
    mau?: number;
    wau?: number;
    mrr?: number;
    signups7d?: number;
  };
  disk?: { pct: number; used: string; avail: string };
  tasks?: Array<{ id: string; title: string; status: string; project: string }>;
}

const g = global as typeof globalThis & { _heartbeat?: HeartbeatPayload };

export async function POST(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  try {
    const body = (await req.json()) as HeartbeatPayload;
    if (!body.ts || !body.services) {
      return NextResponse.json({ error: "missing ts or services" }, { status: 400 });
    }
    g._heartbeat = body;

    // Persist metrics to disk if present
    if (body.metrics) {
      writeMetricsSnapshot(body.metrics, body.ts);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  const hb = g._heartbeat;
  if (!hb) {
    return NextResponse.json({ status: "no-data", ageMinutes: 0, heartbeat: null });
  }

  const ageMs = Date.now() - new Date(hb.ts).getTime();
  const macStatus = ageMs > 5 * 60 * 1000 ? "offline" : "online";
  const ageMinutes = Math.round(ageMs / 60_000);

  // Include persisted metrics snapshot in GET response
  const metricsSnapshot = readMetricsSnapshot();

  return NextResponse.json({
    status: macStatus,
    ageMinutes,
    heartbeat: hb,
    ...(metricsSnapshot ? { metricsSnapshot } : {}),
  });
}
