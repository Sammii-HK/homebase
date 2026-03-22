import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { checkAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DATA_DIR = process.env.PASSKEY_DATA_DIR ?? "/app/data";
const HISTORY_FILE = path.join(DATA_DIR, "chat-history.json");
const MAX_MESSAGES = 40;

export async function GET(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;
  try {
    const raw = await fs.readFile(HISTORY_FILE, "utf8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;
  try {
    const messages = await req.json();
    const toStore = Array.isArray(messages) ? messages.slice(-MAX_MESSAGES) : [];
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(HISTORY_FILE, JSON.stringify(toStore, null, 2), "utf8");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
