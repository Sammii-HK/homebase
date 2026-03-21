"use client";

import { useState, useEffect, useCallback } from "react";
import { authHeaders } from "@/lib/client-auth";

const PS2P = "'Press Start 2P', monospace";

interface CastJob {
  id: string;
  company: string;
  role: string;
  status: string;
  fitScore: number | null;
  interviewDate: string | null;
  notionUrl: string;
  coverLetterPreview?: string;
  cvHeadline?: string;
}

interface CastData {
  pending: CastJob[];
  interviews: CastJob[];
  assignments: CastJob[];
  total: number;
  updatedAt: string;
}

interface Props {
  token: string;
}

const STATUS_COLORS: Record<string, string> = {
  "Interview 💬": "#4ade80",
  "Assignment given 📑": "#f59e0b",
  "Pending ⏳": "#60a5fa",
  "To apply": "rgba(255,255,255,0.4)",
};

const STATUS_BG: Record<string, string> = {
  "Interview 💬": "rgba(74,222,128,0.1)",
  "Assignment given 📑": "rgba(245,158,11,0.1)",
  "Pending ⏳": "rgba(96,165,250,0.1)",
  "To apply": "rgba(255,255,255,0.04)",
};

const STATUS_BORDER: Record<string, string> = {
  "Interview 💬": "rgba(74,222,128,0.25)",
  "Assignment given 📑": "rgba(245,158,11,0.25)",
  "Pending ⏳": "rgba(96,165,250,0.2)",
  "To apply": "rgba(255,255,255,0.08)",
};

function formatDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch {
    return isoDate;
  }
}

function FitScore({ score }: { score: number | null }) {
  if (score === null) return null;
  const color =
    score >= 80 ? "#4ade80" : score >= 60 ? "#f59e0b" : "rgba(255,255,255,0.35)";
  return (
    <span
      style={{
        fontFamily: PS2P,
        fontSize: 7,
        color,
        background: `${color}15`,
        border: `1px solid ${color}30`,
        borderRadius: 3,
        padding: "2px 5px",
        flexShrink: 0,
      }}
    >
      {score}%
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "rgba(255,255,255,0.4)";
  return (
    <span
      style={{
        fontFamily: PS2P,
        fontSize: 6,
        color,
        background: `${color}12`,
        border: `1px solid ${color}25`,
        borderRadius: 3,
        padding: "2px 5px",
        flexShrink: 0,
        letterSpacing: 0.3,
      }}
    >
      {status}
    </span>
  );
}

function JobRow({ job }: { job: CastJob }) {
  const [expanded, setExpanded] = useState(false);
  const color = STATUS_COLORS[job.status] ?? "rgba(255,255,255,0.4)";
  const bg = STATUS_BG[job.status] ?? "rgba(255,255,255,0.03)";
  const border = STATUS_BORDER[job.status] ?? "rgba(255,255,255,0.08)";
  const hasPreview = !!(job.coverLetterPreview || job.cvHeadline);

  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 6,
        overflow: "hidden",
        transition: "all 0.15s",
      }}
    >
      {/* Main row — expands if preview available, otherwise opens Notion */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "10px 12px",
          cursor: "pointer",
        }}
        onClick={() => {
          if (hasPreview) {
            setExpanded((v) => !v);
          } else {
            window.open(job.notionUrl, "_blank", "noopener,noreferrer");
          }
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.background = `${color}18`;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.background = "transparent";
        }}
      >
        {/* Left accent bar */}
        <div
          style={{
            width: 3,
            borderRadius: 2,
            background: color,
            alignSelf: "stretch",
            flexShrink: 0,
            minHeight: 20,
          }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontFamily: PS2P,
                fontSize: 9,
                color: "#fff",
                letterSpacing: 0.3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {job.company}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <FitScore score={job.fitScore} />
              {job.interviewDate && (
                <span
                  style={{
                    fontFamily: PS2P,
                    fontSize: 7,
                    color: "#4ade80",
                    flexShrink: 0,
                  }}
                >
                  {formatDate(job.interviewDate)}
                </span>
              )}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.55)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
              }}
            >
              {job.role}
            </span>
            <StatusBadge status={job.status} />
            {hasPreview && (
              <span
                style={{
                  fontFamily: PS2P,
                  fontSize: 6,
                  color: "rgba(255,255,255,0.3)",
                  flexShrink: 0,
                  userSelect: "none",
                }}
              >
                {expanded ? "▲" : "▼"} PREVIEW
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Expanded preview panel */}
      {expanded && hasPreview && (
        <div
          style={{
            borderTop: `1px solid ${border}`,
            padding: "12px 14px",
            background: "rgba(0,0,0,0.25)",
          }}
        >
          {job.cvHeadline && (
            <div style={{ marginBottom: 10 }}>
              <div
                style={{
                  fontFamily: PS2P,
                  fontSize: 6,
                  color: "rgba(255,255,255,0.3)",
                  letterSpacing: 1,
                  marginBottom: 4,
                }}
              >
                CV HEADLINE
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.7)",
                  lineHeight: 1.5,
                }}
              >
                {job.cvHeadline}
              </div>
            </div>
          )}

          {job.coverLetterPreview && (
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontFamily: PS2P,
                  fontSize: 6,
                  color: "rgba(255,255,255,0.3)",
                  letterSpacing: 1,
                  marginBottom: 4,
                }}
              >
                COVER LETTER
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.45)",
                  lineHeight: 1.6,
                  fontStyle: "italic",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 4,
                  padding: "8px 10px",
                }}
              >
                {job.coverLetterPreview}
              </div>
            </div>
          )}

          <a
            href={job.notionUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              fontFamily: PS2P,
              fontSize: 7,
              color: color,
              background: `${color}12`,
              border: `1px solid ${color}30`,
              borderRadius: 4,
              padding: "5px 10px",
              textDecoration: "none",
              letterSpacing: 0.5,
            }}
          >
            OPEN IN NOTION
          </a>
        </div>
      )}
    </div>
  );
}

