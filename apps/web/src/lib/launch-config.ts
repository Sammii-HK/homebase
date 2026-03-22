import type { LaunchProduct } from "@/types/dashboard";

/**
 * Single source of truth for all business streams.
 * Manually maintained — forces conscious updates for 8 items.
 */
export const LAUNCH_PRODUCTS: LaunchProduct[] = [
  {
    id: "lunary",
    name: "Lunary",
    category: "saas",
    color: "#c084fc",
    url: "https://lunary.app",
    status: "live",
    milestones: [
      { label: "Core app live", done: true },
      { label: "Stripe billing", done: true },
      { label: "Birth chart engine", done: true },
      { label: "Grimoire content", done: true },
      { label: "Push notifications", done: true },
      { label: "SEO pages", done: true },
      { label: "API docs", done: false },
    ],
    nextAction: "Improve API docs SEO",
    keyMetric: { label: "MRR + MAU", source: "from lunary stats" },
    pricingNote: "£4.99/mo",
  },
  {
    id: "ios-apps",
    name: "iOS Apps",
    category: "marketplace",
    color: "#f59e0b",
    status: "building",
    milestones: [
      { label: "Daily Tarot built", done: true },
      { label: "Crystal of the Day built", done: true },
      { label: "Rune of the Day built", done: true },
      { label: "Aeris built", done: true },
      { label: "Design system", done: true },
      { label: "App Store assets", done: true },
      { label: "Compliance review", done: true },
      { label: "Submit first 3 apps", done: false },
      { label: "All 15 apps submitted", done: false },
      { label: "First app approved", done: false },
    ],
    nextAction: "Submit first 3 iOS apps to App Store",
    keyMetric: { label: "Apps built", source: "manual" },
    pricingNote: "£2.99-4.99/mo",
  },
  {
    id: "notion-templates",
    name: "Notion Templates",
    category: "marketplace",
    color: "#64748b",
    status: "building",
    milestones: [
      { label: "Design tarot journal", done: true },
      { label: "Build template", done: true },
      { label: "Gumroad listing", done: false },
      { label: "Launch post", done: false },
    ],
    nextAction: "Create Gumroad listing for tarot journal template",
    keyMetric: { label: "Sales", source: "gumroad" },
    pricingNote: "£9.99-19.99",
  },
  {
    id: "framer-templates",
    name: "Framer Templates",
    category: "marketplace",
    color: "#64748b",
    status: "not-started",
    milestones: [
      { label: "Pick niche", done: false },
      { label: "Design template", done: false },
      { label: "Framer listing", done: false },
      { label: "Launch post", done: false },
    ],
    nextAction: "Pick niche for first Framer template",
    keyMetric: { label: "Sales", source: "framer" },
    pricingNote: "£29-49",
  },
  {
    id: "dev-tools",
    name: "Dev Tools (Tailwind + Kern)",
    category: "tool",
    color: "#10b981",
    status: "building",
    milestones: [
      { label: "Tailwind Colour Creator built", done: true },
      { label: "Kern typography tool built", done: true },
      { label: "Add auth + Stripe to Tailwind tool", done: false },
      { label: "Add auth + Stripe to Kern", done: false },
      { label: "SEO landing pages", done: false },
      { label: "Launch on Product Hunt", done: false },
    ],
    nextAction: "Add Stripe to Tailwind Colour Creator (colours.sammii.dev)",
    keyMetric: { label: "Pro users", source: "manual" },
    pricingNote: "Free + £9/mo",
  },
  {
    id: "prism-components",
    name: "Prism Components",
    category: "package",
    color: "#3b82f6",
    status: "building",
    milestones: [
      { label: "Component pipeline", done: true },
      { label: "Daily generation", done: true },
      { label: "Gallery site", done: false },
      { label: "NPM package", done: false },
      { label: "Monetisation", done: false },
    ],
    nextAction: "Build gallery site for Prism components",
    keyMetric: { label: "Components", source: "manual" },
    pricingNote: "Free + premium",
  },
  {
    id: "lunary-api",
    name: "Lunary API",
    category: "saas",
    color: "#a78bfa",
    url: "https://lunary.app",
    status: "building",
    milestones: [
      { label: "Core endpoints", done: true },
      { label: "Auth + rate limiting", done: true },
      { label: "Documentation", done: false },
      { label: "Developer portal", done: false },
      { label: "Paid tier", done: false },
    ],
    nextAction: "Write API documentation",
    keyMetric: { label: "API calls", source: "from lunary stats" },
    pricingNote: "Free tier + £9.99/mo",
  },
  {
    id: "cast",
    name: "Cast Job Search",
    category: "temp",
    color: "#71717a",
    status: "live",
    milestones: [
      { label: "apply.sh script", done: true },
      { label: "Notion tracker", done: true },
      { label: "Pipeline working", done: true },
    ],
    nextAction: "Keep applying — temp revenue stream",
    keyMetric: { label: "Applications", source: "notion" },
    pricingNote: "Contract revenue",
  },
];

/** The single highest-impact next action across all products */
export function getPriorityAction(products: LaunchProduct[]): string {
  // Priority: building items closest to revenue first
  const building = products.filter((p) => p.status === "building");
  if (building.length > 0) {
    // Prefer the one with highest milestone completion %
    const sorted = building.sort((a, b) => {
      const aPct = a.milestones.filter((m) => m.done).length / a.milestones.length;
      const bPct = b.milestones.filter((m) => m.done).length / b.milestones.length;
      return bPct - aPct;
    });
    return sorted[0].nextAction;
  }
  // Fallback to first non-live, non-temp
  const next = products.find((p) => p.status !== "live" && p.category !== "temp");
  return next?.nextAction ?? "All products launched!";
}

/** Which product line is closest to generating new revenue */
export function getNextRevenue(products: LaunchProduct[]): string {
  const building = products
    .filter((p) => p.status === "building" && p.category !== "temp")
    .sort((a, b) => {
      const aPct = a.milestones.filter((m) => m.done).length / a.milestones.length;
      const bPct = b.milestones.filter((m) => m.done).length / b.milestones.length;
      return bPct - aPct;
    });
  return building[0]?.name ?? "None building";
}
