"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState, useMemo } from "react";

const PS2P = "'Press Start 2P', monospace";

const QUICK_COMMANDS = [
  "What's pending review?",
  "How's Lunary doing today?",
  "What's scheduled this week?",
  "Approve all sammii posts",
];

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function formatContent(text: string): React.ReactNode {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const trimmed = line.trimStart();
    const isBullet = /^[-*•]\s/.test(trimmed);
    const lineText = isBullet ? trimmed.replace(/^[-*•]\s/, "") : line;
    return (
      <div
        key={i}
        style={{
          marginBottom: isBullet ? 4 : 2,
          paddingLeft: isBullet ? 12 : 0,
          position: "relative",
        }}
      >
        {isBullet && (
          <span
            style={{
              position: "absolute",
              left: 0,
              color: "rgba(255,255,255,0.4)",
            }}
          >
            {">"}
          </span>
        )}
        {renderInline(lineText)}
      </div>
    );
  });
}

export default function ChatPanel({ token }: { token: string }) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: { Authorization: `Bearer ${token}` },
      }),
    [token]
  );

  const { messages, sendMessage, status, error } = useChat({ transport });

  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const submit = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput("");
    sendMessage({ text: trimmed });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "rgba(0,0,0,0.2)",
      }}
    >
      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 12px 0",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {messages.length === 0 && !isLoading && (
          <div style={{ paddingTop: 20 }}>
            <div
              style={{
                fontFamily: PS2P,
                fontSize: 8,
                color: "rgba(255,255,255,0.25)",
                textAlign: "center",
                marginBottom: 20,
              }}
            >
              OPS AGENT READY
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {QUICK_COMMANDS.map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => setInput(cmd)}
                  style={{
                    fontFamily: PS2P,
                    fontSize: 7,
                    padding: "10px 12px",
                    background: "rgba(167,139,250,0.06)",
                    border: "1px solid rgba(167,139,250,0.15)",
                    borderRadius: 6,
                    color: "rgba(255,255,255,0.5)",
                    cursor: "pointer",
                    textAlign: "left",
                    lineHeight: 1.6,
                  }}
                >
                  {cmd}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => {
          const textContent = m.parts
            .filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join("");

          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "85%",
                  padding: "10px 12px",
                  borderRadius:
                    m.role === "user"
                      ? "8px 8px 2px 8px"
                      : "8px 8px 8px 2px",
                  background:
                    m.role === "user"
                      ? "rgba(167,139,250,0.12)"
                      : "rgba(255,255,255,0.04)",
                  border:
                    m.role === "user"
                      ? "1px solid rgba(167,139,250,0.2)"
                      : "1px solid rgba(255,255,255,0.08)",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                  fontSize: 13,
                  lineHeight: 1.6,
                  color:
                    m.role === "user"
                      ? "rgba(255,255,255,0.85)"
                      : "rgba(255,255,255,0.75)",
                }}
              >
                {m.role === "assistant"
                  ? formatContent(textContent)
                  : textContent}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div
              style={{
                padding: "10px 14px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "8px 8px 8px 2px",
                display: "flex",
                gap: 4,
                alignItems: "center",
              }}
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: "rgba(167,139,250,0.6)",
                    animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div
            style={{
              fontFamily: PS2P,
              fontSize: 7,
              color: "#f87171",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 4,
              padding: "8px 10px",
            }}
          >
            {error.message}
          </div>
        )}

        <div ref={bottomRef} style={{ height: 1 }} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: "10px 12px 12px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          gap: 8,
          alignItems: "flex-end",
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything or give a command..."
          rows={1}
          style={{
            flex: 1,
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: 13,
            padding: "9px 11px",
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6,
            color: "#fff",
            resize: "none",
            outline: "none",
            maxHeight: 120,
            overflowY: "auto",
            lineHeight: 1.5,
          }}
        />
        <button
          onClick={submit}
          disabled={!input.trim() || isLoading}
          style={{
            fontFamily: PS2P,
            fontSize: 7,
            padding: "10px 12px",
            background:
              !input.trim() || isLoading
                ? "rgba(167,139,250,0.05)"
                : "rgba(167,139,250,0.15)",
            border: "1px solid rgba(167,139,250,0.2)",
            borderRadius: 6,
            color:
              !input.trim() || isLoading
                ? "rgba(167,139,250,0.3)"
                : "#a78bfa",
            cursor: !input.trim() || isLoading ? "default" : "pointer",
            minHeight: 38,
            whiteSpace: "nowrap",
          }}
        >
          SEND
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
