import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";
import fs from "fs";
import path from "path";

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
  bookingLink?: string | null;
  coverLetterPreview?: string;
  cvHeadline?: string;
}

const CAST_GENERATED_DIR = "/Users/sammii/development/cast/cv/generated";

function companyToSlugPrefix(company: string): string {
  return company
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readGeneratedPreview(company: string): { coverLetterPreview?: string; cvHeadline?: string } {
  try {
    const slugPrefix = companyToSlugPrefix(company);
    if (!fs.existsSync(CAST_GENERATED_DIR)) return {};

    const files = fs.readdirSync(CAST_GENERATED_DIR);

    // Find cover letter file matching company slug prefix
    const clFile = files.find(
      (f) => f.startsWith(slugPrefix) && f.endsWith("-cover-letter.md")
    );
    const cvFile = files.find(
      (f) => f.startsWith(slugPrefix) && f.endsWith("-cv.md")
    );

    let coverLetterPreview: string | undefined;
    let cvHeadline: string | undefined;

    if (clFile) {
      const clContent = fs.readFileSync(path.join(CAST_GENERATED_DIR, clFile), "utf-8");
      // First 300 chars of the cover letter body
      coverLetterPreview = clContent.trim().slice(0, 300) + (clContent.trim().length > 300 ? "..." : "");
    }

    if (cvFile) {
      const cvContent = fs.readFileSync(path.join(CAST_GENERATED_DIR, cvFile), "utf-8");
      const cvLines = cvContent.split("\n");
      // Headline is the line after '# Samantha Kellow'
      for (let i = 0; i < cvLines.length; i++) {
        if (cvLines[i].startsWith("# ")) {
          for (let j = i + 1; j < Math.min(i + 5, cvLines.length); j++) {
            if (cvLines[j].trim()) {
              cvHeadline = cvLines[j].trim();
              break;
            }
          }
          break;
        }
      }
    }

    return { coverLetterPreview, cvHeadline };
  } catch {
    return {};
  }
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

const INTERVIEW_PREP_DB = "ae882a6161644c15af6f4c7fbf4ea0b8";

/** Returns a map of application page ID → booking link from the Interview Prep DB */
async function getBookingLinks(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!NOTION_TOKEN) return map;

  try {
    const res = await fetch(
      `https://api.notion.com/v1/databases/${INTERVIEW_PREP_DB}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NOTION_TOKEN}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify({ page_size: 100 }),
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      }
    );

    if (!res.ok) return map;

    const data = await res.json();
    for (const page of data.results ?? []) {
      const props = page.properties ?? {};
      const link = props["Interview Link"]?.url as string | null;
      const relations: { id: string }[] = props["Linked Application"]?.relation ?? [];
      if (link && relations.length > 0) {
        for (const rel of relations) {
          // Prefer latest booking link — last write wins if multiple prep cards
          map.set(rel.id.replace(/-/g, ""), link);
        }
      }
    }
  } catch {
    // Non-fatal — Homebase still works without booking links
  }

  return map;
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
              status: { equals: status },
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

      // Status is a Notion "status" property type, not "select"
      const statusProp = props["Status"] ?? props["status"];
      const status = (statusProp as { type: string; status?: { name: string } } | undefined)
        ?.status?.name ?? extractText(statusProp) ?? "Unknown";

      const fitScore = extractNumber(props["Fit Score"] ?? props["fit_score"] ?? props["Score"]);

      const interviewDate = extractDate(props["Interview Date"] ?? props["Interview"] ?? props["Date"]);

      const preview = readGeneratedPreview(company);

      return {
        id: page.id,
        company,
        role,
        status,
        fitScore,
        interviewDate,
        notionUrl: page.url,
        ...preview,
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

  const [jobs, bookingLinks] = await Promise.all([
    queryApplications(),
    getBookingLinks(),
  ]);

  // Attach booking links — normalize IDs to match (Notion returns with/without dashes)
  const jobsWithLinks = jobs.map((j) => ({
    ...j,
    bookingLink: bookingLinks.get(j.id.replace(/-/g, "")) ?? null,
  }));

  const pending = jobsWithLinks.filter((j) =>
    j.status === "Pending ⏳" || j.status === "To apply"
  );
  const interviews = jobsWithLinks.filter((j) => j.status === "Interview 💬");
  const assignments = jobsWithLinks.filter((j) => j.status === "Assignment given 📑");

  return NextResponse.json({
    pending,
    interviews,
    assignments,
    total: jobsWithLinks.length,
    updatedAt: new Date().toISOString(),
  });
}
