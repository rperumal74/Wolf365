import type {
  CrmLine,
  CrmStage,
  CrmForecastCategory,
  CrmBillingFrequency,
  CrmOpportunityType,
} from "@prisma/client";

/**
 * CRM constants: line configuration, stage/category labels and default
 * probabilities. Pure data — no I/O — so pages, forms and the forecast all
 * agree on the same vocabulary.
 */

export interface LineConfig {
  /** URL slug used in /crm/<slug>. */
  slug: string;
  label: string;
  /** Whether the line may bill yearly, or monthly-only. */
  billing: "MONTHLY_ONLY" | "MONTHLY_OR_YEARLY";
  blurb: string;
}

export const CRM_LINES: Record<CrmLine, LineConfig> = {
  MANAGED_SERVICES: {
    slug: "managed-services",
    label: "Managed Services",
    billing: "MONTHLY_ONLY",
    blurb: "Prospects engaging us for managed services. Billed monthly.",
  },
  MANAGED_NOC: {
    slug: "managed-noc",
    label: "Managed NOC",
    billing: "MONTHLY_ONLY",
    blurb:
      "Prospects for our Managed Network Operations Center. Billed monthly.",
  },
  M365: {
    slug: "m365",
    label: "Microsoft 365",
    billing: "MONTHLY_OR_YEARLY",
    blurb: "New Microsoft 365 licensing prospects. Billed monthly or yearly.",
  },
};

/** Order lines appear in nav and on the forecast. */
export const CRM_LINE_ORDER: CrmLine[] = [
  "MANAGED_SERVICES",
  "MANAGED_NOC",
  "M365",
];

const SLUG_TO_LINE: Record<string, CrmLine> = Object.fromEntries(
  (Object.keys(CRM_LINES) as CrmLine[]).map((l) => [CRM_LINES[l].slug, l]),
);

/** Resolve a URL slug to a CrmLine, or null if unknown. */
export function lineFromSlug(slug: string): CrmLine | null {
  return SLUG_TO_LINE[slug] ?? null;
}

export const STAGE_LABELS: Record<CrmStage, string> = {
  PROSPECTING: "Prospecting",
  QUALIFICATION: "Qualification",
  PROPOSAL: "Proposal / Price Quote",
  NEGOTIATION: "Negotiation / Review",
  CLOSED_WON: "Closed Won",
  CLOSED_LOST: "Closed Lost",
};

/** Default win probability per stage (editable on the opportunity). */
export const STAGE_PROBABILITY: Record<CrmStage, number> = {
  PROSPECTING: 10,
  QUALIFICATION: 25,
  PROPOSAL: 50,
  NEGOTIATION: 75,
  CLOSED_WON: 100,
  CLOSED_LOST: 0,
};

/** Stages shown in pipeline/funnel order. */
export const STAGE_ORDER: CrmStage[] = [
  "PROSPECTING",
  "QUALIFICATION",
  "PROPOSAL",
  "NEGOTIATION",
  "CLOSED_WON",
  "CLOSED_LOST",
];

export const OPEN_STAGES: CrmStage[] = [
  "PROSPECTING",
  "QUALIFICATION",
  "PROPOSAL",
  "NEGOTIATION",
];

export function isOpenStage(stage: CrmStage): boolean {
  return stage !== "CLOSED_WON" && stage !== "CLOSED_LOST";
}

export const FORECAST_CATEGORY_LABELS: Record<CrmForecastCategory, string> = {
  PIPELINE: "Pipeline",
  BEST_CASE: "Best Case",
  COMMIT: "Commit",
  CLOSED: "Closed",
  OMITTED: "Omitted",
};

/** Default forecast category for a stage. */
export function defaultForecastCategory(stage: CrmStage): CrmForecastCategory {
  if (stage === "CLOSED_WON") return "CLOSED";
  if (stage === "CLOSED_LOST") return "OMITTED";
  if (stage === "NEGOTIATION") return "COMMIT";
  if (stage === "PROPOSAL") return "BEST_CASE";
  return "PIPELINE";
}

export const BILLING_FREQUENCY_LABELS: Record<CrmBillingFrequency, string> = {
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

export const OPPORTUNITY_TYPE_LABELS: Record<CrmOpportunityType, string> = {
  NEW_BUSINESS: "New Business",
  RENEWAL: "Renewal",
  UPSELL: "Upsell / Expansion",
};

export const TERM_YEARS_OPTIONS = [1, 2, 3] as const;
