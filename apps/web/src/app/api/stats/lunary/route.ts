import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = checkAuth(req);
  if (denied) return denied;

  const key = process.env.LUNARY_ADMIN_API_KEY;
  const url = process.env.LUNARY_URL ?? "https://lunary.app";
  if (!key) {
    return NextResponse.json({ error: "No API key" }, { status: 500 });
  }

  const headers = { Authorization: `Bearer ${key}` };

  try {
    const [dauRes, featureRes, conversionRes, revenueRes, lifecycleRes, abRes, attributionRes, costRes, activationRes] = await Promise.all([
      fetch(`${url}/api/admin/analytics/dau-wau-mau`, { headers, cache: "no-store" }),
      fetch(`${url}/api/admin/analytics/feature-adoption`, { headers, cache: "no-store" }).catch(() => null),
      fetch(`${url}/api/admin/analytics/conversions`, { headers, cache: "no-store" }).catch(() => null),
      fetch(`${url}/api/admin/analytics/revenue`, { headers, cache: "no-store" }).catch(() => null),
      fetch(`${url}/api/admin/analytics/subscription-lifecycle`, { headers, cache: "no-store" }).catch(() => null),
      fetch(`${url}/api/admin/ab-testing`, { headers, cache: "no-store" }).catch(() => null),
      fetch(`${url}/api/admin/analytics/attribution`, { headers, cache: "no-store" }).catch(() => null),
      fetch(`${url}/api/admin/analytics/api-costs`, { headers, cache: "no-store" }).catch(() => null),
      fetch(`${url}/api/admin/activation/metrics`, { headers, cache: "no-store" }).catch(() => null),
    ]);

    // DAU/MAU series
    let dauSeries: { date: string; value: number }[] = [];
    let mauSeries: { date: string; value: number }[] = [];
    if (dauRes.ok) {
      const data = await dauRes.json();
      dauSeries = (data.dau ?? data.dauSeries ?? []).map((d: Record<string, unknown>) => ({
        date: String(d.date ?? d.day ?? ""),
        value: Number(d.value ?? d.count ?? d.users ?? 0),
      }));
      mauSeries = (data.mau ?? data.mauSeries ?? []).map((d: Record<string, unknown>) => ({
        date: String(d.date ?? d.day ?? ""),
        value: Number(d.value ?? d.count ?? d.users ?? 0),
      }));
    }

    // Feature adoption
    let featureAdoption: { feature: string; users: number; pct: number }[] = [];
    if (featureRes?.ok) {
      const data = await featureRes.json();
      const features = Array.isArray(data) ? data : data.features ?? data.data ?? [];
      featureAdoption = features.map((f: Record<string, unknown>) => ({
        feature: String(f.feature ?? f.name ?? ""),
        users: Number(f.users ?? f.count ?? 0),
        pct: Number(f.pct ?? f.percentage ?? 0),
      }));
    }

    // Conversions
    let conversions: { step: string; count: number; pct: number }[] = [];
    if (conversionRes?.ok) {
      const data = await conversionRes.json();
      const steps = Array.isArray(data) ? data : data.steps ?? data.funnel ?? data.data ?? [];
      conversions = steps.map((s: Record<string, unknown>) => ({
        step: String(s.step ?? s.name ?? ""),
        count: Number(s.count ?? s.users ?? 0),
        pct: Number(s.pct ?? s.percentage ?? s.rate ?? 0),
      }));
    }

    // Revenue
    let revenue: { plan: string; count: number; mrr: number }[] = [];
    if (revenueRes?.ok) {
      const data = await revenueRes.json();
      const plans = Array.isArray(data) ? data : data.plans ?? data.breakdown ?? data.data ?? [];
      revenue = plans.map((p: Record<string, unknown>) => ({
        plan: String(p.plan ?? p.name ?? ""),
        count: Number(p.count ?? p.subscribers ?? 0),
        mrr: Number(p.mrr ?? p.revenue ?? 0),
      }));
    }

    // Subscription lifecycle
    let subscriptionLifecycle: { active: number; trial: number; cancelled: number; churnRate: number; avgDurationDays: number } | null = null;
    if (lifecycleRes?.ok) {
      const data = await lifecycleRes.json();
      const states = data.states ?? {};
      subscriptionLifecycle = {
        active: Number(states.active ?? 0),
        trial: Number(states.trial ?? 0),
        cancelled: Number(states.canceled ?? states.cancelled ?? 0),
        churnRate: Number(data.churnRate ?? 0),
        avgDurationDays: Number(data.avgDurationDays ?? 0),
      };
    }

    // A/B tests
    let abTests: { testName: string; bestVariant: string; improvement: number; isSignificant: boolean; confidence: number }[] = [];
    if (abRes?.ok) {
      const data = await abRes.json();
      const tests = Array.isArray(data) ? data : data.tests ?? [];
      abTests = tests.map((t: Record<string, unknown>) => ({
        testName: String(t.testName ?? t.name ?? ""),
        bestVariant: String(t.bestVariant ?? ""),
        improvement: Number(t.improvement ?? 0),
        isSignificant: Boolean(t.isSignificant),
        confidence: Number(t.confidence ?? 0),
      }));
    }

    // Attribution
    let attribution: { source: string; count: number; pct: number }[] = [];
    if (attributionRes?.ok) {
      const data = await attributionRes.json();
      const sources = data.sourceBreakdown ?? [];
      attribution = sources.slice(0, 8).map((s: Record<string, unknown>) => ({
        source: String(s.source ?? "unknown"),
        count: Number(s.user_count ?? s.count ?? 0),
        pct: Number(s.percentage ?? 0),
      }));
    }

    // AI costs
    let aiCosts: { totalGenerations: number; estimatedCost: number; costPerUser: number; revenueCostRatio: number } | null = null;
    if (costRes?.ok) {
      const data = await costRes.json();
      aiCosts = {
        totalGenerations: Number(data.totalGenerations ?? 0),
        estimatedCost: Number(data.estimatedCost ?? 0),
        costPerUser: Number(data.costPerUser ?? 0),
        revenueCostRatio: Number(data.revenueCostRatio ?? 0),
      };
    }

    // Activation
    let activation: { trialSignups: number; trialConversionRate: number; paidUsers: number; avgDaysToTrial: number } | null = null;
    if (activationRes?.ok) {
      const data = await activationRes.json();
      activation = {
        trialSignups: Number(data.trialSignups ?? 0),
        trialConversionRate: Number(data.trialConversionRate ?? 0),
        paidUsers: Number(data.paidUsers ?? 0),
        avgDaysToTrial: Number(data.avgDaysToTrial ?? 0),
      };
    }

    return NextResponse.json({
      dauSeries,
      mauSeries,
      featureAdoption,
      conversions,
      revenue,
      subscriptionLifecycle,
      abTests,
      attribution,
      aiCosts,
      activation,
    });
  } catch (e) {
    console.error("[homebase] lunary deep fetch failed:", e);
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  }
}
