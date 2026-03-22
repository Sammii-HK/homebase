"use client";

interface Props {
  value: number;
  max: number;
  label?: string;
  color?: string;
}

export default function ProgressBar({
  value,
  max,
  label,
  color = "#c084fc",
}: Props) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;

  return (
    <div>
      {label && (
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 4,
        }}>
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: "var(--hb-45)" }}>
            {label}
          </span>
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: "var(--hb-60)" }}>
            {value}/{max}
          </span>
        </div>
      )}
      <div style={{
        height: 8,
        background: "var(--hb-06)",
        border: "1px solid var(--hb-10)",
        borderRadius: 2,
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: color,
          borderRadius: 1,
          transition: "width 0.3s ease",
          boxShadow: `0 0 6px ${color}40`,
        }} />
      </div>
    </div>
  );
}
