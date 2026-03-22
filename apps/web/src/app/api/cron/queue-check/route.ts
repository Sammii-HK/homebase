import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";
import { sendPush } from "@/lib/send-push";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const DATA_DIR = path.join(process.cwd(), "..", "..", "app", "data");
const QUEUE_CHECK_FILE = path.join(DATA_DIR, "queue-check-state.json");
const CRON_LOG_FILE = path.join(DATA_DIR, "cron-log.json");

const THIN_QUEUE_THRESHOLD = 2; // Trigger autopilot if fewer than this many posts tomorrow
const COOLDOWN_HOURS = 4;

interface QueueCheckState {
  lastTriggered: string | null;
}

function loadState(): QueueCheckState {
  try {
    if (!fs.existsSync(QUEUE_CHECK_FILE)) return { lastTriggered: null };
    return JSON.parse(fs.readFileSync(QUEUE_CHECK_FILE, "utf-8"));
  } catch {
    return { lastTriggered: null };
  }
}

function saveState(state: QueueCheckState) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(QUEUE_CHECK_FILE, JSON.stringify(state, null, 2));
  } catch {
    // Best effort
  }
}

function appendCronLog(summary: string, type: "info" | "post_scheduled" = "info") {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    let log: { ts: string; type: string; summary: string }[] = [];
    if (fs.existsSync(CRON_LOG_FILE)) {
      log = JSON.parse(fs.readFileSync(CRON_LOG_FILE, "utf-8"));
    }
    log.unshift({ ts: new Date().toISOString(), type, summary });
    fs.writeFileSync(CRON_LOG_FILE, JSON.stringify(log.slice(0, 50), null, 2));
  } catch {
    // Best effort
  }
}

export async function POST(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  const secret = process.env.HOMEBASE_SECRET;
  const port = process.env.PORT ?? "3005";

  // Check last trigger time
  const state = loadState();
  if (state.lastTriggered) {
    const hoursSince = (Date.now() - new Date(state.lastTriggered).getTime()) / 3_600_000;
    if (hoursSince < COOLDOWN_HOURS) {
      return NextResponse.json({ ok: true, triggered: false, reason: `Cooldown active (${hoursSince.toFixed(1)}h since last trigger)` });
    }
  }

  // Fetch stats to check tomorrow's queue
  let scheduledTomorrow = 0;
  try {
    const statsRes = await fetch(`http://localhost:${port}/api/stats`, {
      headers: { ...(secret ? { Authorization: `Bearer ${secret}` } : {}) },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (statsRes.ok) {
      const stats = await statsRes.json();
      scheduledTomorrow = stats?.content?.scheduledTomorrow ?? 0;
    }
  } catch {
    return NextResponse.json({ error: "Could not fetch stats" }, { status: 502 });
  }

  if (scheduledTomorrow >= THIN_QUEUE_THRESHOLD) {
    return NextResponse.json({ ok: true, triggered: false, scheduledTomorrow });
  }

  // Queue is thin — trigger autopilot
  try {
    await fetch(`http://localhost:${port}/api/actions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify({ action: "trigger-autopilot" }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    // Autopilot trigger failed — log but don't hard fail
  }

  saveState({ lastTriggered: new Date().toISOString() });

  const summary = `Queue thin (${scheduledTomorrow} post${scheduledTomorrow !== 1 ? "s" : ""} tomorrow) — autopilot triggered`;
  appendCronLog(summary);
  await sendPush("🤖 Autopilot triggered", `Queue had ${scheduledTomorrow} post${scheduledTomorrow !== 1 ? "s" : ""} for tomorrow`);

  return NextResponse.json({ ok: true, triggered: true, scheduledTomorrow });
}
