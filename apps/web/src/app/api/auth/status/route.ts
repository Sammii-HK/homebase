import { NextResponse } from "next/server";
import { hasCredential } from "@/lib/passkey-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const registered = await hasCredential();
  return NextResponse.json({ registered });
}
