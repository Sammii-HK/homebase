import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = checkAuth(req);
  if (denied) return denied;

  const { id } = await params;

  // Log the skip for future feedback loop
  console.log(`[homebase] Engagement ${id} skipped`);

  return NextResponse.json({
    ok: true,
    message: "Skipped",
  });
}
