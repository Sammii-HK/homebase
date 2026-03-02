import { NextRequest, NextResponse } from "next/server";

interface ActivityEntry {
  cwd: string;
  tool: string;
  sessionId: string;
  ts: number;
}

// In-memory store — survives Next.js hot reloads in dev via global
const g = global as typeof globalThis & { _activityStore?: Map<string, ActivityEntry> };
if (!g._activityStore) g._activityStore = new Map<string, ActivityEntry>();
const store = g._activityStore;

const FIVE_MIN = 5 * 60 * 1000;
const HOT_MS = 10 * 1000;
const ACTIVE_MS = 30 * 1000;

const CWD_ROOM: [string, string][] = [
  ["lunary", "lunary"],
  ["spellcast", "spellcast"],
];

function cwdToRoom(cwd: string): string {
  for (const [keyword, room] of CWD_ROOM) {
    if (cwd.includes(keyword)) return room;
  }
  return "dev";
}

const TOOL_STATE: Record<string, string> = {
  Edit: "typing",
  Write: "typing",
  NotebookEdit: "typing",
  Bash: "running",
  Read: "searching",
  Glob: "searching",
  Grep: "searching",
  Task: "thinking",
  WebSearch: "thinking",
  WebFetch: "thinking",
};

function toolToState(tool: string): string {
  return TOOL_STATE[tool] ?? "active";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { session_id, cwd, tool_name } = body as {
      session_id?: string;
      cwd?: string;
      tool_name?: string;
    };

    if (!session_id || !tool_name) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }

    const now = Date.now();

    // Purge entries older than 5 min
    for (const [key, entry] of store) {
      if (now - entry.ts > FIVE_MIN) store.delete(key);
    }

    store.set(session_id, {
      cwd: cwd ?? "",
      tool: tool_name,
      sessionId: session_id,
      ts: now,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
}

export async function GET() {
  const now = Date.now();
  const recent = Array.from(store.values()).filter(
    (e) => now - e.ts < FIVE_MIN
  );

  const hotRooms = new Set<string>();
  const activeRooms = new Set<string>();
  let lastTool = "";
  let lastTs = 0;

  for (const entry of recent) {
    const room = cwdToRoom(entry.cwd);
    if (now - entry.ts < HOT_MS) hotRooms.add(room);
    if (now - entry.ts < ACTIVE_MS) activeRooms.add(room);
    if (entry.ts > lastTs) {
      lastTs = entry.ts;
      lastTool = entry.tool;
    }
  }

  return NextResponse.json({
    sessions: recent,
    activeRooms: Array.from(activeRooms),
    hotRooms: Array.from(hotRooms),
    lastTool,
    toolState: toolToState(lastTool),
  });
}