function SectionBlock({
  label,
  color,
  jobs,
}: {
  label: string;
  color: string;
  jobs: CastJob[];
}) {
  if (jobs.length === 0) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            width: 4,
            height: 12,
            borderRadius: 2,
            background: color,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: PS2P,
            fontSize: 7,
            color,
            letterSpacing: 1,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: PS2P,
            fontSize: 6,
            color: "rgba(255,255,255,0.25)",
            marginLeft: 2,
          }}
        >
          ({jobs.length})
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {jobs.map((job) => (
          <JobRow key={job.id} job={job} />
        ))}
      </div>
    </div>
  );
}

export default function CastQueue({ token }: Props) {
  const [data, setData] = useState<CastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/stats/cast", {
        headers: authHeaders(token),
      });
      if (res.ok) {
        setData(await res.json());
        setError(false);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 8,
          padding: 16,
        }}
      >
        <p
          style={{
            fontFamily: PS2P,
            fontSize: 8,
            color: "rgba(255,255,255,0.3)",
          }}
        >
          Loading jobs...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          background: "rgba(248,113,113,0.06)",
          border: "1px solid rgba(248,113,113,0.2)",
          borderRadius: 8,
          padding: 16,
        }}
      >
        <p
          style={{
            fontFamily: PS2P,
            fontSize: 8,
            color: "#f87171",
          }}
        >
          Could not load jobs — check NOTION_TOKEN
        </p>
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 8,
          padding: 16,
        }}
      >
        <p
          style={{
            fontFamily: PS2P,
            fontSize: 8,
            color: "rgba(255,255,255,0.3)",
          }}
        >
          No active applications
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Stats summary row */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        {[
          { label: "INTERVIEWS", value: data.interviews.length, color: "#4ade80" },
          { label: "ASSIGNMENTS", value: data.assignments.length, color: "#f59e0b" },
          { label: "PENDING", value: data.pending.filter(j => j.status === "Pending ⏳").length, color: "#60a5fa" },
          { label: "TO APPLY", value: data.pending.filter(j => j.status === "To apply").length, color: "rgba(255,255,255,0.4)" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            style={{
              background: `${color}08`,
              border: `1px solid ${color}20`,
              borderRadius: 6,
              padding: "8px 12px",
              textAlign: "center",
              minWidth: 70,
            }}
          >
            <div
              style={{
                fontFamily: PS2P,
                fontSize: 16,
                color,
                marginBottom: 4,
              }}
            >
              {value}
            </div>
            <div
              style={{
                fontFamily: PS2P,
                fontSize: 6,
                color: "rgba(255,255,255,0.3)",
                letterSpacing: 0.5,
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Grouped sections — most urgent first */}
      <SectionBlock
        label="INTERVIEWS"
        color="#4ade80"
        jobs={data.interviews}
      />
      <SectionBlock
        label="ASSIGNMENTS"
        color="#f59e0b"
        jobs={data.assignments}
      />
      <SectionBlock
        label="PENDING"
        color="#60a5fa"
        jobs={data.pending.filter(j => j.status === "Pending ⏳")}
      />
      <SectionBlock
        label="TO APPLY"
        color="rgba(255,255,255,0.4)"
        jobs={data.pending.filter(j => j.status === "To apply")}
      />

      {/* Updated timestamp */}
      {data.updatedAt && (
        <p
          style={{
            fontFamily: PS2P,
            fontSize: 6,
            color: "rgba(255,255,255,0.2)",
            textAlign: "right",
            marginTop: 8,
          }}
        >
          Updated {new Date(data.updatedAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
