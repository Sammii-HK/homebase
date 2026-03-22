import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";
import { writeMetricsSnapshot } from "@/lib/metrics-snapshot";

/**
 * POST /api/mcp-sync
 *
 * Accepts a structured metrics payload pushed from a Claude MCP session.
 * Claude uses Lunary + Spellcast MCP tools to get live data (bypassing
 * Cloudflare which blocks direct Hetzner → Lunary API calls), then pushes
 * it here to update the dashboard snapshot.
 *
 * Body:
 * {
 *   dau, mau, wau, mrr, signups7d,
 *   seoImpressions7d, seoClicks7d, seoCtr7d, seoPosition7d, seoDailyAvg,
 *   spellcastPostsToday?, spellcastQueueDepth?
 * }
 */
export async function POST(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  try {
    const body = await req.json() as {
      dau?: number; mau?: number; wau?: number; mrr?: number; signups7d?: number;
      seoImpressions7d?: number; seoClicks7d?: number; seoCtr7d?: number;
      seoPosition7d?: number; seoDailyAvg?: number;
      source?: string;
    };

    const ts = new Date().toISOString();
    writeMetricsSnapshot(body, ts);

    return NextResponse.json({ ok: true, ts, source: body.source ?? "mcp" });
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
}
