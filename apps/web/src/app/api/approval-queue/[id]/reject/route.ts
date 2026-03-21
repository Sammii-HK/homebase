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

  const orbitUrl = process.env.ORBIT_URL ?? "http://localhost:3001";

  if (id.startsWith("orbit-")) {
    // Orbit rejections are logged only for now
    console.log(`[homebase] Orbit content rejected: ${id}`);
    // Fire-and-forget feedback to Orbit
    fetch(`${orbitUrl}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postId: id,
        action: "rejected" as const,
        reason: undefined,
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => {});
    return NextResponse.json({ ok: true, message: "Orbit content rejected (logged)" });
  }

  let body: { reason?: string } = {};
  try {
    body = await req.json();
  } catch {
    // No body is fine
  }

  console.log(`[homebase] Post ${id} rejected. Reason: ${body.reason ?? "none given"}`);

  try {
    const res = await fetch(`${spellcastUrl}/api/posts/${id}/reject`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason: body.reason }),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: `Reject failed: ${err}` },
        { status: res.status }
      );
    }

    // Fire-and-forget feedback to Orbit
    fetch(`${orbitUrl}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postId: id,
        action: "rejected" as const,
        reason: body.reason,
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      message: "Post rejected",
      reason: body.reason ?? null,
    });
  } catch (e) {
    console.error("[homebase] reject failed:", e);
    return NextResponse.json({ error: "Failed to reject post" }, { status: 502 });
  }
}
