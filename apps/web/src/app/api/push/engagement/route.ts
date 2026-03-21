import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";
import webpush from "web-push";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const DATA_DIR = path.join(process.cwd(), "..", "..", "app", "data");
const SUBS_FILE = path.join(DATA_DIR, "push-subscriptions.json");
const VAPID_FILE = path.join(DATA_DIR, "vapid-keys.json");
const SENT_FILE = path.join(DATA_DIR, "engagement-push-sent.json");

const MAX_SENT_IDS = 500;
const HIGH_RELEVANCE_THRESHOLD = 0.7;

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

interface EngagementItem {
  id?: string;
  _id?: string;
  relevanceScore?: number;
  score?: number;
  authorHandle?: string;
  author_handle?: string;
  content?: string;
  text?: string;
}

function getOrCreateVapidKeys(): VapidKeys {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(VAPID_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(VAPID_FILE, "utf-8")) as VapidKeys;
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
    return JSON.parse(fs.readFileSync(SUBS_FILE, "utf-8")) as PushSubscriptionJSON[];
  } catch {
    return [];
  }
}

function loadSentIds(): string[] {
  try {
    if (!fs.existsSync(SENT_FILE)) return [];
    return JSON.parse(fs.readFileSync(SENT_FILE, "utf-8")) as string[];
  } catch {
    return [];
  }
}

function saveSentIds(ids: string[]): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  // Keep last MAX_SENT_IDS to prevent unbounded growth
  const trimmed = ids.slice(-MAX_SENT_IDS);
  fs.writeFileSync(SENT_FILE, JSON.stringify(trimmed, null, 2));
}

async function sendPushToAll(
  title: string,
  body: string,
  url: string,
  keys: VapidKeys,
  subs: PushSubscriptionJSON[]
): Promise<void> {
  const mailto = process.env.VAPID_MAILTO ?? "mailto:hello@sammii.dev";
  webpush.setVapidDetails(mailto, keys.publicKey, keys.privateKey);

  const dead: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      if (!sub.endpoint) return;
      try {
        await webpush.sendNotification(
          sub as webpush.PushSubscription,
          JSON.stringify({ title, body, url })
        );
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
}

export async function GET(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  const apiKey = process.env.SPELLCAST_API_KEY;
  const spellcastUrl = process.env.SPELLCAST_API_URL ?? "https://api.spellcast.sammii.dev";

  if (!apiKey) {
    return NextResponse.json({ notified: 0 });
  }

  let engagements: EngagementItem[] = [];
  try {
    const res = await fetch(`${spellcastUrl}/api/engagement?status=unread&limit=20`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      engagements = Array.isArray(data)
        ? (data as EngagementItem[])
        : ((data.items ?? data.engagements ?? data.data ?? []) as EngagementItem[]);
    }
  } catch (e: unknown) {
    console.error("[homebase] push/engagement fetch failed:", e);
    return NextResponse.json({ notified: 0 });
  }

  const sentIds = loadSentIds();
  const sentSet = new Set(sentIds);

  const highRelevance = engagements.filter((item) => {
    const id = String(item.id ?? item._id ?? "");
    if (!id) return false;
    const relevance = item.relevanceScore ?? item.score ?? 0;
    return relevance > HIGH_RELEVANCE_THRESHOLD && !sentSet.has(id);
  });

  if (highRelevance.length === 0) {
    return NextResponse.json({ notified: 0 });
  }

  const keys = getOrCreateVapidKeys();
  const subs = loadSubscriptions();

  const newlySentIds: string[] = [];

  for (const item of highRelevance) {
    const id = String(item.id ?? item._id ?? "");
    const handle = String(item.authorHandle ?? item.author_handle ?? "unknown");
    const rawContent = String(item.content ?? item.text ?? "");
    const truncated = rawContent.length > 80 ? rawContent.slice(0, 77) + "..." : rawContent;

    await sendPushToAll(
      "💬 New engagement opportunity",
      `@${handle}: ${truncated}`,
      "/",
      keys,
      subs
    );

    newlySentIds.push(id);
  }

  // Append newly notified IDs and persist
  const updatedIds = [...sentIds, ...newlySentIds];
  saveSentIds(updatedIds);

  return NextResponse.json({ notified: newlySentIds.length });
}
