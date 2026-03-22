"use client";

import { authHeaders } from "@/lib/client-auth";
import { useState, useEffect, useRef, useCallback } from "react";
import type { DashboardStats } from "@/types/dashboard";

const PS2P = "'Press Start 2P', monospace";

interface Command {
  id: string;
  label: string;
  category: "navigate" | "action" | "deploy" | "link";
  description?: string;
  icon: string;
  shortcut?: string;
  action: () => void | Promise<void>;
  condition?: (stats: DashboardStats | null) => boolean;
  alert?: (stats: DashboardStats | null) => boolean;
}

interface Props {
  stats: DashboardStats | null;
  token: string | null;
  onOpenRoom: (room: "lunary" | "spellcast" | "dev" | "meta" | "orbit" | "engagement") => void;
  onOpenApprovalQueue: () => void;
  onOpenEngagementQueue: () => void;
  onRefresh: () => void;
}

const CATEGORY_ORDER = ["action", "navigate", "deploy", "link"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  action: "ACTIONS",
  navigate: "ROOMS",
  deploy: "DEPLOY",
  link: "OPEN",
};

export default function CommandPalette({ stats, token, onOpenRoom, onOpenApprovalQueue, onOpenEngagementQueue, onRefresh }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const doAction = useCallback(async (action: string, extra?: Record<string, unknown>) => {
    if (!token) return;
    setRunning(action);
    setResult(null);
    try {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { ...authHeaders(token ?? ""), "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      setResult({ ok: res.ok, message: data.message ?? data.error ?? "Done" });
      if (res.ok) setTimeout(() => onRefresh(), 2000);
    } catch {
      setResult({ ok: false, message: "Request failed" });
    } finally {
      setRunning(null);
    }
  }, [token, onRefresh]);

  const commands: Command[] = [
    // Rooms
    { id: "room-lunary", label: "Lunary Observatory", category: "navigate", icon: "🔮", shortcut: "1", action: () => { onOpenRoom("lunary"); setOpen(false); } },
    { id: "room-spellcast", label: "Spellcast Command", category: "navigate", icon: "📡", shortcut: "2", action: () => { onOpenRoom("spellcast"); setOpen(false); } },
    { id: "room-dev", label: "Dev Den", category: "navigate", icon: "🖥", shortcut: "3", action: () => { onOpenRoom("dev"); setOpen(false); } },
    { id: "room-meta", label: "Meta Analytics", category: "navigate", icon: "📊", shortcut: "4", action: () => { onOpenRoom("meta"); setOpen(false); } },
    { id: "room-orbit", label: "Orbit HQ", category: "navigate", icon: "🛰", shortcut: "5", action: () => { onOpenRoom("orbit"); setOpen(false); } },
    { id: "room-engagement", label: "Engagement", category: "navigate", icon: "💬", shortcut: "6", action: () => { onOpenRoom("engagement"); setOpen(false); } },
    { id: "launch-tracker", label: "Launch Tracker", category: "navigate", icon: "🚀", shortcut: "L", description: "GTM command centre", action: () => { const el = document.querySelector('[data-launch-tracker]'); if (el) el.scrollIntoView({ behavior: 'smooth' }); setOpen(false); } },

    // Actions
    {
      id: "approval-queue",
      label: "Review Approval Queue",
      category: "action",
      icon: "📋",
      shortcut: "A",
      description: `${stats?.content.pendingReview ?? 0} pending`,
      action: () => { onOpenApprovalQueue(); setOpen(false); },
      alert: (s) => (s?.content.pendingReview ?? 0) > 0,
    },
    {
      id: "engagement-queue",
      label: "Review Engagement Queue",
      category: "action",
      icon: "💬",
      shortcut: "E",
      description: `${stats?.engagement.unread ?? 0} unread`,
      action: () => { onOpenEngagementQueue(); setOpen(false); },
      alert: (s) => (s?.engagement.unread ?? 0) > 5,
    },
    {
      id: "retry-failed",
      label: "Retry All Failed Posts",
      category: "action",
      icon: "🔄",
      description: `${stats?.content.failedPosts ?? 0} failed`,
      action: () => doAction("retry-all-failed"),
      condition: (s) => (s?.content.failedPosts ?? 0) > 0,
      alert: (s) => (s?.content.failedPosts ?? 0) > 0,
    },
    {
      id: "approve-pending",
      label: "Approve All Pending Posts",
      category: "action",
      icon: "✅",
      action: () => doAction("approve-all-pending"),
    },
    {
      id: "trigger-autopilot",
      label: "Trigger Autopilot Generation",
      category: "action",
      icon: "🤖",
      action: () => doAction("trigger-autopilot"),
    },
    {
      id: "sync-integrations",
      label: "Sync Spellcast Integrations",
      category: "action",
      icon: "🔗",
      action: () => doAction("sync-integrations"),
    },
    {
      id: "refresh-data",
      label: "Refresh Dashboard",
      category: "action",
      icon: "⟳",
      shortcut: "R",
      action: () => { onRefresh(); setOpen(false); },
    },

    // Deploy
    {
      id: "deploy-lunary",
      label: "Deploy Lunary",
      category: "deploy",
      icon: "🚀",
      action: () => doAction("deploy", { service: "lunary" }),
    },
    {
      id: "deploy-spellcast",
      label: "Deploy Spellcast",
      category: "deploy",
      icon: "🚀",
      action: () => doAction("deploy", { service: "spellcast" }),
    },

    // Links
    { id: "link-lunary", label: "Open Lunary", category: "link", icon: "↗", action: () => { window.open("https://lunary.app", "_blank"); setOpen(false); } },
    { id: "link-spellcast", label: "Open Spellcast", category: "link", icon: "↗", action: () => { window.open("https://spellcast.sammii.dev", "_blank"); setOpen(false); } },
    { id: "link-vercel", label: "Open Vercel Dashboard", category: "link", icon: "↗", action: () => { window.open("https://vercel.com/dashboard", "_blank"); setOpen(false); } },
    { id: "link-github", label: "Open GitHub", category: "link", icon: "↗", action: () => { window.open("https://github.com/sammii-hk", "_blank"); setOpen(false); } },
    { id: "link-gsc", label: "Open Search Console", category: "link", icon: "↗", action: () => { window.open("https://search.google.com/search-console", "_blank"); setOpen(false); } },
    { id: "link-stripe", label: "Open Stripe", category: "link", icon: "↗", action: () => { window.open("https://dashboard.stripe.com", "_blank"); setOpen(false); } },
    { id: "link-notion", label: "Open Notion", category: "link", icon: "↗", action: () => { window.open("https://notion.so", "_blank"); setOpen(false); } },
  ];

  const filtered = query
    ? commands.filter((c) => {
        const q = query.toLowerCase();
        return c.label.toLowerCase().includes(q) || c.category.includes(q) || (c.description?.toLowerCase().includes(q) ?? false);
      })
    : commands.filter((c) => !c.condition || c.condition(stats));

  // Group by category
  const grouped = CATEGORY_ORDER
    .map((cat) => ({ cat, items: filtered.filter((c) => c.category === cat) }))
    .filter((g) => g.items.length > 0);

  const flatList = grouped.flatMap((g) => g.items);

  // Keyboard handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd+K to toggle
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => {
          if (!o) {
            setQuery("");
            setSelectedIdx(0);
            setResult(null);
          }
          return !o;
        });
        return;
      }

      // Escape to close
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
        return;
      }

      if (!open) return;

      // Arrow navigation
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, flatList.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (flatList[selectedIdx]) flatList[selectedIdx].action();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, flatList, selectedIdx]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          zIndex: 100,
        }}
      />
      {/* Palette */}
      <div
        style={{
          position: "fixed",
          top: "15%", left: "50%", transform: "translateX(-50%)",
          width: "min(420px, 90vw)",
          background: "rgba(12,12,18,0.98)",
          border: "1px solid var(--hb-12)",
          borderRadius: 8,
          zIndex: 101,
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
        }}
      >
        {/* Search input */}
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--hb-08)" }}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command..."
            style={{
              width: "100%",
              background: "none", border: "none", outline: "none",
              fontFamily: PS2P, fontSize: 10, color: "#fff",
              caretColor: "#c084fc",
            }}
          />
        </div>

        {/* Results */}
        <div style={{ maxHeight: 340, overflowY: "auto", padding: "6px 0" }}>
          {grouped.map(({ cat, items }) => (
            <div key={cat}>
              <div style={{
                fontFamily: PS2P, fontSize: 7,
                color: "var(--hb-25)",
                padding: "8px 14px 4px",
                letterSpacing: 1,
              }}>
                {CATEGORY_LABELS[cat]}
              </div>
              {items.map((cmd) => {
                const idx = flatList.indexOf(cmd);
                const isSelected = idx === selectedIdx;
                const isAlert = cmd.alert?.(stats);
                return (
                  <button
                    key={cmd.id}
                    onClick={() => cmd.action()}
                    onMouseEnter={() => setSelectedIdx(idx)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      width: "100%", padding: "8px 14px",
                      background: isSelected ? "var(--hb-06)" : "transparent",
                      border: "none", cursor: "pointer", textAlign: "left",
                    }}
                  >
                    <span style={{ fontSize: 14, width: 20, textAlign: "center" }}>{cmd.icon}</span>
                    <div style={{ flex: 1 }}>
                      <span style={{
                        fontFamily: PS2P, fontSize: 9,
                        color: isAlert ? "#f87171" : isSelected ? "#fff" : "var(--hb-60)",
                      }}>
                        {cmd.label}
                      </span>
                      {cmd.description && (
                        <span style={{
                          fontFamily: PS2P, fontSize: 7,
                          color: isAlert ? "#f87171" : "var(--hb-25)",
                          marginLeft: 8,
                        }}>
                          {cmd.description}
                        </span>
                      )}
                    </div>
                    {cmd.shortcut && (
                      <span style={{
                        fontFamily: PS2P, fontSize: 7,
                        color: "var(--hb-20)",
                        background: "var(--hb-05)",
                        padding: "2px 6px", borderRadius: 3,
                        border: "1px solid var(--hb-08)",
                      }}>
                        {cmd.shortcut}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {flatList.length === 0 && (
            <div style={{
              fontFamily: PS2P, fontSize: 9,
              color: "var(--hb-25)",
              textAlign: "center", padding: 20,
            }}>
              No matching commands
            </div>
          )}
        </div>

        {/* Status bar */}
        <div style={{
          padding: "8px 14px",
          borderTop: "1px solid var(--hb-06)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          {running ? (
            <span style={{ fontFamily: PS2P, fontSize: 7, color: "#facc15" }}>
              RUNNING...
            </span>
          ) : result ? (
            <span style={{ fontFamily: PS2P, fontSize: 7, color: result.ok ? "#4ade80" : "#f87171" }}>
              {result.message}
            </span>
          ) : (
            <span style={{ fontFamily: PS2P, fontSize: 7, color: "var(--hb-20)" }}>
              ↑↓ navigate · ↵ select · esc close
            </span>
          )}
          <span style={{ fontFamily: PS2P, fontSize: 7, color: "var(--hb-15)" }}>
            ⌘K
          </span>
        </div>
      </div>
    </>
  );
}
