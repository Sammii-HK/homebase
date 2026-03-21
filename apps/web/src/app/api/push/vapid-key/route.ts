import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const DATA_DIR = path.join(process.cwd(), "..", "..", "app", "data");
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

export async function GET(_req: NextRequest) {
  // Public endpoint — VAPID public key is safe to expose
  const keys = getOrCreateVapidKeys();
  return NextResponse.json({ publicKey: keys.publicKey });
}
