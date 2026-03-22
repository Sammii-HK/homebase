import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";
import { sendPush } from "@/lib/send-push";
import type { LondonEvent } from "@/types/dashboard";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const DATA_DIR = path.join(process.cwd(), "..", "..", "app", "data");
const PUSHED_EVENTS_FILE = path.join(DATA_DIR, "pushed-events.json");
const PUSH_EXPIRY_MS = 48 * 60 * 60 * 1000; // Don't re-push for 48h

function loadPushedEvents(): Map<string, number> {
  try {
    if (!fs.existsSync(PUSHED_EVENTS_FILE)) return new Map();
    const raw = JSON.parse(fs.readFileSync(PUSHED_EVENTS_FILE, "utf-8"));
    const now = Date.now();
    return new Map(
      (Object.entries(raw) as [string, number][]).filter(([, ts]) => now - ts < PUSH_EXPIRY_MS)
    );
  } catch {
    return new Map();
  }
}

function savePushedEvents(map: Map<string, number>) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(PUSHED_EVENTS_FILE, JSON.stringify(Object.fromEntries(map), null, 2));
  } catch {
    // Best effort
  }
}

function formatEventTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    + " at " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export async function POST(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  const secret = process.env.HOMEBASE_SECRET;
  const port = process.env.PORT ?? "3005";

  // Fetch events
  let events: LondonEvent[] = [];
  try {
    const res = await fetch(`http://localhost:${port}/api/stats/events`, {
      headers: { ...(secret ? { Authorization: `Bearer ${secret}` } : {}) },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      events = data.events ?? [];
    }
  } catch {
    return NextResponse.json({ error: "Could not fetch events" }, { status: 502 });
  }

  // Only care about events in the next 48h
  const in48h = Date.now() + 48 * 3_600_000;
  const upcoming = events.filter((e) => {
    const start = new Date(e.startAt).getTime();
    return start > Date.now() && start <= in48h;
  });

  const pushedEvents = loadPushedEvents();
  let sent = 0;

  for (const event of upcoming.slice(0, 3)) {
    if (pushedEvents.has(event.id)) continue;

    const timeStr = formatEventTime(event.startAt);
    const venue = event.venue ? ` · ${event.venue}` : "";
    await sendPush(
      `📅 ${event.title.slice(0, 50)}`,
      `${timeStr}${venue}`
    );

    pushedEvents.set(event.id, Date.now());
    sent++;
  }

  savePushedEvents(pushedEvents);

  return NextResponse.json({ ok: true, sent, upcoming: upcoming.length, total: events.length });
}
