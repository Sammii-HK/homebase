// Shared auto-approve logic — used by both the manual API route and the cron route

// US-optimised posting slots (UTC hours)
export const SLOT_HOURS_UTC = [14, 16, 17, 21, 22, 25]; // 25 = 01:00 next day

export async function getScheduledKeys(apiKey: string, spellcastUrl: string): Promise<Set<string>> {
  try {
    const res = await fetch(`${spellcastUrl}/api/posts?status=scheduled&limit=200`, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return new Set();
    const data = await res.json();
    const posts = Array.isArray(data) ? data : data.posts ?? data.data ?? [];
    const keys = new Set<string>();
    for (const p of posts) {
      const t = p.scheduledFor ?? p.scheduledAt ?? p.scheduledDate ?? "";
      if (t) keys.add(t.slice(0, 13));
    }
    return keys;
  } catch {
    return new Set();
  }
}

export function pickNextSlot(scheduledKeys: Set<string>): string {
  const now = new Date();
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    for (const hourUtc of SLOT_HOURS_UTC) {
      const actualHour = hourUtc % 24;
      const actualDayOffset = dayOffset + Math.floor(hourUtc / 24);
      const candidate = new Date(now);
      candidate.setUTCDate(candidate.getUTCDate() + actualDayOffset);
      candidate.setUTCHours(actualHour, 0, 0, 0);
      if (candidate.getTime() < now.getTime() + 15 * 60_000) continue;
      const key = candidate.toISOString().slice(0, 13);
      if (!scheduledKeys.has(key)) {
        scheduledKeys.add(key);
        return candidate.toISOString();
      }
    }
  }
  return new Date(now.getTime() + 24 * 60 * 60_000).toISOString();
}

export async function runAutoApprove(
  threshold: number,
  apiKey: string,
  spellcastUrl: string
): Promise<{ approved: number; errors: string[]; platforms: string[] }> {
  // Fetch all pending review posts
  let posts: { id?: string; _id?: string; score?: number; socialAccount?: { platform?: string } }[] = [];
  try {
    const res = await fetch(`${spellcastUrl}/api/posts?status=pending_review`, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      posts = Array.isArray(data) ? data : data.posts ?? data.data ?? [];
    }
  } catch (e) {
    console.error("[homebase] auto-approve list fetch failed:", e);
    throw new Error("Failed to fetch pending posts");
  }

  const scheduledKeys = await getScheduledKeys(apiKey, spellcastUrl);

  let approved = 0;
  const errors: string[] = [];
  const platforms = new Set<string>();

  for (const p of posts) {
    const postId = String(p.id ?? p._id ?? "");
    if (!postId) continue;

    let score = typeof p.score === "number" ? p.score : undefined;

    if (score === undefined) {
      try {
        const fullRes = await fetch(`${spellcastUrl}/api/posts/${postId}`, {
          headers: { "x-api-key": apiKey },
          signal: AbortSignal.timeout(4000),
          cache: "no-store",
        });
        if (fullRes.ok) {
          const full = await fullRes.json();
          if (typeof full.score === "number") score = full.score;
        }
      } catch {
        // Skip scoring if fetch fails
      }
    }

    if (typeof score !== "number" || score < threshold) continue;

    const scheduledDate = pickNextSlot(scheduledKeys);
    const platform = String(p.socialAccount?.platform ?? "unknown");

    try {
      const res = await fetch(`${spellcastUrl}/api/posts/${postId}/schedule`, {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ date: scheduledDate }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        approved++;
        platforms.add(platform);
      } else {
        errors.push(postId);
      }
    } catch {
      errors.push(postId);
    }
  }

  return { approved, errors, platforms: [...platforms] };
}
