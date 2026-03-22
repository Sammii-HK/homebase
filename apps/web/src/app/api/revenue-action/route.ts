import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";
import { readMetricsSnapshot } from "@/lib/metrics-snapshot";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const DATA_DIR = path.join(process.cwd(), "..", "..", "app", "data");
const CACHE_FILE = path.join(DATA_DIR, "revenue-action.json");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface RevenueActionCache {
  recommendation: string;
  rationale: string;
  estimatedImpact: string;
  generatedAt: string;
}

function readCache(): RevenueActionCache | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const raw = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8")) as RevenueActionCache;
    const age = Date.now() - new Date(raw.generatedAt).getTime();
    if (age > CACHE_TTL_MS) return null;
    return raw;
  } catch {
    return null;
  }
}

function writeCache(data: RevenueActionCache) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
  } catch { /* best effort */ }
}

/** Collect an AI SDK v1 data stream into a plain text string */
async function collectStream(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    // AI SDK data stream lines: `0:"chunk"` or `e:{...}` (finish) etc.
    for (const line of chunk.split("\n")) {
      if (line.startsWith('0:"') || line.startsWith("0:'")) {
        try {
          text += JSON.parse(line.slice(2));
        } catch { /* skip malformed */ }
      }
    }
  }

  return text.trim();
}

async function generateRecommendation(): Promise<RevenueActionCache | null> {
  const clawdUrl = process.env.CLAWD_CHAT_URL ?? "https://claw.sammii.dev/api/chat";
  const clawdToken = process.env.CLAWD_GATEWAY_TOKEN ?? "";

  const snapshot = readMetricsSnapshot();
  const mau = snapshot?.mau ?? 0;
  const dau = snapshot?.dau ?? 0;
  const mrr = snapshot?.mrr ?? 0;
  const signups7d = snapshot?.signups7d ?? 0;

  const prompt = `You are Sammii's business advisor. Based on the data below, return ONE specific action to take today to generate revenue. Reply ONLY with valid JSON, no markdown.

Today (${new Date().toISOString().split("T")[0]}):
- MRR: £${mrr.toFixed(2)} (beta — free coupons intentional, first paid revenue not yet achieved)
- MAU: ${mau} | DAU: ${dau} | New signups 7d: ${signups7d}
- SEO: ~26k impressions/day, 0.7% CTR, avg position 11.6 (rapid expansion phase)

Revenue streams:
- Lunary astrology app: LIVE, 150 MAU, Stripe installed, £0 MRR (beta coupons)
- iOS Apps: 7 apps built (Daily Tarot, Crystal of Day, Rune of Day, Aeris + 3 more). App Store assets done. NOT submitted yet.
- Notion Templates: tarot journal template built. Gumroad listing NOT created (~30 min of work).
- Dev Tools: Tailwind Colour Creator + Kern typography tool built. No auth or Stripe yet.
- Framer Templates: not started.
- Prism Components: pipeline running daily. No gallery or npm package yet.
- Lunary API: endpoints + tiered pricing exist. No docs or SEO yet.

Goal: first £1 as fast as possible, then scale.

Respond with this exact JSON:
{"recommendation":"one specific sentence — exactly what to do today","rationale":"one sentence why this over everything else","estimatedImpact":"e.g. first sales within 48h"}`;

  try {
    const res = await fetch(clawdUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(clawdToken ? { Authorization: `Bearer ${clawdToken}` } : {}),
      },
      body: JSON.stringify({ message: prompt, history: [] }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok || !res.body) return null;

    const raw = await collectStream(res.body);

    // Extract JSON from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as {
      recommendation?: string;
      rationale?: string;
      estimatedImpact?: string;
    };
    if (!parsed.recommendation) return null;

    const result: RevenueActionCache = {
      recommendation: parsed.recommendation,
      rationale: parsed.rationale ?? "",
      estimatedImpact: parsed.estimatedImpact ?? "",
      generatedAt: new Date().toISOString(),
    };

    writeCache(result);
    return result;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const forceRefresh = searchParams.get("refresh") === "1";

  if (!forceRefresh) {
    const cached = readCache();
    if (cached) return NextResponse.json({ ...cached, cached: true });
  }

  const result = await generateRecommendation();
  if (!result) {
    return NextResponse.json({ error: "Failed to generate recommendation" }, { status: 502 });
  }

  return NextResponse.json({ ...result, cached: false });
}
