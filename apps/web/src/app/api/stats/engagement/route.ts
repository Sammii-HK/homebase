import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  const apiKey = process.env.SPELLCAST_API_KEY;
  const url = process.env.SPELLCAST_API_URL ?? "https://api.spellcast.sammii.dev";
  if (!apiKey) {
    return NextResponse.json({ error: "No API key" }, { status: 500 });
  }

  const headers = { Authorization: `Bearer ${apiKey}` };

  try {
    const [engRes, statsRes, discoveryRes, competitorRes, abRes] = await Promise.all([
      fetch(`${url}/api/engagement?status=unread&limit=15&grouped=true`, { headers, cache: "no-store" }),
      fetch(`${url}/api/engagement/stats`, { headers, cache: "no-store" }).catch(() => null),
      fetch(`${url}/api/discovery?status=new&limit=10`, { headers, cache: "no-store" }).catch(() => null),
      fetch(`${url}/api/competitors`, { headers, cache: "no-store" }).catch(() => null),
      fetch(`${url}/api/ab-test`, { headers, cache: "no-store" }).catch(() => null),
    ]);

    // Engagement items
    let items: {
      id: string;
      platform: string;
      type: string;
      authorName: string;
      authorHandle: string;
      content: string;
      postContent: string;
      platformUrl: string;
      status: string;
      publishedAt: string;
    }[] = [];
    if (engRes.ok) {
      const data = await engRes.json();
      const arr = Array.isArray(data) ? data : data.items ?? data.data ?? [];
      items = arr.slice(0, 15).map((e: Record<string, unknown>) => ({
        id: String(e.id ?? ""),
        platform: String(e.platform ?? ""),
        type: String(e.type ?? "comment"),
        authorName: String(e.authorName ?? ""),
        authorHandle: String(e.authorHandle ?? ""),
        content: String(e.content ?? "").slice(0, 200),
        postContent: String(e.postContent ?? "").slice(0, 100),
        platformUrl: String(e.platformUrl ?? "#"),
        status: String(e.status ?? "unread"),
        publishedAt: String(e.publishedAt ?? ""),
      }));
    }

    // Stats
    let stats = { total: 0, unread: 0, replied: 0, byPlatform: {} as Record<string, number> };
    if (statsRes?.ok) {
      const data = await statsRes.json();
      stats = {
        total: Number(data.total ?? 0),
        unread: Number(data.unread ?? 0),
        replied: Number(data.replied ?? 0),
        byPlatform: data.byPlatform ?? {},
      };
    }

    // Discovery
    let discoveryItems: { id: string; platform: string; author: string; content: string; score: number; url: string }[] = [];
    if (discoveryRes?.ok) {
      const data = await discoveryRes.json();
      const arr = Array.isArray(data) ? data : data.posts ?? data.data ?? [];
      discoveryItems = arr.slice(0, 10).map((p: Record<string, unknown>) => ({
        id: String(p.id ?? ""),
        platform: String(p.platform ?? ""),
        author: String(p.authorHandle ?? p.authorName ?? ""),
        content: String(p.content ?? "").slice(0, 150),
        score: Number(p.relevanceScore ?? 0),
        url: String(p.platformUrl ?? "#"),
      }));
    }

    // Competitors
    let competitors: { id: string; name: string; platform: string; handle: string }[] = [];
    if (competitorRes?.ok) {
      const data = await competitorRes.json();
      const arr = Array.isArray(data) ? data : data.competitors ?? data.data ?? [];
      competitors = arr.map((c: Record<string, unknown>) => ({
        id: String(c.id ?? ""),
        name: String(c.name ?? ""),
        platform: String(c.platform ?? ""),
        handle: String(c.handle ?? ""),
      }));
    }

    // A/B Tests
    let abTests: { id: string; status: string; metric: string; originalContent: string; winnerMetrics: Record<string, unknown> | null; evaluatedAt: string | null }[] = [];
    if (abRes?.ok) {
      const data = await abRes.json();
      const arr = Array.isArray(data) ? data : data.tests ?? data.data ?? [];
      abTests = arr.slice(0, 10).map((t: Record<string, unknown>) => ({
        id: String(t.id ?? ""),
        status: String(t.status ?? "pending"),
        metric: String(t.metricToOptimize ?? "engagement_rate"),
        originalContent: String(t.originalContent ?? "").slice(0, 100),
        winnerMetrics: (t.winnerMetrics as Record<string, unknown>) ?? null,
        evaluatedAt: t.evaluatedAt ? String(t.evaluatedAt) : null,
      }));
    }

    return NextResponse.json({
      items,
      stats,
      discoveryItems,
      competitors,
      abTests,
    });
  } catch (e) {
    console.error("[homebase] engagement deep fetch failed:", e);
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  }
}
