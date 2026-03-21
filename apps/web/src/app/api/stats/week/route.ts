import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export interface WeekDay {
  date: string;       // "2026-03-23"
  dayLabel: string;   // "Mon"
  isToday: boolean;
  scheduled: number;
  review: number;
  published: number;
  hasGap: boolean;    // true if scheduled === 0 and day hasn't passed
}

export interface WeekResponse {
  week: WeekDay[];
  totalScheduled: number;
  totalReview: number;
  gaps: number;
}

function getMondayOfWeek(d: Date): Date {
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  // Days since Monday (treat Sunday as day 7 → offset 6)
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export async function GET(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  const apiKey = process.env.SPELLCAST_API_KEY;
  const url = process.env.SPELLCAST_API_URL ?? "https://api.spellcast.sammii.dev";

  const now = new Date();
  const todayStr = toDateString(now);
  const monday = getMondayOfWeek(now);

  // Build week array (Mon=0 through Sun=6)
  const weekDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekDates.push(toDateString(d));
  }

  // Default empty counts
  const counts: Record<string, { scheduled: number; review: number; published: number }> = {};
  for (const date of weekDates) {
    counts[date] = { scheduled: 0, review: 0, published: 0 };
  }

  if (apiKey) {
    const headers = { Authorization: `Bearer ${apiKey}` };

    try {
      const [scheduledRes, pendingRes, publishedRes] = await Promise.all([
        fetch(`${url}/api/posts?status=scheduled&limit=100`, {
          headers,
          signal: AbortSignal.timeout(6000),
          cache: "no-store",
        }).catch(() => null),
        fetch(`${url}/api/posts?status=pending_review&limit=100`, {
          headers,
          signal: AbortSignal.timeout(6000),
          cache: "no-store",
        }).catch(() => null),
        fetch(`${url}/api/posts?status=published&limit=50`, {
          headers,
          signal: AbortSignal.timeout(6000),
          cache: "no-store",
        }).catch(() => null),
      ]);

      // Parse responses
      async function parsePostsAsync(res: Response | null): Promise<Record<string, unknown>[]> {
        if (!res || !res.ok) return [];
        try {
          const data = await res.json();
          return Array.isArray(data) ? data : data.posts ?? data.data ?? [];
        } catch {
          return [];
        }
      }

      const [scheduledPosts, pendingPosts, publishedPosts] = await Promise.all([
        parsePostsAsync(scheduledRes),
        parsePostsAsync(pendingRes),
        parsePostsAsync(publishedRes),
      ]);

      // Tally each post into its day bucket
      function tallyPosts(
        posts: Record<string, unknown>[],
        field: "scheduled" | "review" | "published"
      ) {
        for (const post of posts) {
          const rawDate =
            String(post.scheduledFor ?? post.scheduledAt ?? post.scheduledDate ?? post.publishedAt ?? post.createdAt ?? "");
          const dateStr = rawDate.slice(0, 10);
          if (counts[dateStr]) {
            counts[dateStr][field]++;
          }
        }
      }

      tallyPosts(scheduledPosts, "scheduled");
      tallyPosts(pendingPosts, "review");
      tallyPosts(publishedPosts, "published");
    } catch {
      // Return zeroed counts if fetch fails
    }
  }

  let totalScheduled = 0;
  let totalReview = 0;
  let gaps = 0;

  const week: WeekDay[] = weekDates.map((date, i) => {
    const c = counts[date];
    const isToday = date === todayStr;
    const isPast = date < todayStr;
    const hasGap = c.scheduled === 0 && !isPast;

    totalScheduled += c.scheduled;
    totalReview += c.review;
    if (hasGap) gaps++;

    return {
      date,
      dayLabel: DAY_LABELS[i],
      isToday,
      scheduled: c.scheduled,
      review: c.review,
      published: c.published,
      hasGap,
    };
  });

  const response: WeekResponse = {
    week,
    totalScheduled,
    totalReview,
    gaps,
  };

  return NextResponse.json(response);
}
