"use client";

import { authHeaders } from "@/lib/client-auth";
import { useState } from "react";

const PS2P = "'Press Start 2P', monospace";

type ActionState = "idle" | "loading" | "success" | "error";

interface QuickAction {
  id: string;
  label: string;
  title: string;
}

const ACTIONS: QuickAction[] = [
  { id: "approve-all", label: "APPROVE ALL", title: "Approve pending posts with score ≥75" },
  { id: "run-briefing", label: "RUN BRIEFING", title: "Trigger Orbit briefing refresh" },
  { id: "generate-content", label: "GEN CONTENT", title: "Trigger overnight content pipeline on demand" },
  { id: "sync", label: "SYNC", title: "Refresh all stats" },
];

interface Props {
  token: string;
  onAction?: (action: string) => void;
}

function LoadingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 2, alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 3,
            height: 3,
            borderRadius: "50%",
            background: "currentColor",
            display: "inline-block",
            animation: `bounce-dot 1s ease-in-out ${i * 0.16}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

export default function QuickActions({ token, onAction }: Props) {
  const [states, setStates] = useState<Record<string, ActionState>>({});

  const setState = (id: string, state: ActionState) => {
    setStates((prev) => ({ ...prev, [id]: state }));
  };

  const handleAction = async (action: QuickAction) => {
    const current = states[action.id] ?? "idle";
    if (current === "loading") return;

    setState(action.id, "loading");

    try {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: {
          ...authHeaders(token ?? ""),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: action.id }),
      });

      if (res.ok) {
        setState(action.id, "success");
        onAction?.(action.id);
      } else {
        setState(action.id, "error");
      }
    } catch {
      setState(action.id, "error");
    }

    // Reset to idle after 2s
    setTimeout(() => {
      setState(action.id, "idle");
    }, 2000);
  };

  return (
    <>
      <style>{`
        @keyframes bounce-dot {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <div
        style={{
          display: "flex",
          gap: 6,
          width: "100%",
        }}
      >
        {ACTIONS.map((action) => {
          const state = states[action.id] ?? "idle";
          const isLoading = state === "loading";
          const isSuccess = state === "success";
          const isError = state === "error";

          let bg = "var(--hb-04)";
          let border = "var(--hb-10)";
          let colour = "var(--hb-60)";

          if (isLoading) {
            bg = "rgba(167,139,250,0.12)";
            border = "rgba(167,139,250,0.3)";
            colour = "var(--hb-accent)";
          } else if (isSuccess) {
            bg = "rgba(52,211,153,0.12)";
            border = "rgba(52,211,153,0.3)";
            colour = "#34d399";
          } else if (isError) {
            bg = "rgba(238,120,158,0.12)";
            border = "rgba(238,120,158,0.3)";
            colour = "var(--hb-error-soft)";
          }

          return (
            <button
              key={action.id}
              onClick={() => handleAction(action)}
              title={action.title}
              disabled={isLoading}
              style={{
                flex: 1,
                fontFamily: PS2P,
                fontSize: 6,
                color: colour,
                background: bg,
                border: `1px solid ${border}`,
                borderRadius: 5,
                padding: "7px 4px",
                cursor: isLoading ? "not-allowed" : "pointer",
                transition: "background 0.15s, border-color 0.15s, color 0.15s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                minHeight: 32,
                letterSpacing: 0.3,
                lineHeight: 1.4,
                textAlign: "center",
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              {isLoading ? (
                <LoadingDots />
              ) : isSuccess ? (
                <span style={{ fontSize: 7 }}>&#10003;</span>
              ) : isError ? (
                <span style={{ fontSize: 7 }}>&#10007;</span>
              ) : (
                action.label
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
