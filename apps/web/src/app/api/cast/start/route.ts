import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

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

export async function POST(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  let body: { url?: string; company?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url, company = "" } = body;

  if (!url || typeof url !== "string" || !url.trim()) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const job: CastQueueJob = {
    id: randomUUID(),
    url: url.trim(),
    company: company.trim(),
    requestedAt: new Date().toISOString(),
    status: "pending",
  };

  const queue = readQueue();
  queue.push(job);
  writeQueue(queue);

  return NextResponse.json({
    ok: true,
    jobId: job.id,
    message: "Queued — Cast will pick this up on next heartbeat",
  });
}
