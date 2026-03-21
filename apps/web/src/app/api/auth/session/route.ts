import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get("hb_session");
  if (!cookie?.value) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const valid = await verifySession(cookie.value);
  if (!valid) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
