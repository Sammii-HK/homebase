import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const QUEUE_PATH = path.join(process.cwd(), "src/app/data/cast-queue.json");

interface CastQueueJob {
  id: string;
  url: string;
  company: string;
  requestedAt: string;
  status: "pending" | "running" | "done" | "failed";
}

function readQueue(): CastQueueJob[] {
  try {
    if (!fs.existsSync(QUEUE_PATH)) return [];
    return JSON.parse(fs.readFileSync(QUEUE_PATH, "utf-8")) as CastQueueJob[];
  } catch {
    return [];
  }
}

function writeQueue(jobs: CastQueueJob[]): void {
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(jobs, null, 2), "utf-8");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  const { id } = await params;

  const queue = readQueue();
  const idx = queue.findIndex((j) => j.id === id);

  if (idx === -1) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  queue[idx].status = "running";
  writeQueue(queue);

  return NextResponse.json({ ok: true, job: queue[idx] });
}
