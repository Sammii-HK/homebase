import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export interface LondonEvent {
  id: string;
  title: string;
  startAt: string;
  endAt?: string;
  url: string;
  venue?: string;
  source: "luma" | "eventbrite";
  tags: string[];
  description?: string;
}

const TECH_KEYWORDS = [
  "tech", "technology", "ai", "artificial intelligence", "machine learning", "ml",
  "startup", "founder", "developer", "engineering", "engineer", "product",
  "saas", "software", "hackathon", "vc", "venture", "investor", "investing",
  "coding", "code", "data", "blockchain", "web3", "devops", "cloud",
  "fintech", "deeptech", "entrepreneur", "pitch", "accelerator", "incubator",
  "open source", "api", "robotics", "biotech", "climate tech",
];

function isTechEvent(title: string, description?: string): boolean {
  const text = `${title} ${description ?? ""}`.toLowerCase();
  return TECH_KEYWORDS.some((kw) => text.includes(kw));
}

// ── In-memory cache (2h TTL) ─────────────────────────────────────────

interface Cache {
  events: LondonEvent[];
  ts: number;
}

const g = global as typeof globalThis & { _eventsCache?: Cache };
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;

function getCached(): LondonEvent[] | null {
  const c = g._eventsCache;
  if (c && Date.now() - c.ts < CACHE_TTL_MS) return c.events;
  return null;
}

function setCache(events: LondonEvent[]) {
  g._eventsCache = { events, ts: Date.now() };
}

// ── Luma discover ────────────────────────────────────────────────────

async function fetchLumaEvents(): Promise<LondonEvent[]> {
  const now = new Date().toISOString();
  const in3weeks = new Date(Date.now() + 21 * 86_400_000).toISOString();

  const approaches = [
    // Approach 1: Luma discover search with geo filter
    () => fetch("https://api.lu.ma/discover/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Origin": "https://lu.ma",
        "x-luma-web-url": "https://lu.ma/discover",
      },
      body: JSON.stringify({
        period: "future",
        pagination_limit: 30,
        geo_latitude: 51.5074,
        geo_longitude: -0.1278,
        geo_radius_km: 30,
        after: now,
        before: in3weeks,
      }),
      signal: AbortSignal.timeout(8000),
    }),
    // Approach 2: Luma paginated events with location query
    () => fetch("https://api.lu.ma/discover/get-paginated-events?" + new URLSearchParams({
      period: "future",
      pagination_limit: "30",
      location_query: "London, UK",
      after: now,
    }), {
      headers: { "Accept": "application/json", "Origin": "https://lu.ma" },
      signal: AbortSignal.timeout(8000),
    }),
  ];

  for (const attempt of approaches) {
    try {
      const res = await attempt();
      if (!res.ok) continue;
      const data = await res.json();

      // Normalise various response shapes Luma might return
      const rawEvents: Record<string, unknown>[] =
        data.events ?? data.entries ?? data.pagination_results ?? data.results ?? [];

      if (!Array.isArray(rawEvents) || rawEvents.length === 0) continue;

      const events: LondonEvent[] = [];
      for (const item of rawEvents) {
        const ev = (item.event ?? item) as Record<string, unknown>;
        const title = String(ev.name ?? ev.title ?? "");
        if (!title) continue;

        const startAt = String(ev.start_at ?? ev.starts_at ?? ev.startAt ?? ev.date ?? "");
        if (!startAt) continue;

        const url = String(ev.url ?? ev.event_url ?? `https://lu.ma/${ev.api_id ?? ev.id ?? ""}`);
        const venue = String(
          (ev.geo_address_info as Record<string, unknown>)?.address ??
          (ev.venue as Record<string, unknown>)?.name ??
          ""
        );
        const description = String(ev.description ?? ev.description_short ?? "").slice(0, 200);

        if (!isTechEvent(title, description)) continue;

        const cal = (item.calendar ?? {}) as Record<string, unknown>;
        const tags: string[] = [];
        if (cal.name) tags.push(String(cal.name));

        events.push({
          id: String(ev.api_id ?? ev.id ?? Math.random().toString(36).slice(2)),
          title,
          startAt,
          endAt: ev.end_at ? String(ev.end_at) : undefined,
          url,
          venue: venue || undefined,
          source: "luma",
          tags,
          description: description || undefined,
        });
      }

      if (events.length > 0) return events;
    } catch {
      // Try next approach
    }
  }

  return [];
}

