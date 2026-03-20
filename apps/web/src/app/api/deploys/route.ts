import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface VercelDeployment {
  uid: string;
  name: string;
  url: string;
  state:
    | "READY"
    | "BUILDING"
    | "ERROR"
    | "QUEUED"
    | "CANCELED"
    | "INITIALIZING";
  created: number;
  ready?: number;
  meta?: {
    githubCommitMessage?: string;
    githubCommitRef?: string;
  };
}

interface Deploy {
  id: string;
  project: string;
  url: string;
  state: string;
  createdAt: string;
  commitMessage: string | null;
  branch: string | null;
  duration: number | null;
}

export async function GET(req: NextRequest) {
  const denied = checkAuth(req);
  if (denied) return denied;

  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    return NextResponse.json({ deploys: [] });
  }

  const teamSlug = process.env.VERCEL_TEAM_SLUG;

  try {
    const params = new URLSearchParams({ limit: "10" });
    if (teamSlug) {
      params.set("teamId", teamSlug);
    }

    const res = await fetch(
      `https://api.vercel.com/v6/deployments?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 60 },
      }
    );

    if (!res.ok) {
      console.error("[homebase] vercel deploys fetch failed:", res.status);
      return NextResponse.json({ deploys: [] });
    }

    const data = await res.json();
    const deployments: VercelDeployment[] = data.deployments ?? [];

    const deploys: Deploy[] = deployments
      .map((d) => ({
        id: d.uid,
        project: d.name,
        url: `https://${d.url}`,
        state: d.state ?? "QUEUED",
        createdAt: new Date(d.created).toISOString(),
        commitMessage: d.meta?.githubCommitMessage ?? null,
        branch: d.meta?.githubCommitRef ?? null,
        duration:
          d.ready && d.created ? d.ready - d.created : null,
      }))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    return NextResponse.json({ deploys });
  } catch (e) {
    console.error("[homebase] vercel deploys error:", e);
    return NextResponse.json({ deploys: [] });
  }
}
