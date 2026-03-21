import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import fs from "fs";
import path from "path";
import { checkAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DATA_DIR = path.join(process.cwd(), "..", "..", "app", "data");
const SUBS_FILE = path.join(DATA_DIR, "push-subscriptions.json");
const VAPID_FILE = path.join(DATA_DIR, "vapid-keys.json");
const SENT_FILE = path.join(DATA_DIR, "briefing-push-sent.json");

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

interface SentRecord {
  date: string; // YYYY-MM-DD
}

function getOrCreateVapidKeys(): VapidKeys {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(VAPID_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(VAPID_FILE, "utf-8"));
    } catch {
      // Fall through to regenerate
    }
  }
  const keys = webpush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_FILE, JSON.stringify(keys, null, 2));
  return keys;
}

function loadSubscriptions(): PushSubscriptionJSON[] {
  try {
    if (!fs.existsSync(SUBS_FILE)) return [];
    return JSON.parse(fs.readFileSync(SUBS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function alreadySentToday(): boolean {
  try {
    if (!fs.existsSync(SENT_FILE)) return false;
    const record: SentRecord = JSON.parse(fs.readFileSync(SENT_FILE, "utf-8"));
    const today = new Date().toISOString().slice(0, 10);
    return record.date === today;
  } catch {
    return false;
  }
}

function markSentToday(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(SENT_FILE, JSON.stringify({ date: today }, null, 2));
}

function buildSummary(briefing: Record<string, unknown> | null): string {
  if (!briefing) return "Your daily briefing is ready";

  const parts: string[] = [];

  // Orbit last run — from orbitBriefing.compiled_at if available
  const orbitBriefing = briefing.orbitBriefing as Record<string, unknown> | null;
  if (orbitBriefing?.compiled_at) {
    const compiledAt = new Date(orbitBriefing.compiled_at as string);
    if (!isNaN(compiledAt.getTime())) {
      parts.push(
        `Orbit ran at ${compiledAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
      );
    }
  }

  // Scheduled today
  const content = briefing.content as Record<string, number> | null;
  const scheduledToday = content?.scheduledToday ?? 0;
  if (scheduledToday > 0) {
    parts.push(`${scheduledToday} post${scheduledToday === 1 ? "" : "s"} scheduled today`);
  }

  // Pending review
  const pendingReview = content?.pendingReview ?? 0;
  if (pendingReview > 0) {
    parts.push(`${pendingReview} pending review`);
  }

  return parts.length > 0 ? parts.join(" · ") : "Your daily briefing is ready";
}

export async function GET(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  if (alreadySentToday()) {
    return NextResponse.json({ sent: false, reason: "already_sent_today" });
  }

  // Fetch briefing data — call internally via localhost
  let briefing: Record<string, unknown> | null = null;
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const cookieHeader = req.headers.get("cookie") ?? "";

    const briefingRes = await fetch(
      `http://localhost:${process.env.PORT ?? 3005}/api/briefing`,
      {
        headers: {
          ...(authHeader ? { authorization: authHeader } : {}),
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
        },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      }
    );
    if (briefingRes.ok) {
      briefing = await briefingRes.json();
    }
  } catch {
    // Fall through — use generic summary
  }

  const notifTitle = "☀️ Morning briefing";
  const notifBody = buildSummary(briefing);
  const notifUrl = "/";

  // Send push notifications
  const keys = getOrCreateVapidKeys();
  const mailto = process.env.VAPID_MAILTO ?? "mailto:hello@sammii.dev";
  webpush.setVapidDetails(mailto, keys.publicKey, keys.privateKey);

  const subs = loadSubscriptions();
  let sent = 0;
  const dead: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      if (!sub.endpoint) return;
      try {
        await webpush.sendNotification(
          sub as webpush.PushSubscription,
          JSON.stringify({ title: notifTitle, body: notifBody, url: notifUrl })
        );
        sent++;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 410 || statusCode === 404) {
          dead.push(sub.endpoint);
        }
      }
    })
  );

  // Clean up expired subscriptions
  if (dead.length > 0) {
    const live = subs.filter((s) => s.endpoint && !dead.includes(s.endpoint));
    fs.writeFileSync(SUBS_FILE, JSON.stringify(live, null, 2));
  }

  markSentToday();

  return NextResponse.json({ sent, total: subs.length });
}
