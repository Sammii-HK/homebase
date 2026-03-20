import type { DashboardStats, Trend } from "@/types/dashboard";

interface Props {
  stats: DashboardStats | null;
}

function fmt(n: number | undefined): string {
  if (n == null) return "-";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function TrendArrow({ trend }: { trend?: Trend }) {
  if (!trend || trend.direction === "flat") return null;
  const isUp = trend.direction === "up";
  return (
    <span className={`text-[7px] ml-1 ${isUp ? "text-green-400" : "text-red-400"}`}>
      {isUp ? "\u25b2" : "\u25bc"}
      {Math.abs(trend.delta)}
    </span>
  );
}

export default function KeyNumbers({ stats }: Props) {
  const trends = stats?.trends;

  const items = [
    {
      label: "DAU (yesterday)",
      value: fmt(stats?.lunary.activeToday),
      color: "text-purple-400",
      trend: trends?.dau,
    },
    {
      label: "MAU",
      value: fmt(stats?.lunary.mau),
      color: "text-purple-400",
      trend: trends?.mau,
    },
    {
      label: "MRR",
      value: stats?.lunary.mrr != null ? `\u00a3${stats.lunary.mrr.toFixed(2)}` : "-",
      color: "text-green-400",
      trend: trends?.mrr,
    },
    {
      label: "Posts today",
      value: fmt(stats?.spellcast.postsToday),
      color: "text-cyan-400",
      trend: trends?.postsToday,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-white/[0.04] border border-white/10 rounded-lg p-3"
        >
          <p className="text-[7px] uppercase tracking-wider text-white/40 mb-1">
            {item.label}
          </p>
          <div className="flex items-baseline">
            <p className={`text-base ${item.color}`}>{item.value}</p>
            <TrendArrow trend={item.trend} />
          </div>
        </div>
      ))}
    </div>
  );
}
