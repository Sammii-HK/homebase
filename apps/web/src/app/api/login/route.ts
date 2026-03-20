import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { secret } = (await req.json()) as { secret: string };
    const expected = process.env.HOMEBASE_SECRET;
    if (!expected || secret !== expected) {
      return NextResponse.json({ error: "invalid secret" }, { status: 401 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
}
