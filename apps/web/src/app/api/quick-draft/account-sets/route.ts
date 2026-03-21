import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface AccountSet {
  id: string;
  name: string;
}

interface SpellcastAccountSet {
  id?: string;
  _id?: string;
  name?: string;
}

export async function GET(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  const apiKey = process.env.SPELLCAST_API_KEY;
  const spellcastUrl = process.env.SPELLCAST_API_URL ?? "https://api.spellcast.sammii.dev";

  if (!apiKey) {
    return NextResponse.json([] as AccountSet[]);
  }

  try {
    const res = await fetch(`${spellcastUrl}/api/account-sets`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[homebase] account-sets fetch error:", res.status);
      return NextResponse.json([] as AccountSet[]);
    }

    const data = await res.json();
    const raw: SpellcastAccountSet[] = Array.isArray(data)
      ? data
      : data.items ?? data.accountSets ?? data.data ?? [];

    const sets: AccountSet[] = raw
      .filter((s) => (s.id ?? s._id) && s.name)
      .map((s) => ({
        id: String(s.id ?? s._id ?? ""),
        name: String(s.name ?? ""),
      }));

    return NextResponse.json(sets);
  } catch (e: unknown) {
    console.error("[homebase] account-sets fetch failed:", e);
    return NextResponse.json([] as AccountSet[]);
  }
}