// ── Eventbrite ───────────────────────────────────────────────────────

async function fetchEventbriteEvents(): Promise<LondonEvent[]> {
  const apiKey = process.env.EVENTBRITE_API_KEY;
  if (!apiKey) return [];

  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const in3weeks = new Date(Date.now() + 21 * 86_400_000).toISOString().replace(/\.\d+Z$/, "Z");

  try {
    const params = new URLSearchParams({
      "q": "tech startup",
      "location.address": "London, UK",
      "location.within": "25km",
      "categories": "102", // Science & Technology
      "start_date.range_start": now,
      "start_date.range_end": in3weeks,
      "sort_by": "date",
      "expand": "venue",
      "token": apiKey,
    });

    const res = await fetch(`https://www.eventbriteapi.com/v3/events/search/?${params}`, {
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return [];

    const data = await res.json();
    const rawEvents: Record<string, unknown>[] = data.events ?? [];

    return rawEvents
      .filter((ev) => {
        const title = String(ev.name && typeof ev.name === "object"
          ? (ev.name as Record<string, unknown>).text ?? ""
          : ev.name ?? "");
        const desc = String(ev.description && typeof ev.description === "object"
          ? (ev.description as Record<string, unknown>).text ?? ""
          : ev.description ?? "");
        return isTechEvent(title, desc);
      })
      .map((ev) => {
        const title = String(ev.name && typeof ev.name === "object"
          ? (ev.name as Record<string, unknown>).text ?? ""
          : ev.name ?? "");
        const startAt = String(
          (ev.start as Record<string, unknown>)?.utc ?? ev.start_date ?? ""
        );
        const venue = ev.venue as Record<string, unknown> | undefined;
        const venueStr = venue
          ? String(venue.name ?? (venue.address as Record<string, unknown>)?.localized_address_display ?? "")
          : undefined;

        return {
          id: String(ev.id ?? Math.random().toString(36).slice(2)),
          title,
          startAt,
          endAt: (ev.end as Record<string, unknown>)?.utc
            ? String((ev.end as Record<string, unknown>).utc)
            : undefined,
          url: String(ev.url ?? ""),
          venue: venueStr || undefined,
          source: "eventbrite" as const,
          tags: [],
        };
      });
  } catch {
    return [];
  }
}

// ── Route handler ────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  // Serve from cache if fresh
  const cached = getCached();
  if (cached) {
    return buildResponse(cached);
  }

  // Fetch both sources in parallel
  const [lumaEvents, ebEvents] = await Promise.all([
    fetchLumaEvents(),
    fetchEventbriteEvents(),
  ]);

  // Merge, deduplicate by title similarity, sort by date
  const all = [...lumaEvents, ...ebEvents];
  const seen = new Set<string>();
  const deduped = all.filter((ev) => {
    const key = ev.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Only keep future events
  const now = Date.now();
  const future = deduped
    .filter((ev) => ev.startAt && new Date(ev.startAt).getTime() > now)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 30);

  setCache(future);
  return buildResponse(future);
}

function buildResponse(events: LondonEvent[]) {
  const now = Date.now();
  const in48h = now + 48 * 3_600_000;
  const in7d = now + 7 * 86_400_000;

  return NextResponse.json({
    events,
    upcoming48h: events.filter((e) => new Date(e.startAt).getTime() <= in48h).length,
    thisWeek: events.filter((e) => new Date(e.startAt).getTime() <= in7d).length,
    sources: {
      luma: events.filter((e) => e.source === "luma").length,
      eventbrite: events.filter((e) => e.source === "eventbrite").length,
    },
    hasEventbriteKey: !!process.env.EVENTBRITE_API_KEY,
    updatedAt: new Date().toISOString(),
  });
}
