import type { DashboardStats } from "@/types/dashboard";

interface Props {
  stats: DashboardStats | null;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

function fmtCtr(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

interface DeltaChipProps {
  delta: number;
  pct: number;
  /** true = lower value is better (position rank) */
  invertGood?: boolean;
  formatAbs?: (n: number) => string;
}

function DeltaChip({ delta, pct, invertGood = false, formatAbs }: DeltaChipProps) {
  if (Math.abs(pct) < 0.5) {
    return <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "inherit" }}>—</span>;
  }
  const isPositive = delta > 0;
  const isGood = invertGood ? !isPositive : isPositive;
  const color = isGood ? "#34d399" : "#f87171";
  const arrow = isPositive ? "▲" : "▼";
  const absStr = formatAbs ? formatAbs(Math.abs(delta)) : fmt(Math.abs(delta));

  return (
    <span style={{ color, display: "inline-flex", alignItems: "center", gap: 2 }}>
      <span>{arrow}{absStr}</span>
      <span style={{ opacity: 0.55 }}>({Math.abs(pct).toFixed(0)}%)</span>
    </span>
  );
}

export default function SEOSnapshot({ stats }: Props) {
  const seo = stats?.seo;

  if (!stats) return null;

  if (!seo || seo.impressions === 0) {
    return (
      <div className="bg-white/[0.04] border border-white/10 rounded-lg p-3">
        <p className="text-[8px] md:text-xs uppercase tracking-wider text-white/40 mb-1">SEO — 7 days</p>
        <p className="text-[7px] md:text-[11px] text-white/25">Waiting for daily data...</p>
      </div>
    );
  }

  const t = seo.trend;
  const prev = seo.prev;

  const rows: {
    label: string;
    value: string;
    sub?: string;
    prev?: string;
    delta?: number;
    pct?: number;
    invertGood?: boolean;
    formatAbs?: (n: number) => string;
  }[] = [
    {
      label: "Impressions",
      value: fmt(seo.impressions),
      sub: seo.dailyAvg > 0 ? `~${fmt(seo.dailyAvg)}/day` : undefined,
      prev: prev ? fmt(prev.impressions) : undefined,
      delta: t?.impressions.delta,
      pct: t?.impressions.pct,
    },
    {
      label: "Clicks",
      value: fmt(seo.clicks),
      prev: prev ? fmt(prev.clicks) : undefined,
      delta: t?.clicks.delta,
      pct: t?.clicks.pct,
    },
    {
      label: "CTR",
      value: fmtCtr(seo.ctr),
      prev: prev ? fmtCtr(prev.ctr) : undefined,
      delta: t?.ctr.delta,
      pct: t?.ctr.pct,
      formatAbs: (n) => fmtCtr(n),
    },
    {
      label: "Avg position",
      value: seo.position.toFixed(1),
      prev: prev ? prev.position.toFixed(1) : undefined,
      delta: t?.position?.delta,
      pct: t?.position?.pct,
      invertGood: true,
      formatAbs: (n) => n.toFixed(1),
    },
  ];

  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-lg p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[8px] md:text-xs uppercase tracking-wider text-white/40">SEO</p>
        <span
          className="text-[5px] md:text-[9px] px-1.5 py-0.5 rounded"
          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }}
        >
          7d vs prev 7d
        </span>
      </div>

      {/* Rows */}
      <div>
        {rows.map((row, i) => (
          <div
            key={row.label}
            className="flex items-center py-1.5"
            style={{ borderBottom: i < rows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
          >
            {/* Label */}
            <span
              className="text-[7px] md:text-[11px] shrink-0"
              style={{ color: "rgba(255,255,255,0.35)", width: 72 }}
            >
              {row.label}
            </span>

            {/* Value + sub */}
            <div className="flex items-baseline gap-1.5 min-w-0 flex-1">
              <span className="text-[10px] md:text-sm font-bold" style={{ color: "var(--hb-90)" }}>
                {row.value}
              </span>
              {row.sub && (
                <span className="text-[5px] md:text-[9px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                  {row.sub}
                </span>
              )}
              {row.prev && (
                <span className="text-[5px] md:text-[9px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                  vs {row.prev}
                </span>
              )}
            </div>

            {/* Delta */}
            <div className="shrink-0 text-[6px] md:text-[10px]">
              {row.delta != null && row.pct != null ? (
                <DeltaChip
                  delta={row.delta}
                  pct={row.pct}
                  invertGood={row.invertGood}
                  formatAbs={row.formatAbs}
                />
              ) : (
                <span style={{ color: "rgba(255,255,255,0.15)" }}>—</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
