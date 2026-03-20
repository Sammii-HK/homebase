// DEPRECATED: Dashboard.tsx now handles all authenticated polling.
// This file is kept to avoid import errors from any remaining references.
// The Stats type has been superseded by DashboardStats in types/dashboard.ts.

export interface Stats {
  github: { repos: number; followers: number; commitsToday: number };
  lunary: { mau: number; mrr: number; activeToday: number };
  spellcast: { postsToday: number; scheduled: number; accounts: number };
  meta: { followers: number; reachThisWeek: number; postsThisWeek: number };
  updatedAt: string;
}

export interface LiveEvent {
  id: number;
  type: "new-user" | "new-sub" | "online" | "offline";
  ts: number;
  label?: string;
}
