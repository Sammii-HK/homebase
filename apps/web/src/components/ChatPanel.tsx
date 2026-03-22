"use client";

import { authHeaders } from "@/lib/client-auth";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";

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
              color: "var(--hb-40)",
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

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export default function ChatPanel({ token }: { token: string }) {
  const [input, setInput] = useState("");
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | undefined>(undefined);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSpokenIdRef = useRef<string | null>(null);

  useEffect(() => {
    setSpeechSupported(!!getSpeechRecognition());
    const saved = localStorage.getItem("hb_tts");
    if (saved === "false") setTtsEnabled(false);
    // Load history from server
    fetch("/api/chat/history", { headers: authHeaders(token) })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setInitialMessages(data as UIMessage[]);
      })
      .catch(() => {})
      .finally(() => setHistoryLoaded(true));
  }, [token]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: authHeaders(token ?? ""),
      }),
    [token]
  );

  const { messages, sendMessage, status, error } = useChat({
    transport,
    messages: initialMessages,
  });

  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    // Persist to server after streaming completes
    if (messages.length > 0 && !isLoading) {
      fetch("/api/chat/history", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify(messages),
      }).catch(() => {});
    }
  }, [messages, isLoading, token]);

  // Speak last assistant message via Kokoro TTS
  const speak = useCallback(
    async (text: string) => {
      if (!ttsEnabled || !text.trim()) return;
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(token ?? ""),
          },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) return;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (audioRef.current) {
          audioRef.current.pause();
          URL.revokeObjectURL(audioRef.current.src);
        }
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.play().catch(() => {});
        audio.onended = () => URL.revokeObjectURL(url);
      } catch {
        // TTS unavailable, silently skip
      }
    },
    [ttsEnabled, token]
  );

  // Speak completed assistant messages
  useEffect(() => {
    if (isLoading) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    if (last.id === lastSpokenIdRef.current) return;
    lastSpokenIdRef.current = last.id;
    const text = last.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("");
    speak(text);
  }, [messages, isLoading, speak]);

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

  const toggleMic = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SR = getSpeechRecognition();
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0]?.[0]?.transcript ?? "";
      if (transcript.trim()) {
        setInput(transcript.trim());
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const toggleTts = () => {
    const next = !ttsEnabled;
    setTtsEnabled(next);
    localStorage.setItem("hb_tts", String(next));
    if (!next && audioRef.current) {
      audioRef.current.pause();
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
      {/* TTS toggle */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          padding: "6px 12px 0",
          gap: 6,
        }}
      >
        <button
          onClick={() => {
            fetch("/api/chat/history", {
              method: "POST",
              headers: { "Content-Type": "application/json", ...authHeaders(token) },
              body: JSON.stringify([]),
            }).finally(() => window.location.reload());
          }}
          title="Clear chat history"
          style={{
            fontFamily: PS2P,
            fontSize: 7,
            padding: "4px 8px",
            background: "var(--hb-04)",
            border: "1px solid var(--hb-08)",
            borderRadius: 4,
            color: "var(--hb-30)",
            cursor: "pointer",
          }}
        >
          CLEAR
        </button>
        <button
          onClick={toggleTts}
          title={ttsEnabled ? "Mute voice" : "Unmute voice"}
          style={{
            fontFamily: PS2P,
            fontSize: 7,
            padding: "4px 8px",
            background: ttsEnabled
              ? "rgba(167,139,250,0.1)"
              : "var(--hb-04)",
            border: `1px solid ${ttsEnabled ? "rgba(167,139,250,0.2)" : "var(--hb-08)"}`,
            borderRadius: 4,
            color: ttsEnabled ? "#a78bfa" : "var(--hb-30)",
            cursor: "pointer",
          }}
        >
          {ttsEnabled ? "VOICE ON" : "VOICE OFF"}
        </button>
      </div>

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
        {messages.length === 0 && !isLoading && historyLoaded && (
          <div style={{ paddingTop: 20 }}>
            <div
              style={{
                fontFamily: PS2P,
                fontSize: 9,
                color: "var(--hb-25)",
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
                    fontSize: 8,
                    padding: "11px 14px",
                    background: "rgba(167,139,250,0.06)",
                    border: "1px solid rgba(167,139,250,0.15)",
                    borderRadius: 6,
                    color: "var(--hb-50)",
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
                  padding: "14px 12px",
                  borderRadius:
                    m.role === "user"
                      ? "8px 8px 2px 8px"
                      : "8px 8px 8px 2px",
                  background:
                    m.role === "user"
                      ? "rgba(167,139,250,0.12)"
                      : "var(--hb-04)",
                  border:
                    m.role === "user"
                      ? "1px solid rgba(167,139,250,0.2)"
                      : "1px solid var(--hb-08)",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                  fontSize: 15,
                  lineHeight: 1.6,
                  color:
                    m.role === "user"
                      ? "var(--hb-85)"
                      : "var(--hb-75)",
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
                background: "var(--hb-04)",
                border: "1px solid var(--hb-08)",
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
          borderTop: "1px solid var(--hb-06)",
          display: "flex",
          gap: 8,
          alignItems: "flex-end",
        }}
      >
        {speechSupported && (
          <button
            onClick={toggleMic}
            title={isListening ? "Stop listening" : "Speak"}
            style={{
              fontFamily: PS2P,
              fontSize: 16,
              padding: "8px 10px",
              background: isListening
                ? "rgba(239,68,68,0.15)"
                : "var(--hb-04)",
              border: `1px solid ${isListening ? "rgba(239,68,68,0.4)" : "var(--hb-10)"}`,
              borderRadius: 6,
              color: isListening ? "#f87171" : "var(--hb-40)",
              cursor: "pointer",
              minHeight: 38,
              animation: isListening ? "micPulse 1s ease-in-out infinite" : "none",
            }}
          >
            🎙
          </button>
        )}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isListening ? "Listening..." : "Ask anything or give a command..."
          }
          rows={1}
          style={{
            flex: 1,
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: 15,
            padding: "11px 13px",
            background: "rgba(0,0,0,0.4)",
            border: `1px solid ${isListening ? "rgba(239,68,68,0.3)" : "var(--hb-10)"}`,
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
            fontSize: 8,
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
        @keyframes micPulse {
          0%, 100% { border-color: rgba(239,68,68,0.4); }
          50% { border-color: rgba(239,68,68,0.8); }
        }
      `}</style>
    </div>
  );
}
