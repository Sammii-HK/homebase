import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";
import { deriveAlerts } from "@/lib/derive-alerts";
import { sendPush } from "@/lib/send-push";
import type { DashboardStats, HeartbeatResponse } from "@/types/dashboard";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const DATA_DIR = path.join(process.cwd(), "..", "..", "app", "data");
const PUSHED_ALERTS_FILE = path.join(DATA_DIR, "pushed-alerts.json");
const MAX_PUSHES_PER_RUN = 3;
const PUSH_EXPIRY_MS = 4 * 60 * 60 * 1000; // 4 hours

function loadPushedAlerts(): Map<string, number> {
  try {
    if (!fs.existsSync(PUSHED_ALERTS_FILE)) return new Map();
    const raw = JSON.parse(fs.readFileSync(PUSHED_ALERTS_FILE, "utf-8"));
    const now = Date.now();
    return new Map(
      (Object.entries(raw) as [string, number][]).filter(([, ts]) => now - ts < PUSH_EXPIRY_MS)
    );
  } catch {
    return new Map();
  }
}

function savePushedAlerts(map: Map<string, number>) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(PUSHED_ALERTS_FILE, JSON.stringify(Object.fromEntries(map), null, 2));
  } catch {
    // Best effort
  }
}

export async function POST(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  const secret = process.env.HOMEBASE_SECRET;
  const port = process.env.PORT ?? "3005";

  // Fetch stats and heartbeat in parallel
  let stats: DashboardStats | null = null;
  let heartbeat: HeartbeatResponse | null = null;

  try {
    const [statsRes, hbRes] = await Promise.all([
      fetch(`http://localhost:${port}/api/stats`, {
        headers: { ...(secret ? { Authorization: `Bearer ${secret}` } : {}) },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      }).catch(() => null),
      fetch(`http://localhost:${port}/api/heartbeat`, {
        headers: { ...(secret ? { Authorization: `Bearer ${secret}` } : {}) },
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      }).catch(() => null),
    ]);

    if (statsRes?.ok) stats = await statsRes.json();
    if (hbRes?.ok) heartbeat = await hbRes.json();
  } catch {
    return NextResponse.json({ error: "Could not fetch stats" }, { status: 502 });
  }

  const alerts = deriveAlerts(stats, heartbeat);
  const criticalAlerts = alerts.filter((a) => a.severity === "critical");

  const pushedAlerts = loadPushedAlerts();
  let sent = 0;
  let skipped = 0;

  for (const alert of criticalAlerts) {
    if (sent >= MAX_PUSHES_PER_RUN) break;

    if (pushedAlerts.has(alert.id)) {
      skipped++;
      continue;
    }

    await sendPush(alert.title, alert.detail ?? "Critical issue detected");
    pushedAlerts.set(alert.id, Date.now());
    sent++;
  }

  savePushedAlerts(pushedAlerts);

  return NextResponse.json({ ok: true, sent, skipped, total: criticalAlerts.length });
}
