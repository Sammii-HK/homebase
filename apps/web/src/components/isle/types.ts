// Isle canvas engine — shared types

export type Dir = "down" | "up" | "left" | "right";
export type Season = "spring" | "summer" | "autumn" | "winter";
export type TOD = "dawn" | "morning" | "afternoon" | "dusk" | "night";

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

export interface IsleStats {
  lunary: { mau: number; mrr: number; activeToday: number };
  spellcast: { postsToday: number; scheduled: number; accounts: number };
  infra: { systemsUp: number; totalSystems: number };
  meta: { followers: number; reachThisWeek: number };
  badges: Record<string, boolean>;
  hotRooms: string[];
}
