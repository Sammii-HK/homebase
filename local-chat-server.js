#!/usr/bin/env node
/**
 * Local Ops Chat Server — port 18792
 *
 * Runs `claude --print --output-format stream-json` with full Claude Code MCP access.
 * Emits AI SDK data stream format so Homebase useChat can consume it directly.
 *
 * No auth — binds to 127.0.0.1 only (localhost access only).
 */

const http = require("http");
const { spawn } = require("child_process");

const PORT = 18792;
const CLAUDE_BIN = "/Users/sammii/.local/bin/claude";
const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are an ops assistant for Sammii's personal tech stack.

You have access to MCP tools including:
- Spellcast: social media posts, approval queue, scheduling, analytics
- Lunary: astrology app metrics, grimoire content, revenue/DAU/MAU
- Notion: databases, pages, tasks, job tracker, notes
- Photos: browse macOS Photos, post to Spellcast
- Blog: personal blog CRUD

Key rules:
- Never schedule or publish posts without explicit approval — only submit for review
- Default to UK English, sentence case, no em dashes
- Be concise and action-oriented
- When checking metrics, prefer live data over estimates

When asked for a morning briefing: pull Spellcast pending review queue, show today's scheduled content, and check Lunary metrics.`;

const server = http.createServer((req, res) => {
  // Health check
  if (req.method === "GET" && (req.url === "/health" || req.url === "/")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, status: "live", port: PORT }));
    return;
  }

  // Chat endpoint
  if (
    req.method !== "POST" ||
    (req.url !== "/chat" && req.url !== "/api/chat")
  ) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    let message, history;
    try {
      const parsed = JSON.parse(body);
      message = parsed.message;
      history = parsed.history || [];
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }

    if (!message) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "message required" }));
      return;
    }

    // Build prompt with conversation history
    let prompt = "";
    if (history.length > 0) {
      prompt = history
        .map((m) => `${m.role === "user" ? "Human" : "Assistant"}: ${m.content}`)
        .join("\n\n");
      prompt += `\n\nHuman: ${message}`;
    } else {
      prompt = message;
    }

    const args = [
      "--print",
      "--output-format",
      "stream-json",
      "--model",
      MODEL,
      "--system-prompt",
      SYSTEM_PROMPT,
      prompt,
    ];

    const child = spawn(CLAUDE_BIN, args, {
      env: {
        ...process.env,
        HOME: "/Users/sammii",
      },
    });

    // AI SDK data stream headers
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "x-vercel-ai-data-stream": "v1",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
      "Access-Control-Allow-Origin": "*",
    });

    let buffer = "";
    let hasWritten = false;

    function emitWords(text) {
      const words = text.split(" ");
      for (let k = 0; k < words.length; k++) {
        const w = k < words.length - 1 ? words[k] + " " : words[k];
        res.write(`0:${JSON.stringify(w)}\n`);
      }
    }

    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);

          // stream-json --verbose: full text in type:assistant events
          if (event.type === "assistant" && Array.isArray(event.message?.content)) {
            for (const block of event.message.content) {
              if (block.type === "text" && block.text) {
                emitWords(block.text);
                hasWritten = true;
              }
            }
          }

          // content_block_delta: true streaming (future)
          if (
            event.type === "content_block_delta" &&
            event.delta?.type === "text_delta" &&
            event.delta?.text
          ) {
            res.write(`0:${JSON.stringify(event.delta.text)}\n`);
            hasWritten = true;
          }

          // result fallback
          if (event.type === "result" && event.result && !hasWritten) {
            emitWords(String(event.result));
            hasWritten = true;
          }
        } catch {
          // Not JSON — plain text line
          if (line.trim() && !line.startsWith("{")) {
            res.write(`0:${JSON.stringify(line + " ")}\n`);
            hasWritten = true;
          }
        }
      }
    });

    child.stderr.on("data", (chunk) => {
      process.stderr.write(`[ops-chat] stderr: ${chunk.toString().slice(0, 200)}`);
    });

    child.on("close", (code) => {
      // Flush remaining buffer
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer);
          if (event.type === "result" && event.result && !hasWritten) {
            emitWords(String(event.result));
          }
        } catch {}
      }

      const finishReason = code === 0 ? "stop" : "error";
      const usage = { promptTokens: 0, completionTokens: 0 };
      res.write(`e:${JSON.stringify({ finishReason, usage })}\n`);
      res.write(`d:${JSON.stringify({ finishReason, usage })}\n`);
      res.end();
    });

    child.on("error", (err) => {
      console.error(`[ops-chat] spawn error: ${err.message}`);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      } else {
        res.write(`0:${JSON.stringify(`\n\n[Error: ${err.message}]`)}\n`);
        res.end();
      }
    });

    // Handle client disconnect
    req.on("close", () => {
      if (!child.killed) child.kill();
    });
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[ops-chat] Local chat server running on http://127.0.0.1:${PORT}`);
  console.log(`[ops-chat] Using model: ${MODEL}`);
  console.log(`[ops-chat] Claude binary: ${CLAUDE_BIN}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`[ops-chat] Port ${PORT} already in use. Is the server already running?`);
  } else {
    console.error(`[ops-chat] Server error: ${err.message}`);
  }
  process.exit(1);
});
