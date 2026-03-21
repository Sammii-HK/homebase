"use client";

import { useState, useRef, useCallback } from "react";

interface QuickComposerProps {
  token: string;
}

type ComposerState = "idle" | "sending" | "success" | "error";

const MAX_CHARS = 2000;
const WARN_CHARS = 280;

export default function QuickComposer({ token }: QuickComposerProps) {
  const [content, setContent] = useState("");
  const [state, setState] = useState<ComposerState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const charCount = content.length;
  const isOverWarn = charCount > WARN_CHARS;
  const isOverMax = charCount > MAX_CHARS;

  const submit = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed || state === "sending") return;

    setState("sending");
    setErrorMsg("");

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token !== "cookie") {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/quick-draft", {
        method: "POST",
        headers,
        body: JSON.stringify({ content: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      setState("success");
      setContent("");

      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => setState("idle"), 2000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setErrorMsg(msg);
      setState("error");

      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        setState("idle");
        setErrorMsg("");
      }, 4000);
    }
  }, [content, state, token]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  const isSending = state === "sending";
  const isSuccess = state === "success";
  const isError = state === "error";

  return (
    <div
      style={{
        background: "#0d0d14",
        border: "1px solid #1a1a2e",
        borderRadius: 8,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* Header */}
      <div
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 7,
          color: "rgba(255,255,255,0.35)",
          letterSpacing: 1,
        }}
      >
        QUICK DRAFT
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Write a post idea... (Ctrl+Enter to send)"
        maxLength={MAX_CHARS}
        rows={4}
        disabled={isSending}
        style={{
          width: "100%",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 6,
          color: isSending ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.85)",
          fontFamily: "monospace",
          fontSize: 12,
          lineHeight: 1.6,
          padding: "8px 10px",
          resize: "vertical",
          outline: "none",
          boxSizing: "border-box",
          transition: "border-color 0.15s, color 0.15s",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "rgba(167,139,250,0.4)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
        }}
      />

      {/* Footer row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        {/* Status / error message */}
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 11,
            color: isError
              ? "#f87171"
              : isSuccess
              ? "#4ade80"
              : "transparent",
            transition: "color 0.2s",
            minHeight: 16,
            flex: 1,
          }}
        >
          {isSuccess && "Saved as draft \u2713"}
          {isError && (errorMsg || "Failed to save")}
        </div>

        {/* Character count */}
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            color: isOverWarn
              ? isOverMax
                ? "#f87171"
                : "#fbbf24"
              : "rgba(255,255,255,0.25)",
            flexShrink: 0,
            transition: "color 0.15s",
          }}
        >
          {charCount}/{MAX_CHARS}
        </div>

        {/* Send button */}
        <button
          onClick={submit}
          disabled={isSending || !content.trim() || isOverMax}
          title="Send to Spellcast (Ctrl+Enter)"
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 6,
            letterSpacing: 0.5,
            padding: "6px 10px",
            borderRadius: 5,
            border: "1px solid rgba(167,139,250,0.35)",
            background:
              isSending || !content.trim() || isOverMax
                ? "rgba(167,139,250,0.04)"
                : "rgba(167,139,250,0.12)",
            color:
              isSending || !content.trim() || isOverMax
                ? "rgba(167,139,250,0.3)"
                : "#a78bfa",
            cursor:
              isSending || !content.trim() || isOverMax
                ? "not-allowed"
                : "pointer",
            flexShrink: 0,
            transition: "all 0.15s",
          }}
        >
          {isSending ? "SENDING..." : "SEND TO SPELLCAST"}
        </button>
      </div>
    </div>
  );
}
