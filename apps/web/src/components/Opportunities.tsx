import type { DashboardStats } from "@/types/dashboard";

interface Props {
  stats: DashboardStats | null;
}

const PLATFORM_ICON: Record<string, string> = {
  threads: "TH",
  instagram: "IG",
  twitter: "X",
  x: "X",
  tiktok: "TT",
  linkedin: "LI",
  reddit: "RD",
  unknown: "??",
};

const PLATFORM_COLOR: Record<string, string> = {
  threads: "text-white",
  instagram: "text-pink-400",
  twitter: "text-blue-400",
  x: "text-blue-400",
  tiktok: "text-cyan-400",
  linkedin: "text-blue-300",
  reddit: "text-orange-400",
};

export default function Opportunities({ stats }: Props) {
  const opps = stats?.opportunities ?? [];
  if (opps.length === 0 && stats) {
    return (
      <div className="bg-white/[0.04] border border-white/10 rounded-lg p-3">
        <p className="text-[8px] md:text-xs uppercase tracking-wider text-white/40 mb-2">
          Engagement
        </p>
        <p className="text-[8px] md:text-xs text-white/30">No new opportunities</p>
      </div>
    );
  }
  if (!stats) return null;

  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-lg p-3">
      <p className="text-[8px] md:text-xs uppercase tracking-wider text-white/40 mb-2">
        Engagement ({opps.length})
      </p>
      <div className="space-y-2">
        {opps.map((opp) => (
          <a
            key={opp.id}
            href={opp.platformUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-white/[0.03] rounded p-2 active:bg-white/[0.08] transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-[7px] md:text-[11px] font-bold ${PLATFORM_COLOR[opp.platform] ?? "text-white/50"}`}
              >
                {PLATFORM_ICON[opp.platform] ?? opp.platform.slice(0, 2).toUpperCase()}
              </span>
              <span className="text-[8px] md:text-xs text-white/60 truncate">
                @{opp.authorHandle}
              </span>
              <span className="text-[7px] md:text-[11px] text-purple-400 ml-auto shrink-0">
                {(opp.relevanceScore * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-[7px] md:text-[11px] text-white/40 line-clamp-2 leading-relaxed">
              {opp.content}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}
