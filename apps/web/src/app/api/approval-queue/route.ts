import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface SpellcastPost {
  id?: string;
  _id?: string;
  content?: string;
  text?: string;
  status?: string;
  platform?: string;
  socialAccount?: { platform?: string; name?: string };
  scheduledFor?: string;
  scheduledAt?: string;
  scheduledDate?: string;
  createdAt?: string;
  created_at?: string;
  source?: string;
}

interface OrbitContent {
  id?: string;
  title?: string;
  content?: string;
  platform?: string;
  persona?: string;
  score?: number;
  createdAt?: string;
}

export interface ApprovalItem {
  id: string;
  content: string;
  platform: string;
  accountName: string;
  createdAt: string;
  source: "spellcast" | "orbit";
}

export async function GET(req: NextRequest) {
  const denied = checkAuth(req);
  if (denied) return denied;

  const apiKey = process.env.SPELLCAST_API_KEY;
  const spellcastUrl = process.env.SPELLCAST_API_URL ?? "https://api.spellcast.sammii.dev";

  const items: ApprovalItem[] = [];

  // Fetch pending review posts from Spellcast
  if (apiKey) {
    try {
      const res = await fetch(`${spellcastUrl}/api/posts?status=pending_review`, {
        headers: { "x-api-key": apiKey },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        const posts: SpellcastPost[] = Array.isArray(data)
          ? data
          : data.posts ?? data.data ?? [];

        for (const p of posts) {
          items.push({
            id: String(p.id ?? p._id ?? ""),
            content: String(p.content ?? p.text ?? ""),
            platform: String(p.socialAccount?.platform ?? p.platform ?? "unknown"),
            accountName: String(p.socialAccount?.name ?? ""),
            createdAt: String(p.createdAt ?? p.created_at ?? new Date().toISOString()),
            source: "spellcast",
          });
        }
      }
    } catch (e) {
      console.error("[homebase] approval-queue spellcast fetch failed:", e);
    }
  }

  // Fetch Orbit approved content (may not exist yet)
  try {
    const res = await fetch("https://orbit.sammii.dev/api/queue/approved-content", {
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      const orbitItems: OrbitContent[] = Array.isArray(data)
        ? data
        : data.items ?? data.content ?? [];

      for (const item of orbitItems) {
        items.push({
          id: `orbit-${item.id ?? Math.random().toString(36).slice(2)}`,
          content: String(item.content ?? item.title ?? ""),
          platform: String(item.platform ?? "unknown"),
          accountName: item.persona ?? "Orbit",
          createdAt: String(item.createdAt ?? new Date().toISOString()),
          source: "orbit",
        });
      }
    }
    // 404 is expected if endpoint doesn't exist yet
  } catch {
    // Orbit may be offline or endpoint may not exist - that's fine
  }

  // Sort by created date, newest first
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({ items, count: items.length });
}
