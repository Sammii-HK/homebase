import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const DATA_FILE = path.join(process.cwd(), "src/app/data/dismissed-orbit-posts.json");

async function readDismissed(): Promise<string[]> {
  try {
    const raw = await readFile(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeDismissed(ids: string[]): Promise<void> {
  await mkdir(path.dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(ids, null, 2) + "\n", "utf-8");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const dismissed = await readDismissed();
  if (!dismissed.includes(id)) {
    dismissed.push(id);
    await writeDismissed(dismissed);
  }

  return NextResponse.json({ ok: true, id, total: dismissed.length });
}
