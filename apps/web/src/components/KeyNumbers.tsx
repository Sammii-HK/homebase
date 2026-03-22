import type { DashboardStats, Trend } from "@/types/dashboard";

interface Props {
  stats: DashboardStats | null;
}

function fmt(n: number | undefined | null): string {
  if (n == null) return "-";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function TrendArrow({ trend }: { trend?: Trend }) {
  if (!trend || trend.direction === "flat") return null;
  const isUp = trend.direction === "up";
  return (
    <span className={`text-[7px] md:text-[11px] ml-1 ${isUp ? "text-green-400" : "text-red-400"}`}>
      {isUp ? "\u25b2" : "\u25bc"}
      {Math.abs(trend.delta)}
    </span>
  );
}

interface MetricItem {
  label: string;
  value: string;
  color: string;
  sub?: string;
  trend?: Trend;
}

export default function KeyNumbers({ stats }: Props) {
  const trends = stats?.trends;
  type LunaryExtended = DashboardStats["lunary"] & { wau?: number; signups7d?: number };
  const lunary = stats?.lunary as LunaryExtended | undefined;

  const items: MetricItem[] = [
    {
      label: "DAU",
      value: fmt(lunary?.activeToday),
      color: "text-purple-400",
      sub: lunary?.wau ? `${fmt(lunary.wau)} WAU` : undefined,
      trend: trends?.dau,
    },
    {
      label: "MAU",
      value: fmt(lunary?.mau),
      color: "text-purple-400",
      sub: lunary?.signups7d ? `+${lunary.signups7d} signups 7d` : undefined,
      trend: trends?.mau,
    },
    {
      label: "MRR",
      value: stats?.lunary.mrr != null ? `\u00a3${stats.lunary.mrr.toFixed(0)}` : "-",
      color: stats?.lunary.mrr ? "text-green-400" : "text-white/30",
      trend: trends?.mrr,
    },
    {
      label: "SEO",
      value: stats?.seo.clicks != null ? fmt(stats.seo.clicks) : "-",
      color: "text-amber-400",
      sub: stats?.seo.impressions ? `${fmt(stats.seo.impressions)} impr` : undefined,
    },
    {
      label: "Posts today",
      value: fmt(stats?.spellcast.postsToday),
      color: "text-cyan-400",
      sub: stats?.spellcast.queueDepth ? `${stats.spellcast.queueDepth} queued 48h` : undefined,
      trend: trends?.postsToday,
    },
    {
      label: "Commits",
      value: fmt(stats?.github.commitsToday),
      color: stats?.github.commitsToday ? "text-green-400" : "text-white/20",
      sub: stats?.github.repos ? `${stats.github.repos} repos` : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-white/[0.04] border border-white/10 rounded-lg p-3"
        >
          <p className="text-[6px] md:text-[10px] uppercase tracking-wider text-white/35 mb-1">
            {item.label}
          </p>
          <div className="flex items-baseline gap-1">
            <p className={`text-base md:text-xl font-bold ${item.color}`}>{item.value}</p>
            <TrendArrow trend={item.trend} />
          </div>
          {item.sub && (
            <p className="text-[8px] text-white/25 mt-0.5 truncate">{item.sub}</p>
          )}
        </div>
      ))}
    </div>
  );
}
