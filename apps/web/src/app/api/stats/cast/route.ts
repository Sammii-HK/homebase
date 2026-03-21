import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const APPLICATIONS_DB = "2a12995425f981f29b4cf046515aa81a";

const SHOW_STATUSES = new Set([
  "To apply",
  "Pending ⏳",
  "Interview 💬",
  "Assignment given 📑",
]);

interface NotionPage {
  id: string;
  url: string;
  properties: Record<string, NotionProperty>;
}

type NotionTitleProp = { type: "title"; title: { plain_text: string }[] };
type NotionRichTextProp = { type: "rich_text"; rich_text: { plain_text: string }[] };
type NotionSelectProp = { type: "select"; select: { name: string } | null };
type NotionNumberProp = { type: "number"; number: number | null };
type NotionDateProp = { type: "date"; date: { start: string } | null };
type NotionUrlProp = { type: "url"; url: string | null };
type NotionOtherProp = { type: string; [key: string]: unknown };
type NotionProperty =
  | NotionTitleProp
  | NotionRichTextProp
  | NotionSelectProp
  | NotionNumberProp
  | NotionDateProp
  | NotionUrlProp
  | NotionOtherProp;

export interface CastJob {
  id: string;
  company: string;
  role: string;
  status: string;
  fitScore: number | null;
  interviewDate: string | null;
  notionUrl: string;
}

function extractText(prop: NotionProperty | undefined): string {
  if (!prop) return "";
  if (prop.type === "title") return (prop as NotionTitleProp).title.map((t) => t.plain_text).join("");
  if (prop.type === "rich_text") return (prop as NotionRichTextProp).rich_text.map((t) => t.plain_text).join("");
  if (prop.type === "select") return (prop as NotionSelectProp).select?.name ?? "";
  if (prop.type === "url") return (prop as NotionUrlProp).url ?? "";
  return "";
}

function extractNumber(prop: NotionProperty | undefined): number | null {
  if (!prop || prop.type !== "number") return null;
  return (prop as NotionNumberProp).number;
}

function extractDate(prop: NotionProperty | undefined): string | null {
  if (!prop || prop.type !== "date") return null;
  return (prop as NotionDateProp).date?.start ?? null;
}

async function queryApplications(): Promise<CastJob[]> {
  if (!NOTION_TOKEN) return [];

  try {
    const res = await fetch(
      `https://api.notion.com/v1/databases/${APPLICATIONS_DB}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NOTION_TOKEN}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify({
          filter: {
            or: Array.from(SHOW_STATUSES).map((status) => ({
              property: "Status",
              select: { equals: status },
            })),
          },
          sorts: [{ property: "Status", direction: "ascending" }],
          page_size: 100,
        }),
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      }
    );

    if (!res.ok) {
      console.error("[cast] Notion query failed:", res.status);
      return [];
    }

    const data = await res.json();
    const pages: NotionPage[] = data.results ?? [];

    return pages.map((page) => {
      const props = page.properties;

      // Try common property name variants
      const company =
        extractText(props["Company"] ?? props["company"] ?? props["Employer"] ?? props["Organisation"]) ||
        "Unknown company";

      const role =
        extractText(props["Role"] ?? props["role"] ?? props["Job Title"] ?? props["Position"] ?? props["Title"]) ||
        "Unknown role";

      const status =
        extractText(props["Status"] ?? props["status"]) || "Unknown";

      const fitScore = extractNumber(props["Fit Score"] ?? props["fit_score"] ?? props["Score"]);

      const interviewDate = extractDate(props["Interview Date"] ?? props["Interview"] ?? props["Date"]);

      return {
        id: page.id,
        company,
        role,
        status,
        fitScore,
        interviewDate,
        notionUrl: page.url,
      };
    });
  } catch (e) {
    console.error("[cast] Notion fetch error:", e);
    return [];
  }
}

export async function GET(req: NextRequest) {
  const denied = await checkAuth(req);
  if (denied) return denied;

  const jobs = await queryApplications();

  const pending = jobs.filter((j) =>
    j.status === "Pending ⏳" || j.status === "To apply"
  );
  const interviews = jobs.filter((j) => j.status === "Interview 💬");
  const assignments = jobs.filter((j) => j.status === "Assignment given 📑");

  return NextResponse.json({
    pending,
    interviews,
    assignments,
    total: jobs.length,
    updatedAt: new Date().toISOString(),
  });
}
