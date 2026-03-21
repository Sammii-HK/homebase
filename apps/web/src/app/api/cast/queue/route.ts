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

export async function GET(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  const queue = readQueue();
  const pending = queue.filter((j) => j.status === "pending");

  return NextResponse.json({ jobs: pending, total: pending.length });
}
