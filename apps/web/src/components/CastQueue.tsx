"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  "Interview 💬": "var(--hb-success)",
  "Assignment given 📑": "var(--hb-warn)",
  "Pending ⏳": "#60a5fa",
  "To apply": "var(--hb-60)",
};

const STATUS_BG: Record<string, string> = {
  "Interview 💬": "rgba(133,173,146,0.1)",
  "Assignment given 📑": "rgba(217,141,237,0.1)",
  "Pending ⏳": "rgba(96,165,250,0.1)",
  "To apply": "var(--hb-04)",
};

const STATUS_BORDER: Record<string, string> = {
  "Interview 💬": "rgba(133,173,146,0.25)",
  "Assignment given 📑": "rgba(217,141,237,0.25)",
  "Pending ⏳": "rgba(96,165,250,0.2)",
  "To apply": "var(--hb-08)",
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
    score >= 80 ? "var(--hb-success)" : score >= 60 ? "var(--hb-warn)" : "var(--hb-60)";
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
  const color = STATUS_COLORS[status] ?? "var(--hb-60)";
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
  const color = STATUS_COLORS[job.status] ?? "var(--hb-60)";
  const bg = STATUS_BG[job.status] ?? "var(--hb-03)";
  const border = STATUS_BORDER[job.status] ?? "var(--hb-08)";
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
                    color: "var(--hb-success)",
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
                color: "var(--hb-60)",
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
                  color: "var(--hb-60)",
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
            background: "var(--hb-panel-25)",
          }}
        >
          {job.cvHeadline && (
            <div style={{ marginBottom: 10 }}>
              <div
                style={{
                  fontFamily: PS2P,
                  fontSize: 6,
                  color: "var(--hb-60)",
                  letterSpacing: 1,
                  marginBottom: 4,
                }}
              >
                CV HEADLINE
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--hb-70)",
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
                  color: "var(--hb-60)",
                  letterSpacing: 1,
                  marginBottom: 4,
                }}
              >
                COVER LETTER
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--hb-45)",
                  lineHeight: 1.6,
                  fontStyle: "italic",
                  background: "var(--hb-03)",
                  border: "1px solid var(--hb-06)",
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
            color: "var(--hb-60)",
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

  // New application form state
  const [showForm, setShowForm] = useState(false);
  const [formUrl, setFormUrl] = useState("");
  const [formCompany, setFormCompany] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showForm) {
      setTimeout(() => urlInputRef.current?.focus(), 50);
    }
  }, [showForm]);

  const handleStartApplication = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUrl.trim() || submitting) return;

    setSubmitting(true);
    setSubmitStatus("idle");

    try {
      const res = await fetch("/api/cast/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(token),
        },
        body: JSON.stringify({ url: formUrl.trim(), company: formCompany.trim() }),
      });

      const json = await res.json();

      if (res.ok) {
        setSubmitStatus("success");
        setSubmitMessage(json.message ?? "APPLICATION QUEUED");
        setFormUrl("");
        setFormCompany("");
        setTimeout(() => {
          setShowForm(false);
          setSubmitStatus("idle");
          setSubmitMessage("");
        }, 3000);
      } else {
        setSubmitStatus("error");
        setSubmitMessage(json.error ?? "Failed to queue application");
      }
    } catch {
      setSubmitStatus("error");
      setSubmitMessage("Network error — try again");
    } finally {
      setSubmitting(false);
    }
  }, [formUrl, formCompany, submitting, token]);

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

  // Helper: renders the START APPLICATION button + inline form
  const renderNewApplicationForm = () => (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: showForm ? 12 : 16,
        }}
      >
        <button
          onClick={() => {
            setShowForm((v) => !v);
            setSubmitStatus("idle");
            setSubmitMessage("");
          }}
          style={{
            fontFamily: PS2P,
            fontSize: 7,
            padding: "8px 12px",
            background: showForm
              ? "var(--hb-06)"
              : "rgba(167,139,250,0.12)",
            border: `1px solid ${showForm ? "var(--hb-12)" : "rgba(167,139,250,0.3)"}`,
            borderRadius: 5,
            color: showForm ? "var(--hb-60)" : "var(--hb-accent)",
            cursor: "pointer",
            letterSpacing: 0.5,
          }}
        >
          {showForm ? "CANCEL" : "START APPLICATION"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleStartApplication}
          style={{
            background: "rgba(167,139,250,0.05)",
            border: "1px solid rgba(167,139,250,0.15)",
            borderRadius: 8,
            padding: "14px 16px",
            marginBottom: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div
            style={{
              fontFamily: PS2P,
              fontSize: 7,
              color: "rgba(167,139,250,0.7)",
              letterSpacing: 1,
              marginBottom: 2,
            }}
          >
            NEW APPLICATION
          </div>

          <input
            ref={urlInputRef}
            type="url"
            required
            value={formUrl}
            onChange={(e) => setFormUrl(e.target.value)}
            placeholder="Job URL (required)"
            style={{
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontSize: 13,
              padding: "9px 11px",
              background: "var(--hb-panel-40)",
              border: "1px solid var(--hb-12)",
              borderRadius: 5,
              color: "#fff",
              outline: "none",
              width: "100%",
              boxSizing: "border-box",
            }}
          />

          <input
            type="text"
            value={formCompany}
            onChange={(e) => setFormCompany(e.target.value)}
            placeholder="Company name (optional)"
            style={{
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontSize: 13,
              padding: "9px 11px",
              background: "var(--hb-panel-40)",
              border: "1px solid var(--hb-12)",
              borderRadius: 5,
              color: "#fff",
              outline: "none",
              width: "100%",
              boxSizing: "border-box",
            }}
          />

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="submit"
              disabled={!formUrl.trim() || submitting}
              style={{
                fontFamily: PS2P,
                fontSize: 7,
                padding: "9px 14px",
                background:
                  !formUrl.trim() || submitting
                    ? "rgba(167,139,250,0.05)"
                    : "rgba(167,139,250,0.18)",
                border: "1px solid rgba(167,139,250,0.25)",
                borderRadius: 5,
                color:
                  !formUrl.trim() || submitting
                    ? "rgba(167,139,250,0.3)"
                    : "var(--hb-accent)",
                cursor: !formUrl.trim() || submitting ? "default" : "pointer",
                letterSpacing: 0.5,
              }}
            >
              {submitting ? "RUNNING CAST..." : "QUEUE APPLICATION"}
            </button>

            {submitStatus === "success" && (
              <span
                style={{
                  fontFamily: PS2P,
                  fontSize: 6,
                  color: "var(--hb-success)",
                  letterSpacing: 0.5,
                }}
              >
                APPLICATION STARTED
              </span>
            )}

            {submitStatus === "error" && (
              <span
                style={{
                  fontFamily: PS2P,
                  fontSize: 6,
                  color: "var(--hb-error-soft)",
                  letterSpacing: 0.3,
                }}
              >
                {submitMessage}
              </span>
            )}
          </div>

          {submitStatus === "success" && (
            <div
              style={{
                fontFamily: PS2P,
                fontSize: 6,
                color: "rgba(133,173,146,0.6)",
                letterSpacing: 0.3,
              }}
            >
              {submitMessage}
            </div>
          )}
        </form>
      )}
    </>
  );

  if (loading) {
    return (
      <div>
        {renderNewApplicationForm()}
        <div
          style={{
            background: "var(--hb-03)",
            border: "1px solid var(--hb-08)",
            borderRadius: 8,
            padding: 16,
          }}
        >
          <p
            style={{
              fontFamily: PS2P,
              fontSize: 8,
              color: "var(--hb-60)",
            }}
          >
            Loading jobs...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        {renderNewApplicationForm()}
        <div
          style={{
            background: "rgba(238,120,158,0.06)",
            border: "1px solid rgba(238,120,158,0.2)",
            borderRadius: 8,
            padding: 16,
          }}
        >
          <p
            style={{
              fontFamily: PS2P,
              fontSize: 8,
              color: "var(--hb-error-soft)",
            }}
          >
            Could not load jobs — check NOTION_TOKEN
          </p>
        </div>
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <div>
        {renderNewApplicationForm()}
        <div
          style={{
            background: "var(--hb-03)",
            border: "1px solid var(--hb-08)",
            borderRadius: 8,
            padding: 16,
          }}
        >
          <p
            style={{
              fontFamily: PS2P,
              fontSize: 8,
              color: "var(--hb-60)",
            }}
          >
            No active applications
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {renderNewApplicationForm()}

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
          { label: "INTERVIEWS", value: data.interviews.length, color: "var(--hb-success)" },
          { label: "ASSIGNMENTS", value: data.assignments.length, color: "var(--hb-warn)" },
          { label: "PENDING", value: data.pending.filter(j => j.status === "Pending ⏳").length, color: "#60a5fa" },
          { label: "TO APPLY", value: data.pending.filter(j => j.status === "To apply").length, color: "var(--hb-60)" },
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
                color: "var(--hb-60)",
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
        color="var(--hb-success)"
        jobs={data.interviews}
      />
      <SectionBlock
        label="ASSIGNMENTS"
        color="var(--hb-warn)"
        jobs={data.assignments}
      />
      <SectionBlock
        label="PENDING"
        color="#60a5fa"
        jobs={data.pending.filter(j => j.status === "Pending ⏳")}
      />
      <SectionBlock
        label="TO APPLY"
        color="var(--hb-60)"
        jobs={data.pending.filter(j => j.status === "To apply")}
      />

      {/* Updated timestamp */}
      {data.updatedAt && (
        <p
          style={{
            fontFamily: PS2P,
            fontSize: 6,
            color: "var(--hb-20)",
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
