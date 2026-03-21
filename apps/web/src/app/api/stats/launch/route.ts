import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";
import { LAUNCH_PRODUCTS, getPriorityAction, getNextRevenue } from "@/lib/launch-config";
import type { LaunchProduct, LaunchStatus, LaunchTrackerData } from "@/types/dashboard";

export const dynamic = "force-dynamic";

async function enrichWithLunaryStats(): Promise<{ mrr: number; mau: number } | null> {
  const url = process.env.LUNARY_URL ?? "https://lunary.app";
  const key = process.env.LUNARY_ADMIN_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch(`${url}/api/internal/homebase-stats`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      mrr: data.mrr ?? 0,
      mau: data.mau ?? 0,
    };
  } catch {
    return null;
  }
}

async function checkHealth(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  // Start with config as base
  const products: LaunchProduct[] = LAUNCH_PRODUCTS.map((p) => ({ ...p }));

  // Enrich in parallel
  const [lunaryStats, lunaryHealthy] = await Promise.all([
    enrichWithLunaryStats(),
    checkHealth("https://lunary.app"),
  ]);

  // Enrich Lunary product
  const lunary = products.find((p) => p.id === "lunary");
  if (lunary) {
    if (lunaryStats) {
      lunary.liveMetric = `£${lunaryStats.mrr.toFixed(2)} MRR · MAU ${lunaryStats.mau}`;
    }
    lunary.healthy = lunaryHealthy;
  }

  // Enrich Lunary API (same health)
  const lunaryApi = products.find((p) => p.id === "lunary-api");
  if (lunaryApi) {
    lunaryApi.healthy = lunaryHealthy;
  }

  // iOS apps — count built milestones as metric
  const iosApps = products.find((p) => p.id === "ios-apps");
  if (iosApps) {
    const built = iosApps.milestones.filter((m) => m.done).length;
    const total = iosApps.milestones.length;
    iosApps.liveMetric = `${built}/${total} milestones`;
  }

  // Prism — milestone count
  const prism = products.find((p) => p.id === "prism-components");
  if (prism) {
    const done = prism.milestones.filter((m) => m.done).length;
    const total = prism.milestones.length;
    prism.liveMetric = `${done}/${total} milestones`;
  }

  // Compute summary
  const byStatus = products.reduce(
    (acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    },
    {} as Record<LaunchStatus, number>
  );

  const totalMRR = lunaryStats?.mrr ?? 0;

  const data: LaunchTrackerData = {
    products,
    summary: {
      byStatus,
      totalMRR,
      priorityAction: getPriorityAction(products),
      nextRevenue: getNextRevenue(products),
    },
    updatedAt: new Date().toISOString(),
  };

  return NextResponse.json(data);
}
