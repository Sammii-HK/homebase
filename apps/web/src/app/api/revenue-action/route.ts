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
  } catch {
    // best effort
  }
}

async function generateRecommendation(): Promise<RevenueActionCache | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const snapshot = readMetricsSnapshot();
  const mau = snapshot?.mau ?? 0;
  const dau = snapshot?.dau ?? 0;
  const mrr = snapshot?.mrr ?? 0;
  const signups7d = snapshot?.signups7d ?? 0;

  const lunaryUrl = process.env.LUNARY_URL ?? "https://lunary.app";
  const lunaryKey = process.env.LUNARY_ADMIN_API_KEY;

  // Fetch launch tracker state for context
  let launchContext = "";
  if (lunaryKey) {
    try {
      const res = await fetch(`${lunaryUrl}/api/internal/homebase-stats`, {
        headers: { Authorization: `Bearer ${lunaryKey}` },
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const d = await res.json();
        mau || d.mau;
      }
    } catch { /* silent */ }
  }

  const businessContext = `
You are the AI advisor for Sammii, an indie developer in London. Give ONE specific, actionable revenue recommendation.

Current state (today, ${new Date().toISOString().split("T")[0]}):
- MRR: £${mrr.toFixed(2)} (beta users have free coupons intentionally — first paid revenue not yet achieved)
- Monthly Active Users: ${mau}
- Daily Active Users: ${dau}
- New signups (7d): ${signups7d}

Revenue streams and status:
- Lunary astrology app: LIVE. 150 MAU. £0 MRR (beta). Stripe installed, paid tier exists, just no paying users yet.
- iOS Apps: 7 apps BUILT (Daily Tarot, Crystal of Day, Rune of Day, Aeris + 3 more). App Store assets done. NOT YET SUBMITTED.
- Notion Templates: tarot journal template BUILT. Gumroad listing NOT CREATED yet. ~30 mins of work.
- Dev Tools: Tailwind Colour Creator + Kern typography tool BUILT. No auth or Stripe yet.
- Framer Templates: NOT STARTED.
- Prism Component Library: pipeline running daily. No gallery site or npm package yet.
- Lunary API: endpoints exist with tiered pricing. No documentation or SEO yet.

SEO: 596,000 monthly impressions, 0.5% CTR, average position 11.6. Huge gap between impressions and clicks.

Income goal: first £1 of revenue as fast as possible, then scale.

Respond in this exact JSON format (no markdown):
{
  "recommendation": "One specific sentence: exactly what to do today",
  "rationale": "One sentence: why this over everything else",
  "estimatedImpact": "One phrase: e.g. '£20-50/mo within 2 weeks'"
}
`.trim();

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        messages: [{ role: "user", content: businessContext }],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return null;
    const data = await res.json() as { content?: { text?: string }[] };
    const text = data.content?.[0]?.text ?? "";

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as { recommendation?: string; rationale?: string; estimatedImpact?: string };

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

  // No ANTHROPIC_API_KEY — return null so UI can hide the widget
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }

  const result = await generateRecommendation();
  if (!result) {
    return NextResponse.json({ error: "Failed to generate recommendation" }, { status: 502 });
  }

  return NextResponse.json({ ...result, cached: false });
}
