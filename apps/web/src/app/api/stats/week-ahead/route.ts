import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export interface WeekAheadPost {
  id: string;
  content: string;
  scheduledFor: string;
  platform: string;
  accountName: string;
}

export async function GET(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  const apiKey = process.env.SPELLCAST_API_KEY;
  const url = process.env.SPELLCAST_API_URL ?? "https://api.spellcast.sammii.dev";

  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  if (!apiKey) {
    return NextResponse.json([] as WeekAheadPost[]);
  }

  try {
    const res = await fetch(`${url}/api/posts?status=SCHEDULED&limit=50`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    }).catch(() => null);

    if (!res || !res.ok) {
      return NextResponse.json([] as WeekAheadPost[]);
    }

    let rawPosts: Record<string, unknown>[] = [];
    try {
      const data: unknown = await res.json();
      if (Array.isArray(data)) {
        rawPosts = data as Record<string, unknown>[];
      } else if (data && typeof data === "object") {
        const obj = data as Record<string, unknown>;
        const nested = obj.posts ?? obj.data;
        if (Array.isArray(nested)) {
          rawPosts = nested as Record<string, unknown>[];
        }
      }
    } catch {
      return NextResponse.json([] as WeekAheadPost[]);
    }

    const posts: WeekAheadPost[] = rawPosts
      .filter((post) => {
        const rawDate = String(
          post.scheduledFor ?? post.scheduledAt ?? post.scheduledDate ?? ""
        );
        if (!rawDate) return false;
        const d = new Date(rawDate);
        return d >= now && d <= sevenDaysLater;
      })
      .map((post) => {
        const rawContent = String(post.content ?? post.text ?? post.body ?? "");
        const truncated =
          rawContent.length > 120 ? rawContent.slice(0, 120) + "…" : rawContent;

        const scheduledFor = String(
          post.scheduledFor ?? post.scheduledAt ?? post.scheduledDate ?? ""
        );

        const platform = String(
          post.platform ??
            (post.platforms && Array.isArray(post.platforms) && post.platforms.length > 0
              ? post.platforms[0]
              : "") ??
            ""
        ).toLowerCase();

        const accountName = String(post.accountName ?? post.account ?? "");

        return {
          id: String(post.id ?? ""),
          content: truncated,
          scheduledFor,
          platform,
          accountName,
        };
      })
      .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());

    return NextResponse.json(posts);
  } catch {
    return NextResponse.json([] as WeekAheadPost[]);
  }
}
