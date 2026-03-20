import type { DashboardStats } from "@/types/dashboard";

interface Props {
  stats: DashboardStats | null;
}

export default function ContentPipeline({ stats }: Props) {
  const c = stats?.content;
  const hasFailed = (c?.failedPosts ?? 0) > 0;

  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-lg p-3">
      <p className="text-[8px] uppercase tracking-wider text-white/40 mb-2">
        Content Pipeline
      </p>
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-[8px] text-white/60">Scheduled today</span>
          <span className="text-[9px] text-cyan-400">
            {c?.scheduledToday ?? "-"}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[8px] text-white/60">Scheduled tomorrow</span>
          <span className="text-[9px] text-white/70">
            {c?.scheduledTomorrow ?? "-"}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[8px] text-white/60">Failed posts</span>
          <span
            className={`text-[9px] ${hasFailed ? "text-red-400" : "text-green-400"}`}
          >
            {c?.failedPosts ?? "-"}
          </span>
        </div>
      </div>
    </div>
  );
}
