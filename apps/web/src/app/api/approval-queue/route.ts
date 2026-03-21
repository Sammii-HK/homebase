import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";
import { readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const DISMISSED_FILE = path.join(process.cwd(), "src/app/data/dismissed-orbit-posts.json");

async function loadDismissedIds(): Promise<Set<string>> {
  try {
    const raw = await readFile(DISMISSED_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

const AUTO_APPROVE_SCORE_THRESHOLD = 82;

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
  score?: number;
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

interface OrbitDraftContent {
  id?: string;
  account_set_id?: string;
  account_name?: string;
  platform?: string;
  pillar?: string;
  format?: string;
  content?: string;
  thread_slides?: string[] | null;
}

export interface ApprovalItem {
  id: string;
  content: string;
  platform: string;
  accountName: string;
  createdAt: string;
  source: "spellcast" | "orbit";
  threadSlides?: string[];
}

async function approvePostInSpellcast(
  postId: string,
  apiKey: string,
  spellcastUrl: string
): Promise<void> {
  // Fetch currently scheduled times to pick next available slot
  const scheduledRes = await fetch(`${spellcastUrl}/api/posts?status=scheduled&limit=200`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(5000),
    cache: "no-store",
  });
  const scheduledKeys = new Set<string>();
  if (scheduledRes.ok) {
    const data = await scheduledRes.json();
    const posts = Array.isArray(data) ? data : data.posts ?? data.data ?? [];
    for (const p of posts) {
      const t = p.scheduledFor ?? p.scheduledAt ?? p.scheduledDate ?? "";
      if (t) scheduledKeys.add(t.slice(0, 13));
    }
  }

  // US-optimised slots (UTC hours)
  const SLOT_HOURS_UTC = [14, 16, 17, 21, 22, 25];
  const now = new Date();
  let scheduledDate: string | null = null;

  for (let dayOffset = 0; dayOffset < 7 && !scheduledDate; dayOffset++) {
    for (const hourUtc of SLOT_HOURS_UTC) {
      const actualHour = hourUtc % 24;
      const actualDayOffset = dayOffset + Math.floor(hourUtc / 24);
      const candidate = new Date(now);
      candidate.setUTCDate(candidate.getUTCDate() + actualDayOffset);
      candidate.setUTCHours(actualHour, 0, 0, 0);
      if (candidate.getTime() < now.getTime() + 15 * 60_000) continue;
      const key = candidate.toISOString().slice(0, 13);
      if (!scheduledKeys.has(key)) {
        scheduledDate = candidate.toISOString();
        break;
      }
    }
  }

  if (!scheduledDate) {
    scheduledDate = new Date(now.getTime() + 24 * 60 * 60_000).toISOString();
  }

  await fetch(`${spellcastUrl}/api/posts/${postId}/schedule`, {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ date: scheduledDate }),
    signal: AbortSignal.timeout(5000),
  });
}

export async function GET(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  const apiKey = process.env.SPELLCAST_API_KEY;
  const spellcastUrl = process.env.SPELLCAST_API_URL ?? "https://api.spellcast.sammii.dev";

  const dismissedIds = await loadDismissedIds();

  const items: ApprovalItem[] = [];
  let autoApproved = 0;

  // Fetch pending review posts from Spellcast
  if (apiKey) {
    try {
      const res = await fetch(`${spellcastUrl}/api/posts?status=pending_review`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        const posts: SpellcastPost[] = Array.isArray(data)
          ? data
          : data.posts ?? data.data ?? [];

        for (const p of posts) {
          const postId = String(p.id ?? p._id ?? "");

          // Check if the list response already has a score; if not, fetch the full post
          let score = typeof p.score === "number" ? p.score : undefined;

          if (score === undefined && postId) {
            try {
              const fullRes = await fetch(`${spellcastUrl}/api/posts/${postId}`, {
                headers: { Authorization: `Bearer ${apiKey}` },
                signal: AbortSignal.timeout(4000),
                cache: "no-store",
              });
              if (fullRes.ok) {
                const full: SpellcastPost = await fullRes.json();
                if (typeof full.score === "number") score = full.score;
              }
            } catch {
              // If fetching full post fails, proceed without score
            }
          }

          // Auto-approve high-scoring posts
          if (typeof score === "number" && score >= AUTO_APPROVE_SCORE_THRESHOLD) {
            try {
              await approvePostInSpellcast(postId, apiKey, spellcastUrl);
              autoApproved++;
            } catch {
              // If auto-approval fails, fall through and include in queue
              items.push({
                id: postId,
                content: String(p.content ?? p.text ?? ""),
                platform: String(p.socialAccount?.platform ?? p.platform ?? "unknown"),
                accountName: String(p.socialAccount?.name ?? ""),
                createdAt: String(p.createdAt ?? p.created_at ?? new Date().toISOString()),
                source: "spellcast",
              });
            }
            continue;
          }

          items.push({
            id: postId,
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
        const content = String(item.content ?? item.title ?? "").trim();
        if (!content) continue; // skip blank posts
        items.push({
          id: `orbit-${item.id ?? Math.random().toString(36).slice(2)}`,
          content,
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

  // Fetch Orbit draft-content (bypasses broken scheduler)
  try {
    const res = await fetch("https://orbit.sammii.dev/api/state", {
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      const draftContent = data?.queue?.["draft-content"];
      if (draftContent?.exists && Array.isArray(draftContent.content) && draftContent.content.length > 0) {
        const drafts: OrbitDraftContent[] = draftContent.content;
        // Use Orbit state timestamp as stable reference for all drafts
        const orbitStateTime = data?.compiled_at ?? data?.ts ?? new Date().toISOString();
        drafts.forEach((draft, index) => {
          const content = (draft.content ?? "").trim();
          if (!content) return; // skip blank drafts
          const item: ApprovalItem = {
            id: `orbit-draft-${draft.id ?? index}`,
            content,
            platform: draft.platform ?? "unknown",
            accountName: draft.account_name ?? "Orbit",
            createdAt: orbitStateTime,
            source: "orbit",
          };
          if (Array.isArray(draft.thread_slides) && draft.thread_slides.length > 0) {
            item.threadSlides = draft.thread_slides;
          }
          items.push(item);
        });
      }
    }
  } catch {
    // Orbit may be offline - that's fine
  }

  // Filter out dismissed orbit items
  const filteredItems = items.filter(
    (item) => item.source !== "orbit" || !dismissedIds.has(item.id)
  );

  // Sort by created date, newest first
  filteredItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({ items: filteredItems, count: filteredItems.length, autoApproved });
}
