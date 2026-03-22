import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";
import { runAutoApprove } from "@/lib/auto-approve";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  let body: { threshold?: number } = {};
  try {
    body = await req.json();
  } catch {
    // Default threshold will be used
  }

  const threshold = typeof body.threshold === "number" ? body.threshold : 80;

  const apiKey = process.env.SPELLCAST_API_KEY;
  const spellcastUrl = process.env.SPELLCAST_API_URL ?? "https://api.spellcast.sammii.dev";

  if (!apiKey) {
    return NextResponse.json({ error: "No API key configured" }, { status: 500 });
  }

  try {
    const { approved, errors } = await runAutoApprove(threshold, apiKey, spellcastUrl);
    return NextResponse.json({
      ok: true,
      approved,
      errors: errors.length > 0 ? errors : undefined,
      threshold,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Auto-approve failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
