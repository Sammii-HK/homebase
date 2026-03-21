import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const KOKORO_URL = process.env.KOKORO_URL ?? "http://127.0.0.1:8880";

export async function POST(req: NextRequest) {
  const authErr = await checkAuth(req);
  if (authErr) return authErr;

  let text: string;
  try {
    const body = await req.json();
    text = body.text?.trim();
    if (!text) return NextResponse.json({ error: "No text" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Truncate to 500 chars to keep responses snappy
  if (text.length > 500) text = text.slice(0, 500);

  try {
    const res = await fetch(`${KOKORO_URL}/v1/audio/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "kokoro",
        input: text,
        voice: "af_sky",
        response_format: "mp3",
        speed: 1.0,
      }),
    });

    if (!res.ok) {
      console.error("[tts] Kokoro error:", res.status);
      return NextResponse.json({ error: "TTS failed" }, { status: 502 });
    }

    const audioBuffer = await res.arrayBuffer();
    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[tts] Kokoro unreachable:", e);
    return NextResponse.json({ error: "TTS unavailable" }, { status: 503 });
  }
}
