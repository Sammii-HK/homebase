import type { DashboardStats } from "@/types/dashboard";

interface Props {
  stats: DashboardStats | null;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function TrendBadge({ pct }: { pct: number }) {
  if (Math.abs(pct) < 0.5) return null;
  const isUp = pct > 0;
  return (
    <span className={`text-[6px] ${isUp ? "text-green-400" : "text-red-400"}`}>
      {isUp ? "\u25b2" : "\u25bc"}{Math.abs(pct).toFixed(0)}%
    </span>
  );
}

export default function SEOSnapshot({ stats }: Props) {
  const seo = stats?.seo;
  if (!stats) return null;
  if (!seo) {
    return (
      <div className="bg-white/[0.04] border border-white/10 rounded-lg p-3">
        <p className="text-[8px] uppercase tracking-wider text-white/40 mb-2">SEO</p>
        <p className="text-[8px] text-white/30">No data</p>
      </div>
    );
  }

  const trend = seo.trend;

  const items = [
    {
      label: "Impressions",
      value: fmtNum(seo.impressions),
      trendPct: trend?.impressions.pct,
    },
    {
      label: "Clicks",
      value: fmtNum(seo.clicks),
      trendPct: trend?.clicks.pct,
    },
    { label: "CTR", value: `${(seo.ctr * 100).toFixed(1)}%` },
    { label: "Avg pos", value: seo.position.toFixed(1) },
  ];

  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-lg p-3">
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-[8px] uppercase tracking-wider text-white/40">SEO</p>
        {trend && (
          <p className="text-[6px] text-white/25">7d vs prev 7d</p>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {items.map((item) => (
          <div key={item.label} className="text-center">
            <p className="text-[9px] text-white/80">{item.value}</p>
            <p className="text-[6px] text-white/30 mt-0.5">{item.label}</p>
            {item.trendPct != null && <TrendBadge pct={item.trendPct} />}
          </div>
        ))}
      </div>
    </div>
  );
}
