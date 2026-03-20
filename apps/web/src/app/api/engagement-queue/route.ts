import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface SpellcastEngagement {
  id?: string;
  _id?: string;
  platform?: string;
  type?: string;
  authorName?: string;
  authorHandle?: string;
  author_name?: string;
  author_handle?: string;
  content?: string;
  text?: string;
  postContent?: string;
  post_content?: string;
  platformUrl?: string;
  platform_url?: string;
  createdAt?: string;
  created_at?: string;
}

interface OrbitEngagement {
  id?: string;
  platform?: string;
  type?: string;
  authorName?: string;
  authorHandle?: string;
  content?: string;
  postContent?: string;
  suggestedReply?: string;
  suggested_reply?: string;
  platformUrl?: string;
  createdAt?: string;
}

export interface EngagementItem {
  id: string;
  platform: string;
  type: "comment" | "mention" | "dm";
  authorName: string;
  authorHandle: string;
  content: string;
  postContent: string;
  suggestedReply: string;
  platformUrl: string;
  createdAt: string;
}

function normaliseType(raw: string): "comment" | "mention" | "dm" {
  const t = raw.toLowerCase();
  if (t === "dm" || t === "direct_message") return "dm";
  if (t === "mention") return "mention";
  return "comment";
}

export async function GET(req: NextRequest) {
  const denied = checkAuth(req);
  if (denied) return denied;

  const apiKey = process.env.SPELLCAST_API_KEY;
  const spellcastUrl = process.env.SPELLCAST_API_URL ?? "https://api.spellcast.sammii.dev";
  const orbitUrl = process.env.ORBIT_URL ?? "http://localhost:3001";

  const items: EngagementItem[] = [];

  // 1. Fetch unread engagement from Spellcast
  if (apiKey) {
    try {
      const res = await fetch(`${spellcastUrl}/api/engagement?status=unread&limit=30`, {
        headers: { "x-api-key": apiKey },
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        const engagements: SpellcastEngagement[] = Array.isArray(data)
          ? data
          : data.items ?? data.engagements ?? data.data ?? [];

        // Fetch AI reply suggestions in parallel for each engagement
        const withSuggestions = await Promise.all(
          engagements.map(async (e) => {
            const id = String(e.id ?? e._id ?? "");
            let suggestedReply = "";

            try {
              const suggestRes = await fetch(
                `${spellcastUrl}/api/engagement/${id}/suggest-reply`,
                {
                  headers: { "x-api-key": apiKey },
                  signal: AbortSignal.timeout(5000),
                  cache: "no-store",
                }
              );
              if (suggestRes.ok) {
                const suggestData = await suggestRes.json();
                suggestedReply = String(
                  suggestData.reply ?? suggestData.suggestion ?? suggestData.content ?? ""
                );
              }
            } catch {
              // Endpoint may not exist yet -- that is fine
            }

            return { engagement: e, id, suggestedReply };
          })
        );

        for (const { engagement: e, id, suggestedReply } of withSuggestions) {
          items.push({
            id,
            platform: String(e.platform ?? "unknown"),
            type: normaliseType(String(e.type ?? "comment")),
            authorName: String(e.authorName ?? e.author_name ?? ""),
            authorHandle: String(e.authorHandle ?? e.author_handle ?? ""),
            content: String(e.content ?? e.text ?? ""),
            postContent: String(e.postContent ?? e.post_content ?? ""),
            suggestedReply,
            platformUrl: String(e.platformUrl ?? e.platform_url ?? ""),
            createdAt: String(e.createdAt ?? e.created_at ?? new Date().toISOString()),
          });
        }
      }
    } catch (e) {
      console.error("[homebase] engagement-queue spellcast fetch failed:", e);
    }
  }

  // 2. Also try Orbit engagement queue (3s timeout, may not exist)
  try {
    const res = await fetch(`${orbitUrl}/api/state/engagement-queue`, {
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      const orbitItems: OrbitEngagement[] = Array.isArray(data)
        ? data
        : data.items ?? data.queue ?? data.opportunities ?? [];

      for (const item of orbitItems) {
        items.push({
          id: `orbit-${item.id ?? Math.random().toString(36).slice(2)}`,
          platform: String(item.platform ?? "unknown"),
          type: normaliseType(String(item.type ?? "comment")),
          authorName: String(item.authorName ?? ""),
          authorHandle: String(item.authorHandle ?? ""),
          content: String(item.content ?? ""),
          postContent: String(item.postContent ?? ""),
          suggestedReply: String(item.suggestedReply ?? item.suggested_reply ?? ""),
          platformUrl: String(item.platformUrl ?? ""),
          createdAt: String(item.createdAt ?? new Date().toISOString()),
        });
      }
    }
  } catch {
    // Orbit may be offline or endpoint may not exist -- that is fine
  }

  // Sort by created date, newest first
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({ items, count: items.length });
}
