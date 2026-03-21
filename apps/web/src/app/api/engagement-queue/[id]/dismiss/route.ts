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

  try {
    const res = await fetch(`${spellcastUrl}/api/engagement/${id}/mark-read`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: `Dismiss failed: ${err}` },
        { status: res.status }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Dismissed",
    });
  } catch (e) {
    console.error("[homebase] engagement dismiss failed:", e);
    return NextResponse.json({ error: "Failed to dismiss engagement" }, { status: 502 });
  }
}
