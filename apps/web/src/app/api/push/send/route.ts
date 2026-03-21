import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const DATA_DIR = path.join(process.cwd(), "..", "..", "app", "data");
const SUBS_FILE = path.join(DATA_DIR, "push-subscriptions.json");
const VAPID_FILE = path.join(DATA_DIR, "vapid-keys.json");

interface VapidKeys {
  publicKey: string;
  privateKey: string;
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

export async function POST(req: NextRequest) {
  // Bearer-only: this endpoint is for internal/cron use
  const secret = process.env.HOMEBASE_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  let body: { title: string; body: string; url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { title, body: msgBody, url = "/" } = body;
  if (!title || !msgBody) {
    return NextResponse.json({ error: "title and body required" }, { status: 400 });
  }

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
          JSON.stringify({ title, body: msgBody, url })
        );
        sent++;
      } catch (err: unknown) {
        // 410 Gone / 404 = subscription expired — remove it
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

  return NextResponse.json({ sent, total: subs.length });
}
