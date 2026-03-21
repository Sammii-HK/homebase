import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const content = typeof body === "object" && body !== null && "content" in body
    ? String((body as Record<string, unknown>).content ?? "").trim()
    : "";

  if (!content) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const apiKey = process.env.SPELLCAST_API_KEY;
  const spellcastUrl = process.env.SPELLCAST_API_URL ?? "https://api.spellcast.sammii.dev";
  const accountSetId = process.env.SPELLCAST_DEFAULT_ACCOUNT_SET_ID;

  if (!apiKey) {
    return NextResponse.json({ error: "Spellcast API key not configured" }, { status: 503 });
  }

  try {
    const res = await fetch(`${spellcastUrl}/api/ai/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        action: "rewrite",
        content,
        ...(accountSetId ? { accountSetId } : {}),
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.error("[homebase] quick-draft/generate spellcast error:", res.status, err);
      return NextResponse.json({ error: `Spellcast returned ${res.status}` }, { status: 502 });
    }

    const data = await res.json() as { result?: string };
    return NextResponse.json({ result: data.result ?? content });
  } catch (e: unknown) {
    console.error("[homebase] quick-draft/generate failed:", e);
    return NextResponse.json({ error: "Failed to reach Spellcast" }, { status: 502 });
  }
}
