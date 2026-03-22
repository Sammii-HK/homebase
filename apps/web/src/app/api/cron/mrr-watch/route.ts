import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";
import { sendPush } from "@/lib/send-push";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const DATA_DIR = path.join(process.cwd(), "..", "..", "app", "data");
const STATE_FILE = path.join(DATA_DIR, "mrr-state.json");

interface MRRState {
  lastKnownMRR: number;
  firstRevenueNotifiedAt: string | null;
  updatedAt: string;
}

function readState(): MRRState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8")) as MRRState;
    }
  } catch { /* silent */ }
  return { lastKnownMRR: 0, firstRevenueNotifiedAt: null, updatedAt: new Date().toISOString() };
}

function writeState(state: MRRState) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch { /* best effort */ }
}

/**
 * Cron: poll MRR every hour. Push notification on first £1 and MRR milestones.
 * Milestones: £1 (first!), £10, £50, £100, £500, £1000
 */
const MILESTONES = [1, 10, 50, 100, 500, 1000];

export async function POST(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  const lunaryUrl = process.env.LUNARY_URL ?? "https://lunary.app";
  const lunaryKey = process.env.LUNARY_ADMIN_API_KEY;

  if (!lunaryKey) {
    return NextResponse.json({ error: "No Lunary API key" }, { status: 500 });
  }

  try {
    const res = await fetch(`${lunaryUrl}/api/internal/homebase-stats`, {
      headers: { Authorization: `Bearer ${lunaryKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Lunary stats failed: ${res.status}` }, { status: 502 });
    }

    const data = await res.json() as { mrr?: number };
    const currentMRR = data.mrr ?? 0;

    const state = readState();
    const prevMRR = state.lastKnownMRR;
    const notifications: string[] = [];

    // Check milestones crossed
    for (const milestone of MILESTONES) {
      if (prevMRR < milestone && currentMRR >= milestone) {
        const isFirst = milestone === 1;
        const title = isFirst
          ? "🎉 FIRST REVENUE! You made money!"
          : `💰 MRR milestone: £${milestone}!`;
        const body = isFirst
          ? `MRR is now £${currentMRR.toFixed(2)}. This is the beginning.`
          : `You crossed £${milestone}/mo. Keep going — £${MILESTONES[MILESTONES.indexOf(milestone) + 1] ?? milestone * 2} is next.`;

        await sendPush(title, body);
        notifications.push(`Milestone: £${milestone}`);

        if (isFirst) {
          state.firstRevenueNotifiedAt = new Date().toISOString();
        }
      }
    }

    // Update state
    state.lastKnownMRR = currentMRR;
    state.updatedAt = new Date().toISOString();
    writeState(state);

    return NextResponse.json({
      ok: true,
      currentMRR,
      prevMRR,
      notifications,
      message: notifications.length > 0
        ? `Milestone notifications sent: ${notifications.join(", ")}`
        : "No milestones crossed",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
