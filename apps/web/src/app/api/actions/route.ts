import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Deploy hooks — Vercel project webhooks
const DEPLOY_HOOKS: Record<string, string | undefined> = {
  lunary: process.env.VERCEL_DEPLOY_HOOK_LUNARY,
  spellcast: process.env.VERCEL_DEPLOY_HOOK_SPELLCAST,
};

export async function POST(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  const apiKey = process.env.SPELLCAST_API_KEY;
  const cronSecret = process.env.SPELLCAST_CRON_SECRET;
  const url = process.env.SPELLCAST_API_URL ?? "https://api.spellcast.sammii.dev";
  const orbitUrl = process.env.ORBIT_URL ?? "http://localhost:3001";

  const body = await req.json();
  const { action, postId, service } = body as {
    action: string;
    postId?: string;
    service?: string;
  };

  const headers = {
    Authorization: `Bearer ${apiKey ?? ""}`,
    "Content-Type": "application/json",
  };

  try {
    switch (action) {
      // ── Single post actions ──

      case "retry-post": {
        if (!postId) return NextResponse.json({ error: "postId required" }, { status: 400 });
        if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });
        const res = await fetch(`${url}/api/posts/${postId}/publish`, {
          method: "POST", headers, cache: "no-store",
        });
        if (!res.ok) {
          const err = await res.text();
          return NextResponse.json({ error: `Retry failed: ${err}` }, { status: res.status });
        }
        return NextResponse.json({ ok: true, message: "Post queued for retry" });
      }

      case "approve-post": {
        if (!postId) return NextResponse.json({ error: "postId required" }, { status: 400 });
        if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });
        const res = await fetch(`${url}/api/posts/${postId}/approve`, {
          method: "POST", headers, cache: "no-store",
        });
        if (!res.ok) {
          const err = await res.text();
          return NextResponse.json({ error: `Approve failed: ${err}` }, { status: res.status });
        }
        return NextResponse.json({ ok: true, message: "Post approved" });
      }

      // ── Bulk actions ──

      case "retry-all-failed": {
        if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });
        const listRes = await fetch(`${url}/api/posts?status=failed&limit=50`, { headers, cache: "no-store" });
        if (!listRes.ok) return NextResponse.json({ error: "Failed to fetch failed posts" }, { status: 502 });
        const listData = await listRes.json();
        const posts = Array.isArray(listData) ? listData : listData.posts ?? listData.data ?? [];
        let retried = 0;
        for (const post of posts) {
          const id = post.id ?? post._id;
          if (!id) continue;
          const r = await fetch(`${url}/api/posts/${id}/publish`, { method: "POST", headers, cache: "no-store" });
          if (r.ok) retried++;
        }
        return NextResponse.json({ ok: true, message: `Retried ${retried}/${posts.length} posts` });
      }

      case "approve-all-pending": {
        if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });
        const listRes = await fetch(`${url}/api/posts?status=pending_review&limit=50`, { headers, cache: "no-store" });
        if (!listRes.ok) return NextResponse.json({ error: "Failed to fetch pending posts" }, { status: 502 });
        const listData = await listRes.json();
        const posts = Array.isArray(listData) ? listData : listData.posts ?? listData.data ?? [];
        let approved = 0;
        for (const post of posts) {
          const id = post.id ?? post._id;
          if (!id) continue;
          const r = await fetch(`${url}/api/posts/${id}/approve`, { method: "POST", headers, cache: "no-store" });
          if (r.ok) approved++;
        }
        return NextResponse.json({ ok: true, message: `Approved ${approved}/${posts.length} posts` });
      }

      // ── Spellcast operations ──

      case "trigger-autopilot": {
        if (!cronSecret) return NextResponse.json({ error: "No cron secret" }, { status: 500 });
        const res = await fetch(`${url}/api/cron/autopilot`, {
          method: "POST",
          headers: { Authorization: `Bearer ${cronSecret}`, "Content-Type": "application/json" },
          cache: "no-store",
        });
        if (!res.ok) {
          const err = await res.text();
          return NextResponse.json({ error: `Autopilot trigger failed: ${err}` }, { status: res.status });
        }
        return NextResponse.json({ ok: true, message: "Autopilot generation triggered" });
      }

      case "sync-integrations": {
        if (!cronSecret) return NextResponse.json({ error: "No cron secret" }, { status: 500 });
        const res = await fetch(`${url}/api/cron/sync`, {
          method: "POST",
          headers: { Authorization: `Bearer ${cronSecret}`, "Content-Type": "application/json" },
          cache: "no-store",
        });
        if (!res.ok) {
          const err = await res.text();
          return NextResponse.json({ error: `Sync failed: ${err}` }, { status: res.status });
        }
        return NextResponse.json({ ok: true, message: "Integration sync triggered" });
      }

      // ── Deploy ──

      case "deploy": {
        if (!service) return NextResponse.json({ error: "service required" }, { status: 400 });
        const hook = DEPLOY_HOOKS[service];
        if (!hook) return NextResponse.json({ error: `No deploy hook for ${service}. Set VERCEL_DEPLOY_HOOK_${service.toUpperCase()} env var.` }, { status: 400 });
        const res = await fetch(hook, { method: "POST", cache: "no-store" });
        if (!res.ok) {
          return NextResponse.json({ error: `Deploy trigger failed: ${res.status}` }, { status: res.status });
        }
        return NextResponse.json({ ok: true, message: `${service} deploy triggered` });
      }

      // ── Quick action panel ──

      case "approve-all": {
        // Approve pending posts with score >= 75
        if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });
        const listRes = await fetch(`${url}/api/posts?status=pending_review&limit=100`, {
          headers,
          cache: "no-store",
        });
        if (!listRes.ok) {
          return NextResponse.json({ error: "Failed to fetch pending posts" }, { status: 502 });
        }
        const listData = await listRes.json();
        const allPending: Array<{ id?: string; _id?: string; score?: number; qualityScore?: number }> =
          Array.isArray(listData) ? listData : listData.posts ?? listData.data ?? [];
        const eligible = allPending.filter(
          (p) => (p.score ?? p.qualityScore ?? 0) >= 75
        );
        let approved = 0;
        let failed = 0;
        const approveErrors: string[] = [];
        await Promise.all(
          eligible.map(async (post) => {
            const id = post.id ?? post._id;
            if (!id) return;
            try {
              const r = await fetch(`${url}/api/posts/${id}/approve`, {
                method: "POST",
                headers,
                cache: "no-store",
              });
              if (r.ok) {
                approved++;
              } else {
                failed++;
                approveErrors.push(`${id}: ${r.status}`);
              }
            } catch (e) {
              failed++;
              approveErrors.push(`${id}: ${e}`);
            }
          })
        );
        return NextResponse.json({
          ok: true,
          approved,
          failed,
          skipped: allPending.length - eligible.length,
          errors: approveErrors.length > 0 ? approveErrors : undefined,
          message: `Approved ${approved} post${approved === 1 ? "" : "s"} (score ≥75)`,
        });
      }

      case "run-briefing": {
        // Fire and forget — trigger Orbit briefing refresh
        fetch(`${orbitUrl}/api/briefing/refresh`, {
          method: "POST",
          signal: AbortSignal.timeout(3000),
        }).catch(() => {
          // Silently ignore — fire and forget
        });
        return NextResponse.json({ ok: true, message: "Briefing refresh triggered" });
      }

      case "generate-content": {
        // Fire and forget — trigger overnight content pipeline on demand
        fetch(`${orbitUrl}/api/pipeline/trigger`, {
          method: "POST",
          signal: AbortSignal.timeout(3000),
        }).catch(() => {
          // Silently ignore — fire and forget
        });
        return NextResponse.json({ ok: true, message: "Content pipeline triggered" });
      }

      case "fill-gaps": {
        // Trigger Orbit pipeline for gap fill, fall back to Spellcast autopilot
        let triggered = false;
        try {
          const orbitRes = await fetch(`${orbitUrl}/api/pipeline/trigger`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: "gap-fill" }),
            signal: AbortSignal.timeout(5000),
          });
          if (orbitRes.ok) triggered = true;
        } catch { /* try fallback */ }

        if (!triggered && cronSecret) {
          fetch(`${url}/api/cron/autopilot`, {
            method: "POST",
            headers: { Authorization: `Bearer ${cronSecret}`, "Content-Type": "application/json" },
          }).catch(() => {});
          triggered = true;
        }

        return NextResponse.json({ ok: true, message: triggered ? "Gap fill triggered" : "Generation triggered (best effort)" });
      }

      case "sync": {
        // Client re-fetches all stats — nothing to do server-side
        return NextResponse.json({ ok: true, message: "Sync acknowledged" });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (e) {
    console.error("[homebase] action failed:", e);
    return NextResponse.json({ error: "Action failed" }, { status: 502 });
  }
}
