import type { DashboardStats, HeartbeatResponse } from "@/types/dashboard";

interface Props {
  stats: DashboardStats | null;
  heartbeat: HeartbeatResponse | null;
}

interface ServiceRow {
  name: string;
  status: "ok" | "degraded" | "down" | "unknown";
  source: "cloud" | "mac";
}

const DOT: Record<string, string> = {
  ok: "bg-green-500",
  degraded: "bg-amber-500",
  down: "bg-red-500 animate-pulse",
  unknown: "bg-white/20",
};

export default function ServiceHealth({ stats, heartbeat }: Props) {
  const cloud: ServiceRow[] = stats?.health
    ? [
        { name: "Spellcast", status: stats.health.spellcast.status, source: "cloud" },
        { name: "Content", status: stats.health.contentCreator.status, source: "cloud" },
        { name: "Orbit", status: stats.health.orbit.status, source: "cloud" },
      ]
    : [
        { name: "Spellcast", status: "unknown", source: "cloud" },
        { name: "Content", status: "unknown", source: "cloud" },
        { name: "Orbit", status: "unknown", source: "cloud" },
      ];

  const hbServices = heartbeat?.heartbeat?.services ?? {};
  // Local Mac services only — Orbit is a cloud service checked via its public URL
  const localKeys = ["n8n", "brandApi", "whisper"] as const;
  const local: ServiceRow[] = localKeys.map((key) => ({
    name: key === "brandApi" ? "Brand API" : key === "n8n" ? "n8n" : key.charAt(0).toUpperCase() + key.slice(1),
    status: hbServices[key]
      ? (hbServices[key].status as "ok" | "down")
      : "unknown",
    source: "mac" as const,
  }));

  const all = [...cloud, ...local];
  const disk = heartbeat?.heartbeat?.disk;
  const macOnline = heartbeat?.status === "online";

  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[8px] md:text-xs uppercase tracking-wider text-white/40">
          Services
        </p>
        {disk && (
          <span
            className={`text-[7px] md:text-[11px] tabular-nums ${
              disk.pct >= 90 ? "text-red-400" : disk.pct >= 80 ? "text-amber-400" : "text-white/30"
            }`}
            title={`Disk: ${disk.used} used, ${disk.avail} free`}
          >
            💾 {disk.pct}%
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {all.map((svc) => (
          <div key={svc.name} className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full shrink-0 ${DOT[svc.status]}`} />
            <span className="text-[8px] md:text-xs text-white/70">{svc.name}</span>
            {svc.source === "mac" && (
              <span className={`text-[6px] md:text-[10px] ml-auto ${macOnline ? "text-white/20" : "text-amber-500/50"}`}>
                {macOnline ? "mac" : "off"}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
