import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "./session";

export async function checkAuth(req: NextRequest): Promise<NextResponse | null> {
  const secret = process.env.HOMEBASE_SECRET;
  if (!secret) return null; // No secret configured, skip auth (local dev)

  // Check Bearer token (for scripts/heartbeat)
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) {
    return null; // Authorised via Bearer token
  }

  // Check hb_session cookie (for browser)
  const cookie = req.cookies.get("hb_session");
  if (cookie?.value) {
    const valid = await verifySession(cookie.value);
    if (valid) return null; // Authorised via session cookie
  }

  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
