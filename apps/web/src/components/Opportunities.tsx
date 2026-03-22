"use client";

import { Opportunity, DashboardStats } from "@/types/dashboard";

const PS2P = "'Press Start 2P', monospace";

const PLATFORM_ICONS: Record<string, string> = {
  instagram: "IG",
  threads: "TH",
  twitter: "X",
  x: "X",
  tiktok: "TT",
  linkedin: "LI",
  facebook: "FB",
  reddit: "RD",
  bluesky: "BS",
  unknown: "??",
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E1306C",
  threads: "#fff",
  twitter: "#1DA1F2",
  x: "#1DA1F2",
  tiktok: "#00f2ea",
  linkedin: "#0A66C2",
  facebook: "#1877F2",
  reddit: "#FF4500",
  bluesky: "#0085ff",
  unknown: "#71717a",
};

interface Props {
  /** New call signature: pass opportunities array directly */
  opportunities?: Opportunity[] | null;
  token?: string;
  /** Legacy call signature: pass full stats object */
  stats?: DashboardStats | null;
}

export default function Opportunities({ opportunities, stats }: Props) {
  const items = opportunities ?? stats?.opportunities ?? [];

  return (
    <div
      style={{
        background: "var(--hb-03)",
        border: "1px solid var(--hb-08)",
        borderRadius: 8,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* Header */}
      <div
        style={{
          fontFamily: PS2P,
          fontSize: 8,
          color: "#a78bfa",
          letterSpacing: 1,
          marginBottom: 2,
        }}
      >
        OPPORTUNITIES
      </div>

      {items.length === 0 ? (
        <div
          style={{
            fontFamily: PS2P,
            fontSize: 8,
            color: "var(--hb-20)",
            textAlign: "center",
            padding: "16px 0",
          }}
        >
          NO OPPORTUNITIES
        </div>
      ) : (
        items.map((opp) => {
          const platformColor = PLATFORM_COLORS[opp.platform] ?? PLATFORM_COLORS.unknown;
          const platformIcon = PLATFORM_ICONS[opp.platform] ?? PLATFORM_ICONS.unknown;
          const isThreads = opp.platform === "threads";
          const snippet =
            opp.content.length > 80
              ? opp.content.slice(0, 80) + "..."
              : opp.content;
          const scorePercent = Math.round(Math.min(opp.relevanceScore, 1) * 100);

          return (
            <a
              key={opp.id}
              href={opp.platformUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block",
                textDecoration: "none",
                padding: "12px 14px",
                background: "var(--hb-03)",
                border: "1px solid var(--hb-08)",
                borderLeft: `3px solid ${isThreads ? "#fff" : platformColor}`,
                borderRadius: 6,
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background =
                  "var(--hb-06)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background =
                  "var(--hb-03)";
              }}
            >
              {/* Top row: platform badge + handle */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontFamily: PS2P,
                    fontSize: 7,
                    color: isThreads ? "#fff" : platformColor,
                    background: isThreads
                      ? "var(--hb-10)"
                      : `${platformColor}20`,
                    padding: "2px 6px",
                    borderRadius: 3,
                    letterSpacing: 1,
                    border: isThreads ? "1px solid var(--hb-20)" : "none",
                  }}
                >
                  {platformIcon}
                </span>
                {opp.authorHandle && (
                  <span
                    style={{
                      fontFamily: PS2P,
                      fontSize: 6,
                      color: "var(--hb-45)",
                    }}
                  >
                    @{opp.authorHandle.replace(/^@/, "")}
                  </span>
                )}
              </div>

              {/* Content snippet */}
              <div
                style={{
                  fontFamily: PS2P,
                  fontSize: 7,
                  color: "var(--hb-60)",
                  lineHeight: 1.6,
                  marginBottom: 10,
                  wordBreak: "break-word",
                }}
              >
                {snippet}
              </div>

              {/* Relevance score bar */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    flex: 1,
                    height: 3,
                    background: "var(--hb-08)",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${scorePercent}%`,
                      height: "100%",
                      background:
                        scorePercent >= 75
                          ? "#4ade80"
                          : scorePercent >= 50
                          ? "#f59e0b"
                          : "#60a5fa",
                      borderRadius: 2,
                    }}
                  />
                </div>
                <span
                  style={{
                    fontFamily: PS2P,
                    fontSize: 6,
                    color: "var(--hb-30)",
                    minWidth: 28,
                    textAlign: "right",
                  }}
                >
                  {scorePercent}%
                </span>
              </div>
            </a>
          );
        })
      )}
    </div>
  );
}
