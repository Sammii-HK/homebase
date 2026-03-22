"use client";

import type { HeartbeatTask } from "@/types/dashboard";

interface Props {
  tasks: HeartbeatTask[] | undefined | null;
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  in_progress: { color: "#a78bfa", label: "active" },
  ready:       { color: "#60a5fa", label: "ready" },
  blocked:     { color: "#f87171", label: "blocked" },
};

const PROJECT_COLOURS: Record<string, string> = {
  lunary:           "#a78bfa",
  spellcast:        "#60a5fa",
  homebase:         "#34d399",
  orbit:            "#f59e0b",
  cast:             "#f87171",
  content:          "#fb7185",
  "digital-products": "#c084fc",
  infra:            "#94a3b8",
};

function projectColor(project: string): string {
  return PROJECT_COLOURS[project] ?? "#555";
}

export default function TasksWidget({ tasks }: Props) {
  if (!tasks || tasks.length === 0) return null;

  const inProgress = tasks.filter(t => t.status === "in_progress");
  const blocked = tasks.filter(t => t.status === "blocked");
  const ready = tasks.filter(t => t.status === "ready" || !STATUS_CONFIG[t.status]);

  // Show in_progress first, then blocked, then ready
  const ordered = [...inProgress, ...blocked, ...ready].slice(0, 8);

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8,
        padding: "10px 12px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 7,
            color: "rgba(255,255,255,0.4)",
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          Open Tasks
        </span>
        <span
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 10,
            color: "rgba(255,255,255,0.25)",
          }}
        >
          {tasks.length} open
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {ordered.map((task) => {
          const cfg = STATUS_CONFIG[task.status] ?? { color: "#555", label: task.status };
          const projColor = projectColor(task.project);

          return (
            <div
              key={task.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 7,
                padding: "5px 7px",
                background: `${cfg.color}08`,
                border: `1px solid ${cfg.color}20`,
                borderRadius: 5,
              }}
            >
              {/* Status dot */}
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: cfg.color,
                  flexShrink: 0,
                  marginTop: 4,
                  animation: task.status === "in_progress" ? "pulse 1.5s ease-in-out infinite" : undefined,
                }}
              />

              {/* Title */}
              <span
                style={{
                  fontFamily: "system-ui, sans-serif",
                  fontSize: 11,
                  color: "rgba(255,255,255,0.7)",
                  flex: 1,
                  lineHeight: 1.4,
                  wordBreak: "break-word",
                }}
              >
                {task.title}
              </span>

              {/* Project tag */}
              {task.project && (
                <span
                  style={{
                    fontFamily: "system-ui, sans-serif",
                    fontSize: 9,
                    color: projColor,
                    background: `${projColor}18`,
                    border: `1px solid ${projColor}30`,
                    borderRadius: 3,
                    padding: "1px 5px",
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                    alignSelf: "flex-start",
                  }}
                >
                  {task.project}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {tasks.length > 8 && (
        <p
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 10,
            color: "rgba(255,255,255,0.2)",
            marginTop: 6,
            textAlign: "center",
          }}
        >
          +{tasks.length - 8} more
        </p>
      )}
    </div>
  );
}
