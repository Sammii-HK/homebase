import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  const { id } = await params;
  const apiKey = process.env.SPELLCAST_API_KEY;
  const spellcastUrl = process.env.SPELLCAST_API_URL ?? "https://api.spellcast.sammii.dev";

  if (!apiKey) {
    return NextResponse.json({ error: "No API key configured" }, { status: 500 });
  }

  let body: { reply?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.reply || body.reply.trim().length === 0) {
    return NextResponse.json({ error: "Reply content is required" }, { status: 400 });
  }

  try {
    const res = await fetch(`${spellcastUrl}/api/engagement/${id}/reply`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: body.reply.trim() }),
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: `Reply failed: ${err}` },
        { status: res.status }
      );
    }

    // Mark as read after successful reply so it clears from the queue
    try {
      await fetch(`${spellcastUrl}/api/engagement/${id}/mark-read`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(3000),
        cache: "no-store",
      });
    } catch {
      // Non-critical -- reply was sent, mark-read failing is not a blocker
      console.warn("[homebase] mark-read after reply failed for:", id);
    }

    return NextResponse.json({
      ok: true,
      message: "Reply sent",
    });
  } catch (e) {
    console.error("[homebase] engagement reply failed:", e);
    return NextResponse.json({ error: "Failed to send reply" }, { status: 502 });
  }
}
