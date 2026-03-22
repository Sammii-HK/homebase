"use client";

import { useState, useEffect } from "react";

const PS2P = "'Press Start 2P', monospace";

const SHORTCUTS = [
  { keys: "A", description: "Approval Queue" },
  { keys: "E", description: "Engagement Queue" },
  { keys: "R", description: "Refresh Data" },
  { keys: "⌘ K", description: "Command Palette" },
  { keys: "1–6", description: "Open Room (in palette)" },
  { keys: "↑ ↓", description: "Navigate Palette" },
  { keys: "↵", description: "Select Command" },
  { keys: "ESC", description: "Close Overlay" },
];

export default function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "fixed",
          bottom: 12,
          right: 12,
          zIndex: 40,
          width: 28,
          height: 28,
          borderRadius: 6,
          background: "var(--hb-06)",
          border: "1px solid var(--hb-15)",
          color: "var(--hb-35)",
          fontFamily: PS2P,
          fontSize: 11,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        title="Keyboard shortcuts (?)"
      >
        ?
      </button>

      {/* Panel */}
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 90,
            }}
          />
          <div
            style={{
              position: "fixed",
              bottom: 48,
              right: 12,
              zIndex: 91,
              background: "rgba(12,12,18,0.96)",
              border: "1px solid var(--hb-12)",
              borderRadius: 8,
              padding: "12px 16px",
              minWidth: 220,
              boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
            }}
          >
            <div
              style={{
                fontFamily: PS2P,
                fontSize: 7,
                color: "var(--hb-30)",
                letterSpacing: 1,
                marginBottom: 10,
              }}
            >
              KEYBOARD SHORTCUTS
            </div>
            {SHORTCUTS.map((s) => (
              <div
                key={s.keys}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "5px 0",
                  borderBottom: "1px solid var(--hb-04)",
                }}
              >
                <span
                  style={{
                    fontFamily: PS2P,
                    fontSize: 8,
                    color: "var(--hb-50)",
                  }}
                >
                  {s.description}
                </span>
                <span
                  style={{
                    fontFamily: PS2P,
                    fontSize: 8,
                    color: "#c084fc",
                    background: "var(--hb-05)",
                    padding: "2px 6px",
                    borderRadius: 3,
                    border: "1px solid var(--hb-08)",
                    marginLeft: 12,
                  }}
                >
                  {s.keys}
                </span>
              </div>
            ))}
            <div
              style={{
                fontFamily: PS2P,
                fontSize: 6,
                color: "var(--hb-15)",
                marginTop: 8,
                textAlign: "center",
              }}
            >
              press ? to toggle
            </div>
          </div>
        </>
      )}
    </>
  );
}
