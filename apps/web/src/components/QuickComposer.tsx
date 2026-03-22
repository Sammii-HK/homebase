"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface QuickComposerProps {
  token: string;
}

interface AccountSet {
  id: string;
  name: string;
}

type ComposerState = "idle" | "generating" | "previewing" | "sending" | "success" | "error";

const MAX_CHARS = 2000;

export default function QuickComposer({ token }: QuickComposerProps) {
  const [content, setContent] = useState("");
  const [generated, setGenerated] = useState("");
  const [state, setState] = useState<ComposerState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [accountSets, setAccountSets] = useState<AccountSet[]>([]);
  const [selectedAccountSetId, setSelectedAccountSetId] = useState<string>("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const charCount = content.length;
  const isOverMax = charCount > MAX_CHARS;
  const hasContent = content.trim().length > 0;

  const headers = useCallback((): Record<string, string> => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (token !== "cookie") h["Authorization"] = `Bearer ${token}`;
    return h;
  }, [token]);

  const autoReset = useCallback((delay = 2500) => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      setState("idle");
      setErrorMsg("");
    }, delay);
  }, []);

  // Fetch account sets on mount
  useEffect(() => {
    const fetchAccountSets = async () => {
      try {
        const h: Record<string, string> = {};
        if (token !== "cookie") h["Authorization"] = `Bearer ${token}`;
        const res = await fetch("/api/quick-draft/account-sets", { headers: h });
        if (!res.ok) return;
        const data = await res.json() as AccountSet[];
        if (Array.isArray(data) && data.length > 0) {
          setAccountSets(data);
          setSelectedAccountSetId(data[0].id);
        }
      } catch {
        // Silently fail — falls back to env var default on the server
      }
    };
    void fetchAccountSets();
  }, [token]);

  // Step 1 — generate a polished version via AI
  const generate = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed || state === "generating") return;
    setState("generating");
    setErrorMsg("");
    try {
      const res = await fetch("/api/quick-draft/generate", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          content: trimmed,
          ...(selectedAccountSetId ? { accountSetId: selectedAccountSetId } : {}),
        }),
      });
      const data = await res.json() as { result?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setGenerated(data.result ?? trimmed);
      setState("previewing");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Generation failed");
      setState("error");
      autoReset(4000);
    }
  }, [content, state, headers, autoReset, selectedAccountSetId]);

  // Step 2 — save the (generated or raw) content as a Spellcast dump
  const save = useCallback(async (text: string) => {
    if (!text.trim() || state === "sending") return;
    setState("sending");
    setErrorMsg("");
    try {
      const res = await fetch("/api/quick-draft", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          content: text.trim(),
          ...(selectedAccountSetId ? { accountSetId: selectedAccountSetId } : {}),
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setState("success");
      setContent("");
      setGenerated("");
      autoReset(2500);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to save");
      setState("error");
      autoReset(4000);
    }
  }, [state, headers, autoReset, selectedAccountSetId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      generate();
    }
  };

  const busy = state === "generating" || state === "sending";

  return (
    <div style={{ background: "#0d0d14", border: "1px solid #1a1a2e", borderRadius: 8, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Header */}
      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "var(--hb-60)", letterSpacing: 1 }}>
        QUICK DRAFT
      </div>

      {/* Account set picker */}
      {accountSets.length > 1 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {accountSets.map((set) => {
            const isSelected = set.id === selectedAccountSetId;
            return (
              <button
                key={set.id}
                onClick={() => setSelectedAccountSetId(set.id)}
                style={{
                  fontFamily: "monospace",
                  fontSize: 10,
                  padding: "3px 8px",
                  borderRadius: 20,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  background: isSelected ? "rgba(167,139,250,0.2)" : "var(--hb-04)",
                  border: isSelected ? "1px solid rgba(167,139,250,0.5)" : "1px solid var(--hb-10)",
                  color: isSelected ? "var(--hb-accent)" : "var(--hb-60)",
                }}
              >
                {set.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Brain dump textarea */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => { setContent(e.target.value); if (state === "previewing" || state === "error") { setState("idle"); setGenerated(""); } }}
        onKeyDown={handleKeyDown}
        placeholder="Brain dump an idea... (Ctrl+Enter to polish with AI)"
        maxLength={MAX_CHARS}
        rows={3}
        disabled={busy}
        style={{
          width: "100%", background: "var(--hb-03)", border: "1px solid var(--hb-08)",
          borderRadius: 6, color: busy ? "var(--hb-60)" : "var(--hb-85)",
          fontFamily: "monospace", fontSize: 12, lineHeight: 1.6, padding: "8px 10px",
          resize: "vertical", outline: "none", boxSizing: "border-box", transition: "border-color 0.15s, color 0.15s",
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(167,139,250,0.4)"; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = "var(--hb-08)"; }}
      />

      {/* AI preview panel */}
      {state === "previewing" && generated && (
        <div style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 6, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(167,139,250,0.7)", marginBottom: 2 }}>✦ AI polished</div>
          <textarea
            value={generated}
            onChange={(e) => setGenerated(e.target.value)}
            rows={4}
            style={{
              width: "100%", background: "transparent", border: "none", color: "var(--hb-90)",
              fontFamily: "monospace", fontSize: 12, lineHeight: 1.6, resize: "vertical",
              outline: "none", boxSizing: "border-box", padding: 0,
            }}
          />
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button
              onClick={() => { setState("idle"); setGenerated(""); }}
              style={{ fontFamily: "monospace", fontSize: 11, padding: "4px 10px", borderRadius: 4, border: "1px solid var(--hb-10)", background: "transparent", color: "var(--hb-60)", cursor: "pointer" }}
            >
              Discard
            </button>
            <button
              onClick={() => save(content)}
              style={{ fontFamily: "monospace", fontSize: 11, padding: "4px 10px", borderRadius: 4, border: "1px solid var(--hb-15)", background: "var(--hb-05)", color: "var(--hb-60)", cursor: "pointer" }}
            >
              Save original
            </button>
            <button
              onClick={() => save(generated)}
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, letterSpacing: 0.5, padding: "5px 10px", borderRadius: 4, border: "1px solid rgba(167,139,250,0.4)", background: "rgba(167,139,250,0.12)", color: "var(--hb-accent)", cursor: "pointer" }}
            >
              SAVE TO SPELLCAST
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontFamily: "monospace", fontSize: 11, color: state === "error" ? "#f87171" : state === "success" ? "#4ade80" : "transparent", transition: "color 0.2s", minHeight: 16, flex: 1 }}>
          {state === "success" && "Saved to Spellcast \u2713"}
          {state === "error" && (errorMsg || "Something went wrong")}
          {state === "generating" && <span style={{ color: "var(--hb-accent)" }}>Polishing...</span>}
        </div>

        <div style={{ fontFamily: "monospace", fontSize: 10, color: isOverMax ? "#f87171" : charCount > 280 ? "#fbbf24" : "var(--hb-20)", flexShrink: 0 }}>
          {charCount}/{MAX_CHARS}
        </div>

        {state !== "previewing" && (
          <button
            onClick={generate}
            disabled={busy || !hasContent || isOverMax}
            title="Polish with AI (Ctrl+Enter)"
            style={{
              fontFamily: "'Press Start 2P', monospace", fontSize: 6, letterSpacing: 0.5,
              padding: "6px 10px", borderRadius: 5, flexShrink: 0, transition: "all 0.15s",
              border: "1px solid rgba(167,139,250,0.35)",
              background: busy || !hasContent || isOverMax ? "rgba(167,139,250,0.04)" : "rgba(167,139,250,0.12)",
              color: busy || !hasContent || isOverMax ? "rgba(167,139,250,0.3)" : "var(--hb-accent)",
              cursor: busy || !hasContent || isOverMax ? "not-allowed" : "pointer",
            }}
          >
            {state === "generating" ? "..." : "✦ GENERATE"}
          </button>
        )}
      </div>
    </div>
  );
}
