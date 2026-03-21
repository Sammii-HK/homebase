import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const DATA_DIR = path.join(process.cwd(), "..", "..", "app", "data");
const SUBS_FILE = path.join(DATA_DIR, "push-subscriptions.json");

function loadSubscriptions(): PushSubscriptionJSON[] {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(SUBS_FILE)) return [];
    return JSON.parse(fs.readFileSync(SUBS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function saveSubscriptions(subs: PushSubscriptionJSON[]): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2));
}

export async function POST(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  let body: { subscription: PushSubscriptionJSON };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { subscription } = body;
  if (!subscription?.endpoint) {
    return NextResponse.json({ error: "subscription.endpoint required" }, { status: 400 });
  }

  const subs = loadSubscriptions();

  // Replace existing subscription for the same endpoint
  const idx = subs.findIndex((s) => s.endpoint === subscription.endpoint);
  if (idx >= 0) {
    subs[idx] = subscription;
  } else {
    subs.push(subscription);
  }

  saveSubscriptions(subs);

  return NextResponse.json({ ok: true });
}
