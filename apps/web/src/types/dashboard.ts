export interface HealthStatus {
  status: "ok" | "degraded" | "down";
  latencyMs: number;
}

export interface Trend {
  delta: number;
  direction: "up" | "down" | "flat";
}

export interface SEOTrend {
  impressions: { delta: number; pct: number };
  clicks: { delta: number; pct: number };
}

export interface FailedPost {
  id: string;
  content: string;
  platform: string;
  error: string;
  scheduledFor: string;
}

export interface DashboardStats {
  github: { repos: number; followers: number; commitsToday: number };
  lunary: {
    mau: number;
    mrr: number;
    subscribers: number;
    activeToday: number;
  };
  spellcast: {
    postsToday: number;
    scheduled: number;
    accounts: number;
    igFollowers: number;
    reachThisWeek: number;
    postsThisWeek: number;
    queueDepth: number;
  };
  meta: { followers: number; reachThisWeek: number; postsThisWeek: number };
  health: {
    lunary: HealthStatus;
    spellcast: HealthStatus;
    contentCreator: HealthStatus;
  };
  content: {
    failedPosts: number;
    failedPostDetails: FailedPost[];
    scheduledToday: number;
    scheduledTomorrow: number;
    pendingReview: number;
  };
  engagement: { unread: number; total: number; byPlatform: Record<string, number> };
  orbit: { online: boolean; agentCount: number; runningAgents: number; errorAgents: number; pipelineRunning: boolean; authStatus: string | null };
  seo: {
    impressions: number;
    clicks: number;
    ctr: number;
    position: number;
    trend: SEOTrend | null;
  };
  opportunities: Opportunity[];
  trends: Record<string, Trend> | null;
  updatedAt: string;
}

// ── Deep room data types (lazy-loaded via /api/stats/[room]) ──

export interface SpellcastDeepData {
  failedPosts: FailedPost[];
  calendar: { date: string; count: number; status: "good" | "gap" | "overloaded" }[];
  velocity: { hour: string; count: number }[];
  queueByDay: { date: string; count: number }[];
  autopilot: { enabled: boolean; lastRun: string | null };
  engagement: { unread: number; total: number };
}

export interface LunaryDeepData {
  dauSeries: { date: string; value: number }[];
  mauSeries: { date: string; value: number }[];
  featureAdoption: { feature: string; users: number; pct: number }[];
  conversions: { step: string; count: number; pct: number }[];
  revenue: { plan: string; count: number; mrr: number }[];
  subscriptionLifecycle: { active: number; trial: number; cancelled: number; churnRate: number; avgDurationDays: number } | null;
  abTests: { testName: string; bestVariant: string; improvement: number; isSignificant: boolean; confidence: number }[];
  attribution: { source: string; count: number; pct: number }[];
  aiCosts: { totalGenerations: number; estimatedCost: number; costPerUser: number; revenueCostRatio: number } | null;
  activation: { trialSignups: number; trialConversionRate: number; paidUsers: number; avgDaysToTrial: number } | null;
}

export interface InfraDeepData {
  recentWorkflows: { id: string; name: string; status: string; startedAt: string; finishedAt: string | null }[];
  healthHistory: { ts: string; services: Record<string, "ok" | "down"> }[];
}

export interface OrbitDeepData {
  online: boolean;
  agents: { name: string; status: string; model: string; lastRun: string | null; detail: string | null; cost: number | null }[];
  approvedContent: { title: string; platform: string; score: number; persona: string }[];
  trendingTopics: { topic: string; heat: string; angle: string }[];
  scoutTargets: { platform: string; author: string; content: string; score: number; draftReply: string }[];
  kpis: Record<string, unknown> | null;
  activity: { timestamp: string; agent: string; action: string; detail: string }[];
  pipelineRunning: boolean;
}

export interface EngagementDeepData {
  items: {
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
  }[];
  stats: { total: number; unread: number; replied: number; byPlatform: Record<string, number> };
  discoveryItems: { id: string; platform: string; author: string; content: string; score: number; url: string }[];
  competitors: { id: string; name: string; platform: string; handle: string }[];
  abTests: { id: string; status: string; metric: string; originalContent: string; winnerMetrics: Record<string, unknown> | null; evaluatedAt: string | null }[];
}

export type RoomDeepData = SpellcastDeepData | LunaryDeepData | InfraDeepData | OrbitDeepData | EngagementDeepData;

// ── Launch Tracker types ──

export type LaunchStatus = "live" | "building" | "ready" | "not-started" | "paused";
export type LaunchCategory = "saas" | "marketplace" | "tool" | "package" | "temp";

export interface LaunchMilestone {
  label: string;
  done: boolean;
}

export interface LaunchProduct {
  id: string;
  name: string;
  category: LaunchCategory;
  color: string;
  url?: string;
  milestones: LaunchMilestone[];
  nextAction: string;
  status: LaunchStatus;
  keyMetric: { label: string; source: string };
  pricingNote: string;
  // enriched at runtime
  liveMetric?: string;
  healthy?: boolean;
}

export interface LaunchTrackerData {
  products: LaunchProduct[];
  summary: {
    byStatus: Record<LaunchStatus, number>;
    totalMRR: number;
    priorityAction: string;
    nextRevenue: string;
  };
  updatedAt: string;
}

export interface Opportunity {
  id: string;
  platform: string;
  authorHandle: string;
  content: string;
  relevanceScore: number;
  platformUrl: string;
}

export interface HeartbeatResponse {
  status: "online" | "offline" | "no-data";
  ageMinutes: number;
  heartbeat: {
    ts: string;
    services: Record<string, { status: string; [key: string]: unknown }>;
    docker?: string;
    launchAgents?: string;
  } | null;
}
