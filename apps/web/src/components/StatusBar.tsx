import type { DashboardStats, HeartbeatResponse } from "@/types/dashboard";

interface Props {
  stats: DashboardStats | null;
  heartbeat: HeartbeatResponse | null;
  onOpenApprovalQueue?: () => void;
  onOpenEngagementQueue?: () => void;
}

function getInsights(stats: DashboardStats): string[] {
  const insights: string[] = [];

  if (stats.content.failedPosts > 0) {
    insights.push(`${stats.content.failedPosts} post${stats.content.failedPosts !== 1 ? "s" : ""} failed`);
  }

  if (stats.engagement?.unread > 0) {
    insights.push(`${stats.engagement.unread} unread comment${stats.engagement.unread !== 1 ? "s" : ""}`);
  }

  if (stats.content.scheduledTomorrow === 0) {
    insights.push("No posts scheduled tomorrow");
  }

  const dauTrend = stats.trends?.dau;
  if (dauTrend && dauTrend.direction === "down" && dauTrend.delta < -3) {
    insights.push(`DAU down ${Math.abs(dauTrend.delta).toFixed(0)}`);
  }

  if (stats.opportunities.length > 0) {
    insights.push(`${stats.opportunities.length} opportunit${stats.opportunities.length !== 1 ? "ies" : "y"}`);
  }

  if (stats.orbit?.errorAgents > 0) {
    insights.push(`${stats.orbit.errorAgents} agent${stats.orbit.errorAgents !== 1 ? "s" : ""} failed`);
  }

  if (stats.orbit?.pipelineRunning) {
    insights.push(`Orbit pipeline active`);
  }

  return insights;
}

export default function StatusBar({ stats, heartbeat, onOpenApprovalQueue, onOpenEngagementQueue }: Props) {
  const h = stats?.health;
  const anyDown =
    h &&
    (h.lunary.status === "down" ||
      h.spellcast.status === "down" ||
      h.contentCreator.status === "down");
  const allOk =
    h &&
    h.lunary.status === "ok" &&
    h.spellcast.status === "ok" &&
    h.contentCreator.status === "ok";

  const dotColor = !stats
    ? "bg-gray-500"
    : anyDown
      ? "bg-red-500 animate-pulse"
      : allOk
        ? "bg-green-500"
        : "bg-amber-500";

  const macStatus = heartbeat?.status ?? "no-data";
  const macAge = heartbeat?.ageMinutes ?? 0;
  const macLabel =
    macStatus === "online"
      ? `${macAge}m ago`
      : macStatus === "offline"
        ? "OFFLINE"
        : "---";
  const macColor =
    macStatus === "online"
      ? "text-green-400"
      : macStatus === "offline"
        ? "text-red-400 animate-pulse"
        : "text-white/30";

  const orbitOnline = stats?.orbit?.online ?? false;
  const orbitRunning = stats?.orbit?.runningAgents ?? 0;
  const orbitErrors = stats?.orbit?.errorAgents ?? 0;

  const insights = stats ? getInsights(stats) : [];
  const hasInsights = insights.length > 0;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-sm border-b border-white/10 px-3 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
        <span className="text-[8px] md:text-xs uppercase tracking-widest text-white/60">
          Homebase
        </span>
        {hasInsights && (
          <span className="text-[7px] md:text-[11px] text-amber-400 animate-pulse ml-1">
            {insights[0]}
            {insights.length > 1 && ` +${insights.length - 1}`}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {/* Action badges */}
        {(stats?.content.pendingReview ?? 0) > 0 && (
          <button
            onClick={onOpenApprovalQueue}
            className="flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 rounded px-1.5 py-0.5 cursor-pointer hover:bg-amber-500/25 transition-colors"
          >
            <span className="text-[7px] md:text-[11px] text-amber-400 font-bold">{stats!.content.pendingReview}</span>
            <span className="text-[6px] md:text-[10px] md:text-sm text-amber-400/70">REVIEW</span>
          </button>
        )}
        {(stats?.engagement.unread ?? 0) > 0 && (
          <button
            onClick={onOpenEngagementQueue}
            className="flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/30 rounded px-1.5 py-0.5 cursor-pointer hover:bg-emerald-500/25 transition-colors"
          >
            <span className="text-[7px] md:text-[11px] text-emerald-400 font-bold">{stats!.engagement.unread}</span>
            <span className="text-[6px] md:text-[10px] md:text-sm text-emerald-400/70">ENGAGE</span>
          </button>
        )}
        {/* Orbit indicator */}
        {stats?.orbit && (
          <div className="flex items-center gap-1">
            <span className="text-[7px] md:text-[11px] text-white/40">ORBIT</span>
            <div className={`w-1.5 h-1.5 rounded-full ${orbitOnline ? (orbitErrors > 0 ? "bg-red-400" : orbitRunning > 0 ? "bg-amber-400 animate-pulse" : "bg-green-400") : "bg-gray-500"}`} />
            {orbitRunning > 0 && (
              <span className="text-[7px] md:text-[11px] text-amber-400">{orbitRunning}</span>
            )}
          </div>
        )}
        {/* MAC status */}
        <div className="flex items-center gap-1.5">
          <span className="text-[7px] md:text-[11px] text-white/40">MAC</span>
          <span className={`text-[8px] md:text-xs ${macColor}`}>{macLabel}</span>
        </div>
      </div>
    </div>
  );
}
