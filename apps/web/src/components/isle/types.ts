// Isle canvas engine — shared types

export type Dir = "down" | "up" | "left" | "right";
export type Season = "spring" | "summer" | "autumn" | "winter";
export type TOD = "dawn" | "morning" | "afternoon" | "dusk" | "night";
export type Expression = "normal" | "happy" | "sleepy" | "focused";

export interface DeskZone {
  id: "lunary" | "spellcast" | "dev" | "meta";
  deskX: number;
  deskY: number;
  seatX: number;
  seatY: number;
  facing: Dir;
  monitorGlow: string;
  label: string;
  hitX: number;
  hitY: number;
  hitW: number;
  hitH: number;
}

export interface Pal {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  shoe: string;
  accent: string; // shirt detail / accessory colour
}

export interface FurniturePiece {
  id: string;
  type: string;
  tx: number;
  ty: number;
  tw?: number;
  th?: number;
  c1?: string;
  c2?: string;
  variant?: number;
}

export interface ClickTarget {
  type: "desk";
  roomKey: "lunary" | "spellcast" | "dev" | "meta";
}

export interface BadgeInfo {
  alert: boolean;
  count?: number;
}

export interface IsleStats {
  lunary: { mau: number; mrr: number; activeToday: number };
  spellcast: { postsToday: number; scheduled: number; accounts: number };
  infra: { systemsUp: number; totalSystems: number };
  meta: { followers: number; reachThisWeek: number };
  engagement: { unread: number; total: number };
  orbit: { online: boolean; runningAgents: number; errorAgents: number; pipelineRunning: boolean };
  content: { pendingReview: number; failedPosts: number; scheduledToday: number; scheduledTomorrow: number };
  seo: { clicks: number; impressions: number; ctr: number };
  github: { commitsToday: number };
  badges: Record<string, BadgeInfo>;
  hotRooms: string[];
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  opacity: number;
  phase: number;
  type: "firefly" | "leaf" | "blossom" | "snow" | "dust" | "sparkle" | "butterfly" | "dragonfly" | "bird";
  rotation: number;
}
