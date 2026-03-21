"use client";

import { useState, useEffect } from "react";

// ── Types ────────────────────────────────────────────────────────────

interface AccountRow {
  platform: string;
  handle: string;
  followerCount: number;
  postsThisWeek: number;
  postsThisMonth: number;
}

interface PersonaGroup {
  persona: string;
  accounts: AccountRow[];
}

interface EngagementSummary {
  unread: number;
  total: number;
  byAccount: Record<string, unknown>;
}

interface SocialStatsData {
  personas: PersonaGroup[];
  engagement: EngagementSummary;
  updatedAt: string;
}

interface Props {
  token: string;
}

// ── Platform config ──────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<string, { abbr: string; color: string; textColor: string }> = {
  Instagram:  { abbr: "IG", color: "#E1306C", textColor: "#fff" },
  Threads:    { abbr: "TH", color: "#1a1a1a", textColor: "#fff" },
  X:          { abbr: "X",  color: "#1a1a1a", textColor: "#fff" },
  TikTok:     { abbr: "TT", color: "#00f2ea", textColor: "#000" },
  YouTube:    { abbr: "YT", color: "#FF0000", textColor: "#fff" },
  LinkedIn:   { abbr: "LI", color: "#0A66C2", textColor: "#fff" },
  Bluesky:    { abbr: "BS", color: "#0085ff", textColor: "#fff" },
  Facebook:   { abbr: "FB", color: "#1877F2", textColor: "#fff" },
  Mastodon:   { abbr: "MA", color: "#6364FF", textColor: "#fff" },
};

function PlatformBadge({ platform }: { platform: string }) {
  const cfg = PLATFORM_CONFIG[platform] ?? { abbr: platform.slice(0, 2).toUpperCase(), color: "#555", textColor: "#fff" };
  return (
    <span
      className="inline-flex items-center justify-center w-7 h-7 rounded text-[9px] font-bold flex-shrink-0"
      style={{ backgroundColor: cfg.color, color: cfg.textColor, fontFamily: "system-ui, sans-serif" }}
    >
      {cfg.abbr}
    </span>
  );
}

function fmtFollowers(n: number): string {
  if (n === 0) return "--";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ── Sub-components ────────────────────────────────────────────────────

function AccountRowItem({ account }: { account: AccountRow }) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-white/5 transition-colors">
      <PlatformBadge platform={account.platform} />
      <span
        className="flex-1 text-[11px] text-white/60 truncate"
        style={{ fontFamily: "system-ui, sans-serif" }}
      >
        {account.handle}
      </span>
      <span
        className="text-[11px] text-white/40 w-10 text-right flex-shrink-0"
        style={{ fontFamily: "system-ui, sans-serif" }}
        title="Followers"
      >
        {fmtFollowers(account.followerCount)}
      </span>
      <span
        className={`text-[11px] w-8 text-right flex-shrink-0 ${
          account.postsThisWeek > 0 ? "text-cyan-400" : "text-white/20"
        }`}
        style={{ fontFamily: "system-ui, sans-serif" }}
        title="Posts this week"
      >
        {account.postsThisWeek > 0 ? `+${account.postsThisWeek}` : "--"}
      </span>
    </div>
  );
}

function PersonaSection({ group }: { group: PersonaGroup }) {
  const [expanded, setExpanded] = useState(true);

  const totalFollowers = group.accounts.reduce((s, a) => s + a.followerCount, 0);
  const weeklyPosts = group.accounts.reduce((s, a) => s + a.postsThisWeek, 0);

  return (
    <div className="mb-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 transition-colors text-left"
      >
        <span
          className="text-[9px] text-white/30 transition-transform"
          style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}
        >
          ▶
        </span>
        <span
          className="text-[10px] uppercase tracking-widest text-white/50 flex-1"
          style={{ fontFamily: "'Press Start 2P', monospace" }}
        >
          {group.persona}
        </span>
        <span
          className="text-[10px] text-white/30"
          style={{ fontFamily: "system-ui, sans-serif" }}
          title="Total followers"
        >
          {fmtFollowers(totalFollowers)}
        </span>
        {weeklyPosts > 0 && (
          <span
            className="text-[10px] text-cyan-400 ml-1"
            style={{ fontFamily: "system-ui, sans-serif" }}
            title="Posts this week"
          >
            +{weeklyPosts}w
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-0.5">
          {group.accounts.map((acc, i) => (
            <AccountRowItem key={`${acc.platform}-${acc.handle}-${i}`} account={acc} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────

export default function SocialStats({ token }: Props) {
  const [data, setData] = useState<SocialStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/stats/social", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json() as Promise<SocialStatsData>;
      })
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <h3
          className="text-[9px] uppercase tracking-widest text-white/50"
          style={{ fontFamily: "'Press Start 2P', monospace" }}
        >
          Social Accounts
        </h3>
        {data && (
          <span
            className="text-[9px] text-white/25"
            style={{ fontFamily: "system-ui, sans-serif" }}
            title={data.updatedAt}
          >
            {data.engagement.unread > 0 && (
              <span className="text-amber-400 mr-2">{data.engagement.unread} unread</span>
            )}
            updated {new Date(data.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-2 px-2 mb-1">
        <span className="w-7 flex-shrink-0" />
        <span
          className="flex-1 text-[9px] text-white/25 uppercase tracking-wider"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          Handle
        </span>
        <span
          className="text-[9px] text-white/25 uppercase tracking-wider w-10 text-right flex-shrink-0"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          Flw
        </span>
        <span
          className="text-[9px] text-white/25 uppercase tracking-wider w-8 text-right flex-shrink-0"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          7d
        </span>
      </div>

      {/* Content */}
      {loading && (
        <p
          className="text-[10px] text-white/30 text-center py-4"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          Loading...
        </p>
      )}

      {error && !loading && (
        <p
          className="text-[10px] text-red-400 text-center py-4"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          Failed to load: {error}
        </p>
      )}

      {data && !loading && data.personas.map((group) => (
        <PersonaSection key={group.persona} group={group} />
      ))}
    </div>
  );
}
