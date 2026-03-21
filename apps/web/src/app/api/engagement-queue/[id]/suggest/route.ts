import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DEFAULT_ACCOUNT_SET_ID = "a190e806-5bac-497b-88bd-b1d96ed1f2e8";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  const { id } = await params;
  const apiKey = process.env.SPELLCAST_API_KEY;
  const spellcastUrl = process.env.SPELLCAST_API_URL ?? "https://api.spellcast.sammii.dev";

  // Allow the UI to pass the correct accountSetId for brand voice
  const accountSetId =
    req.nextUrl.searchParams.get("accountSetId") ?? DEFAULT_ACCOUNT_SET_ID;

  if (!apiKey) {
    return NextResponse.json({ error: "No API key configured" }, { status: 500 });
  }

  try {
    const res = await fetch(
      `${spellcastUrl}/api/engagement/${id}/ai-reply`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tone: "helpful", accountSetId }),
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: `AI suggestion failed: ${err}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    // Response is { suggestions: [{tone, content}], sentiment }
    const suggestions = data.suggestions as Array<{ tone: string; content: string }> | undefined;
    const reply = String(
      suggestions?.[0]?.content ?? data.reply ?? data.suggestion ?? data.content ?? ""
    );

    return NextResponse.json({ reply });
  } catch (e) {
    console.error("[homebase] engagement AI suggest failed:", e);
    return NextResponse.json({ error: "Failed to get AI suggestion" }, { status: 502 });
  }
}
