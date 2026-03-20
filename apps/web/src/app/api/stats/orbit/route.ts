import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ORBIT_URL = process.env.ORBIT_URL ?? "http://localhost:3001";

export async function GET(req: NextRequest) {
  const denied = checkAuth(req);
  if (denied) return denied;

  try {
    const stateRes = await fetch(`${ORBIT_URL}/api/state`, {
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });

    if (!stateRes.ok) {
      return NextResponse.json({
        online: false,
        agents: [],
        approvedContent: [],
        trendingTopics: [],
        scoutTargets: [],
        kpis: null,
        activity: [],
        pipelineRunning: false,
      });
    }

    const state = await stateRes.json();

    // Parse agents
    const agentsRaw = state.agents ?? {};
    const agents = Object.values(agentsRaw).map((a: Record<string, unknown>) => ({
      name: String(a.name ?? ""),
      status: String(a.status ?? "idle"),
      model: String(a.model ?? ""),
      lastRun: a.lastRun ? String(a.lastRun) : null,
      detail: a.detail ? String(a.detail) : null,
      cost: a.cost ? Number(a.cost) : null,
    }));

    const pipelineRunning = agents.some((a) => a.status === "running");

    // Parse queue files from state
    const queue = state.queue ?? {};

    // Approved content
    let approvedContent: { title: string; platform: string; score: number; persona: string }[] = [];
    const approvedRaw = queue["approved-content"]?.content ?? queue["approved-content.json"]?.content;
    if (approvedRaw) {
      const items = Array.isArray(approvedRaw) ? approvedRaw : approvedRaw.approved ?? approvedRaw.posts ?? [];
      approvedContent = items.slice(0, 10).map((p: Record<string, unknown>) => ({
        title: String(p.title ?? p.hook ?? p.content ?? "").slice(0, 80),
        platform: String(p.platform ?? p.platforms?.[0] ?? ""),
        score: Number(p.score ?? p.quality_score ?? p.editor_score ?? 0),
        persona: String(p.persona ?? p.pillar ?? p.account ?? ""),
      }));
    }

    // Trending topics
    let trendingTopics: { topic: string; heat: string; angle: string }[] = [];
    const trendingRaw = queue["trending-topics"]?.content ?? queue["trending-topics.json"]?.content;
    if (trendingRaw) {
      const topics = Array.isArray(trendingRaw) ? trendingRaw : trendingRaw.topics ?? trendingRaw.trends ?? [];
      trendingTopics = topics.slice(0, 8).map((t: Record<string, unknown>) => ({
        topic: String(t.topic ?? t.name ?? t.keyword ?? ""),
        heat: String(t.heat ?? t.temperature ?? t.relevance ?? "warm"),
        angle: String(t.angle ?? t.hook ?? t.suggested_angle ?? ""),
      }));
    }

    // Scout targets
    let scoutTargets: { platform: string; author: string; content: string; score: number; draftReply: string }[] = [];
    const scoutRaw = queue["scout-report"]?.content ?? queue["scout-report.json"]?.content;
    if (scoutRaw) {
      const targets = Array.isArray(scoutRaw) ? scoutRaw : scoutRaw.opportunities ?? scoutRaw.targets ?? [];
      scoutTargets = targets.slice(0, 8).map((t: Record<string, unknown>) => ({
        platform: String(t.platform ?? ""),
        author: String(t.author ?? t.authorHandle ?? t.handle ?? ""),
        content: String(t.content ?? t.text ?? "").slice(0, 120),
        score: Number(t.score ?? t.relevanceScore ?? t.quality_score ?? 0),
        draftReply: String(t.draftReply ?? t.reply ?? t.suggested_reply ?? ""),
      }));
    }

    // KPIs
    const kpis = state.kpis ?? null;

    // Activity (last 20)
    const activityRaw = state.activity ?? [];
    const activity = activityRaw.slice(0, 20).map((a: Record<string, unknown>) => ({
      timestamp: String(a.timestamp ?? a.ts ?? ""),
      agent: String(a.agent ?? ""),
      action: String(a.action ?? ""),
      detail: String(a.detail ?? "").slice(0, 100),
    }));

    return NextResponse.json({
      online: true,
      agents,
      approvedContent,
      trendingTopics,
      scoutTargets,
      kpis,
      activity,
      pipelineRunning,
    });
  } catch {
    return NextResponse.json({
      online: false,
      agents: [],
      approvedContent: [],
      trendingTopics: [],
      scoutTargets: [],
      kpis: null,
      activity: [],
      pipelineRunning: false,
    });
  }
}
