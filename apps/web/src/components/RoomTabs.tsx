"use client";

interface Props {
  tabs: string[];
  active: string;
  accent: string;
  onChange: (tab: string) => void;
}

export default function RoomTabs({ tabs, active, accent, onChange }: Props) {
  return (
    <div style={{
      display: "flex",
      gap: 0,
      borderBottom: "1px solid rgba(255,255,255,0.1)",
      marginBottom: 12,
    }}>
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 8,
            color: tab === active ? accent : "rgba(255,255,255,0.35)",
            background: "none",
            border: "none",
            borderBottom: tab === active ? `2px solid ${accent}` : "2px solid transparent",
            padding: "8px 12px",
            cursor: "pointer",
            transition: "color 0.15s, border-color 0.15s",
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
