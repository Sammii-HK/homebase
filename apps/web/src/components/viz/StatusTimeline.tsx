"use client";

interface Segment {
  ts: string;
  services: Record<string, "ok" | "down">;
}

interface Props {
  segments: Segment[];
  service: string;
}

export default function StatusTimeline({ segments, service }: Props) {
  if (segments.length === 0) return null;

  return (
    <div>
      <div style={{
        fontFamily: "'Press Start 2P', monospace",
        fontSize: 8,
        color: "var(--hb-40)",
        marginBottom: 4,
      }}>
        24H HEALTH
      </div>
      <div style={{
        display: "flex",
        height: 8,
        borderRadius: 2,
        overflow: "hidden",
        border: "1px solid var(--hb-10)",
      }}>
        {segments.map((seg, i) => {
          const status = seg.services[service] ?? "ok";
          return (
            <div
              key={i}
              style={{
                flex: 1,
                background: status === "ok" ? "#4ade80" : "#f87171",
              }}
              title={`${new Date(seg.ts).toLocaleTimeString()} — ${status}`}
            />
          );
        })}
      </div>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        marginTop: 2,
      }}>
        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "var(--hb-25)" }}>24h ago</span>
        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "var(--hb-25)" }}>now</span>
      </div>
    </div>
  );
}
