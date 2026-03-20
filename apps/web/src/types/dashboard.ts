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
  };
  meta: { followers: number; reachThisWeek: number; postsThisWeek: number };
  health: {
    lunary: HealthStatus;
    spellcast: HealthStatus;
    contentCreator: HealthStatus;
  };
  content: {
    failedPosts: number;
    scheduledToday: number;
    scheduledTomorrow: number;
  };
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
