import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const DATA_DIR = path.join(process.cwd(), "..", "..", "app", "data");
const RETRY_STATE_FILE = path.join(DATA_DIR, "retry-state.json");

const MAX_ATTEMPTS = 3;
const BACKOFF_MINUTES = 30; // Minimum minutes between retries

interface RetryEntry {
  attempts: number;
  lastAttempt: string; // ISO timestamp
  status: "pending" | "escalated";
}

function loadRetryState(): Record<string, RetryEntry> {
  try {
    if (!fs.existsSync(RETRY_STATE_FILE)) return {};
    return JSON.parse(fs.readFileSync(RETRY_STATE_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function saveRetryState(state: Record<string, RetryEntry>) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(RETRY_STATE_FILE, JSON.stringify(state, null, 2));
  } catch {
    // Best effort
  }
}

export async function POST(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  const apiKey = process.env.SPELLCAST_API_KEY;
  const spellcastUrl = process.env.SPELLCAST_API_URL ?? "https://api.spellcast.sammii.dev";
  const secret = process.env.HOMEBASE_SECRET;
  const port = process.env.PORT ?? "3005";

  if (!apiKey) {
    return NextResponse.json({ error: "No API key configured" }, { status: 500 });
  }

  // Fetch failed posts from stats
  let failedPostDetails: { id: string; platform: string; error: string }[] = [];
  try {
    const statsRes = await fetch(`http://localhost:${port}/api/stats`, {
      headers: { ...(secret ? { Authorization: `Bearer ${secret}` } : {}) },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (statsRes.ok) {
      const stats = await statsRes.json();
      failedPostDetails = stats?.content?.failedPostDetails ?? [];
    }
  } catch {
    // Fall back to direct Spellcast call
    try {
      const res = await fetch(`${spellcastUrl}/api/posts?status=failed&limit=20`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(6000),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        const posts = Array.isArray(data) ? data : data.posts ?? data.data ?? [];
        failedPostDetails = posts.slice(0, 5).map((p: Record<string, unknown>) => ({
          id: String(p.id ?? p._id ?? ""),
          platform: String(p.platform ?? "unknown"),
          error: String(p.error ?? p.failedReason ?? "Unknown error"),
        }));
      }
    } catch {
      return NextResponse.json({ error: "Could not fetch failed posts" }, { status: 502 });
    }
  }

  const state = loadRetryState();
  const now = new Date();
  let retried = 0;
  let skipped = 0;
  let escalated = 0;

  for (const post of failedPostDetails) {
    if (!post.id) continue;

    const entry = state[post.id] ?? { attempts: 0, lastAttempt: new Date(0).toISOString(), status: "pending" as const };

    // Already escalated — skip
    if (entry.status === "escalated") {
      skipped++;
      continue;
    }

    // Max attempts reached — escalate
    if (entry.attempts >= MAX_ATTEMPTS) {
      state[post.id] = { ...entry, status: "escalated" };
      escalated++;
      continue;
    }

    // Too soon for another attempt
    const minsSinceLast = (now.getTime() - new Date(entry.lastAttempt).getTime()) / 60_000;
    if (minsSinceLast < BACKOFF_MINUTES) {
      skipped++;
      continue;
    }

    // Retry via actions endpoint
    try {
      const retryRes = await fetch(`http://localhost:${port}/api/actions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
        },
        body: JSON.stringify({ action: "retry-post", postId: post.id }),
        signal: AbortSignal.timeout(8000),
      });

      state[post.id] = {
        attempts: entry.attempts + 1,
        lastAttempt: now.toISOString(),
        status: entry.attempts + 1 >= MAX_ATTEMPTS ? "escalated" : "pending",
      };

      if (retryRes.ok) {
        retried++;
        if (state[post.id].status === "escalated") escalated++;
      } else {
        skipped++;
      }
    } catch {
      skipped++;
    }
  }

  // Clean up state for posts that no longer appear in failed list
  const activeIds = new Set(failedPostDetails.map((p) => p.id));
  for (const id of Object.keys(state)) {
    if (!activeIds.has(id)) delete state[id];
  }

  saveRetryState(state);

  return NextResponse.json({ ok: true, retried, skipped, escalated });
}
