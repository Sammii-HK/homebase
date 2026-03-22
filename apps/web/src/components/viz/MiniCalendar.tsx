"use client";

interface DayEntry {
  date: string;
  count: number;
  status: "good" | "gap" | "overloaded";
}

interface Props {
  days: DayEntry[];
}

const STATUS_COLORS: Record<string, string> = {
  good: "#4ade80",
  gap: "#facc15",
  overloaded: "#f87171",
};

const DAY_ABBR = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export default function MiniCalendar({ days }: Props) {
  if (days.length === 0) return null;

  return (
    <div style={{ display: "flex", gap: 4 }}>
      {days.map((day) => {
        const d = new Date(day.date);
        const abbr = DAY_ABBR[d.getDay()] ?? "???";
        const color = STATUS_COLORS[day.status] ?? "#71717a";
        const isToday = day.date === new Date().toISOString().slice(0, 10);

        return (
          <div
            key={day.date}
            style={{
              flex: 1,
              textAlign: "center",
              padding: "6px 2px",
              background: isToday ? "var(--hb-06)" : "transparent",
              border: isToday ? "1px solid var(--hb-15)" : "1px solid transparent",
              borderRadius: 3,
            }}
          >
            <div style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 7,
              color: isToday ? "var(--hb-70)" : "var(--hb-35)",
              marginBottom: 4,
            }}>
              {abbr}
            </div>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: color,
              margin: "0 auto 3px",
              boxShadow: `0 0 4px ${color}60`,
            }} />
            <div style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 7,
              color: "var(--hb-50)",
            }}>
              {day.count}
            </div>
          </div>
        );
      })}
    </div>
  );
}
