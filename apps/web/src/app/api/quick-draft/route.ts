import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_CONTENT_LENGTH = 2000;

interface SpellcastPostResponse {
  id?: string;
  _id?: string;
}

export async function POST(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("content" in body) ||
    typeof (body as Record<string, unknown>).content !== "string"
  ) {
    return NextResponse.json({ error: "content is required and must be a string" }, { status: 400 });
  }

  const content = ((body as Record<string, unknown>).content as string).trim();

  if (!content) {
    return NextResponse.json({ error: "content must not be empty" }, { status: 400 });
  }

  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json(
      { error: `content must be ${MAX_CONTENT_LENGTH} characters or fewer` },
      { status: 400 }
    );
  }

  const bodyRecord = body as Record<string, unknown>;
  const accountSetId =
    typeof bodyRecord.accountSetId === "string" && bodyRecord.accountSetId
      ? bodyRecord.accountSetId
      : (process.env.SPELLCAST_DEFAULT_ACCOUNT_SET_ID ?? undefined);

  const apiKey = process.env.SPELLCAST_API_KEY;
  const spellcastUrl = process.env.SPELLCAST_API_URL ?? "https://api.spellcast.sammii.dev";

  if (!apiKey) {
    return NextResponse.json({ error: "Spellcast API key not configured" }, { status: 503 });
  }

  try {
    // Save as a brain dump (feeds into Spellcast's dump → post conversion workflow)
    const res = await fetch(`${spellcastUrl}/api/dumps`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ content, targetType: "post", ...(accountSetId ? { accountSetId } : {}) }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[homebase] quick-draft spellcast error:", res.status, errText);
      return NextResponse.json(
        { error: `Spellcast returned ${res.status}` },
        { status: 502 }
      );
    }

    const data: SpellcastPostResponse = await res.json();
    const id = String(data.id ?? data._id ?? "");

    return NextResponse.json({ ok: true, id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[homebase] quick-draft fetch failed:", msg);
    return NextResponse.json({ error: "Failed to reach Spellcast" }, { status: 502 });
  }
}
