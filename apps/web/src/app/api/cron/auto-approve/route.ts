import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";
import { runAutoApprove } from "@/lib/auto-approve";
import { sendPush } from "@/lib/send-push";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const DATA_DIR = path.join(process.cwd(), "..", "..", "app", "data");
const CRON_LOG_FILE = path.join(DATA_DIR, "cron-log.json");

const THRESHOLD = 82;

interface CronLogEntry {
  ts: string;
  type: "post_scheduled" | "error" | "info";
  summary: string;
  count?: number;
}

function appendCronLog(entry: CronLogEntry) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    let log: CronLogEntry[] = [];
    if (fs.existsSync(CRON_LOG_FILE)) {
      log = JSON.parse(fs.readFileSync(CRON_LOG_FILE, "utf-8"));
    }
    log.unshift(entry);
    // Keep last 50 entries
    fs.writeFileSync(CRON_LOG_FILE, JSON.stringify(log.slice(0, 50), null, 2));
  } catch {
    // Best effort
  }
}

export async function POST(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  const apiKey = process.env.SPELLCAST_API_KEY;
  const spellcastUrl = process.env.SPELLCAST_API_URL ?? "https://api.spellcast.sammii.dev";

  if (!apiKey) {
    return NextResponse.json({ error: "No API key configured" }, { status: 500 });
  }

  try {
    const { approved, errors, platforms } = await runAutoApprove(THRESHOLD, apiKey, spellcastUrl);

    if (approved > 0) {
      const platformStr = platforms.length > 0 ? platforms.join(", ") : "multiple platforms";
      const summary = `Cron auto-approved ${approved} post${approved !== 1 ? "s" : ""} (threshold ${THRESHOLD}) — ${platformStr}`;

      appendCronLog({
        ts: new Date().toISOString(),
        type: "post_scheduled",
        summary,
        count: approved,
      });

      await sendPush(
        `✓ ${approved} post${approved !== 1 ? "s" : ""} scheduled`,
        `Auto-approved on: ${platformStr}`
      );
    }

    return NextResponse.json({ ok: true, approved, errors: errors.length > 0 ? errors : undefined, threshold: THRESHOLD });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    appendCronLog({ ts: new Date().toISOString(), type: "error", summary: `Auto-approve cron failed: ${msg}` });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
