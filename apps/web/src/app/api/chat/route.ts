import { NextRequest } from "next/server";
import { checkAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const LOCAL_CHAT_URL = "http://127.0.0.1:18792/api/chat";
const LOCAL_TIMEOUT_MS = 500;

async function isLocalServerAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LOCAL_TIMEOUT_MS);
    const res = await fetch("http://127.0.0.1:18792/health", {
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

// Extract plain text from a UIMessage (v6 SDK uses parts[], not content string)
function extractText(msg: {
  role: string;
  parts?: Array<{ type: string; text?: string }>;
  content?: unknown;
}): string {
  if (msg.parts) {
    return msg.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join("");
  }
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return (msg.content as Array<{ text?: string }>)
      .map((p) => p.text ?? "")
      .join("");
  }
  return "";
}

export async function POST(req: NextRequest) {
  const denied = checkAuth(req);
  if (denied) return denied;

  const body = await req.json();
  const { messages } = body;

  if (!messages?.length) {
    return new Response(JSON.stringify({ error: "messages required" }), {
      status: 400,
    });
  }

  const lastMessage = messages[messages.length - 1];
  const history = messages.slice(0, -1).map(
    (m: { role: string; parts?: Array<{ type: string; text?: string }>; content?: unknown }) => ({
      role: m.role,
      content: extractText(m),
    })
  );

  const chatPayload = {
    message: extractText(lastMessage),
    history,
  };

  // In dev, try local server first; fall back to Hetzner
  let chatUrl: string;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (
    process.env.NODE_ENV === "development" &&
    (await isLocalServerAvailable())
  ) {
    chatUrl = LOCAL_CHAT_URL;
  } else {
    chatUrl =
      process.env.CLAWD_CHAT_URL ?? "https://claw.sammii.dev/api/chat";
    const token = process.env.CLAWD_GATEWAY_TOKEN ?? "";
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const upstream = await fetch(chatUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(chatPayload),
  });

  if (!upstream.ok) {
    const err = await upstream.text();
    return new Response(JSON.stringify({ error: err }), {
      status: upstream.status,
    });
  }

  // Pipe the AI SDK data stream directly through
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "x-vercel-ai-data-stream": "v1",
      "Cache-Control": "no-cache",
    },
  });
}
