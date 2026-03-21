import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ACCOUNT_SETS: Record<string, { id: string; name: string }> = {
  lunary: { id: "a190e806-5bac-497b-88bd-b1d96ed1f2e8", name: "lunary.app" },
  sammii: { id: "430eab81-ea60-4d11-9733-1bb126c5264c", name: "sammiihk" },
  sparkle: { id: "89cf0e70-7bd1-48c2-bd8a-39ce54357d12", name: "sammiisparkle" },
};

const LUNARY_ACCOUNT_SET_ID = ACCOUNT_SETS.lunary.id;
const MAX_AI_REPLY_CALLS = 5;
const MAX_ITEMS_RETURNED = 10;

/** Resolve which account set an engagement item belongs to based on its socialAccountId or accountSetId */
function resolveAccountSet(item: SpellcastEngagement): {
  accountSetId: string;
  accountName: string;
} {
  // If the item already has an accountSetId (e.g. from Orbit), use it
  const existingId = item.accountSetId ?? item.account_set_id ?? "";
  if (existingId) {
    for (const acct of Object.values(ACCOUNT_SETS)) {
      if (acct.id === existingId) {
        return { accountSetId: acct.id, accountName: acct.name };
      }
    }
    // Unknown account set -- return it raw
    return { accountSetId: existingId, accountName: existingId.slice(0, 8) };
  }
  // Default to Lunary
  return {
    accountSetId: ACCOUNT_SETS.lunary.id,
    accountName: ACCOUNT_SETS.lunary.name,
  };
}

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
  score?: number;
  accountSetId?: string;
  account_set_id?: string;
  accountName?: string;
  account_name?: string;
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
  score?: number;
  accountSetId?: string;
  accountName?: string;
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
  score: number;
  source: "spellcast" | "orbit";
  accountSetId?: string;
  accountName?: string;
}

function normaliseType(raw: string): "comment" | "mention" | "dm" {
  const t = raw.toLowerCase();
  if (t === "dm" || t === "direct_message") return "dm";
  if (t === "mention") return "mention";
  return "comment";
}

/** Simple content hash for deduplication */
function contentKey(platform: string, author: string, content: string): string {
  return `${platform}::${author}::${content.slice(0, 100).toLowerCase().trim()}`;
}

export async function GET(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  const apiKey = process.env.SPELLCAST_API_KEY;
  const spellcastUrl = process.env.SPELLCAST_API_URL ?? "https://api.spellcast.sammii.dev";
  const orbitUrl = process.env.ORBIT_URL ?? "http://localhost:3001";

  const items: EngagementItem[] = [];
  const seen = new Set<string>();

  // 1. Fetch unread engagement from Spellcast
  if (apiKey) {
    try {
      const res = await fetch(`${spellcastUrl}/api/engagement?status=unread&limit=20`, {
        headers: { "x-api-key": apiKey },
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        const engagements: SpellcastEngagement[] = Array.isArray(data)
          ? data
          : data.items ?? data.engagements ?? data.data ?? [];

        // Fetch AI reply suggestions for the top 5 items only (cap AI calls)
        const topForAI = engagements.slice(0, MAX_AI_REPLY_CALLS);
        const restWithoutAI = engagements.slice(MAX_AI_REPLY_CALLS);

        const aiResults = await Promise.all(
          topForAI.map(async (e) => {
            const id = String(e.id ?? e._id ?? "");
            const { accountSetId } = resolveAccountSet(e);
            let suggestedReply = "";

            try {
              const suggestRes = await fetch(
                `${spellcastUrl}/api/engagement/${id}/ai-reply?tone=helpful&accountSetId=${accountSetId}`,
                {
                  headers: { "x-api-key": apiKey },
                  signal: AbortSignal.timeout(8000),
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
              // AI reply endpoint failed -- show item without suggestion
            }

            return { engagement: e, id, suggestedReply };
          })
        );

        // Add items with AI suggestions
        for (const { engagement: e, id, suggestedReply } of aiResults) {
          const key = contentKey(
            String(e.platform ?? ""),
            String(e.authorHandle ?? e.author_handle ?? ""),
            String(e.content ?? e.text ?? "")
          );
          if (seen.has(key)) continue;
          seen.add(key);

          const { accountSetId, accountName } = resolveAccountSet(e);
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
            score: e.score ?? 0,
            source: "spellcast",
            accountSetId,
            accountName,
          });
        }

        // Add remaining items without AI suggestions
        for (const e of restWithoutAI) {
          const id = String(e.id ?? e._id ?? "");
          const key = contentKey(
            String(e.platform ?? ""),
            String(e.authorHandle ?? e.author_handle ?? ""),
            String(e.content ?? e.text ?? "")
          );
          if (seen.has(key)) continue;
          seen.add(key);

          const { accountSetId, accountName } = resolveAccountSet(e);
          items.push({
            id,
            platform: String(e.platform ?? "unknown"),
            type: normaliseType(String(e.type ?? "comment")),
            authorName: String(e.authorName ?? e.author_name ?? ""),
            authorHandle: String(e.authorHandle ?? e.author_handle ?? ""),
            content: String(e.content ?? e.text ?? ""),
            postContent: String(e.postContent ?? e.post_content ?? ""),
            suggestedReply: "",
            platformUrl: String(e.platformUrl ?? e.platform_url ?? ""),
            createdAt: String(e.createdAt ?? e.created_at ?? new Date().toISOString()),
            score: e.score ?? 0,
            source: "spellcast",
            accountSetId,
            accountName,
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
        const key = contentKey(
          String(item.platform ?? ""),
          String(item.authorHandle ?? ""),
          String(item.content ?? "")
        );
        if (seen.has(key)) continue;
        seen.add(key);

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
          score: item.score ?? 0,
          source: "orbit",
          accountSetId: item.accountSetId ?? LUNARY_ACCOUNT_SET_ID,
          accountName: item.accountName ?? ACCOUNT_SETS.lunary.name,
        });
      }
    }
  } catch {
    // Orbit may be offline or endpoint may not exist -- that is fine
  }

  // Sort: scored items first (highest score), then unscored by date
  items.sort((a, b) => {
    // Scored items (from Orbit or Spellcast with scores) come first
    if (a.score > 0 && b.score <= 0) return -1;
    if (b.score > 0 && a.score <= 0) return 1;
    if (a.score > 0 && b.score > 0) return b.score - a.score;
    // Unscored: newest first
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Cap at 10 items
  const capped = items.slice(0, MAX_ITEMS_RETURNED);

  return NextResponse.json({ items: capped, count: capped.length });
}
