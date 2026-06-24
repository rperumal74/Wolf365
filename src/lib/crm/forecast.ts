import type { CrmLine, CrmStage } from "@prisma/client";
import { isOpenStage } from "./constants";

/**
 * Pure sales-forecast math. Dependency-free and unit-tested. Callers map Prisma
 * rows (Decimal money, Date) into plain numbers / ISO month keys before calling.
 */
export interface ForecastOpportunityInput {
  line: CrmLine;
  stage: CrmStage;
  amount: number;
  marginAmount: number;
  /** 0–100. */
  probability: number;
  /** Close month key "YYYY-MM" (caller derives, so this stays pure). */
  closeMonth: string;
}

export interface Bucket {
  count: number;
  amount: number;
  /** amount × probability/100, summed (open deals only). */
  weighted: number;
}

export interface ForecastSummary {
  /** Open (not closed) deals. */
  openCount: number;
  openAmount: number;
  weightedPipeline: number;
  /** Closed Won. */
  wonCount: number;
  wonAmount: number;
  wonMargin: number;
  /** Closed Lost. */
  lostCount: number;
  lostAmount: number;
  /** Won / (Won + Lost) by count, 0 when none closed. */
  winRatePct: number;
  byStage: Record<CrmStage, Bucket>;
  byLine: Record<CrmLine, Bucket>;
  /** Open pipeline by close month, ascending by key. */
  byMonth: Array<{ month: string } & Bucket>;
}

function emptyBucket(): Bucket {
  return { count: 0, amount: 0, weighted: 0 };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function add(b: Bucket, amount: number, weighted: number): void {
  b.count += 1;
  b.amount += amount;
  b.weighted += weighted;
}

function tidy(b: Bucket): Bucket {
  return { count: b.count, amount: round2(b.amount), weighted: round2(b.weighted) };
}

export function computeForecast(
  opps: ForecastOpportunityInput[],
): ForecastSummary {
  const byStage: Record<string, Bucket> = {};
  const byLine: Record<string, Bucket> = {};
  const byMonth: Record<string, Bucket> = {};

  let openCount = 0,
    openAmount = 0,
    weightedPipeline = 0,
    wonCount = 0,
    wonAmount = 0,
    wonMargin = 0,
    lostCount = 0,
    lostAmount = 0;

  for (const o of opps) {
    const amount = o.amount || 0;
    const open = isOpenStage(o.stage);
    const weighted = open ? amount * (o.probability / 100) : 0;

    add((byStage[o.stage] ??= emptyBucket()), amount, weighted);
    add((byLine[o.line] ??= emptyBucket()), amount, weighted);

    if (open) {
      openCount += 1;
      openAmount += amount;
      weightedPipeline += weighted;
      add((byMonth[o.closeMonth] ??= emptyBucket()), amount, weighted);
    } else if (o.stage === "CLOSED_WON") {
      wonCount += 1;
      wonAmount += amount;
      wonMargin += o.marginAmount || 0;
    } else if (o.stage === "CLOSED_LOST") {
      lostCount += 1;
      lostAmount += amount;
    }
  }

  const closed = wonCount + lostCount;
  const STAGES: CrmStage[] = [
    "PROSPECTING",
    "QUALIFICATION",
    "PROPOSAL",
    "NEGOTIATION",
    "CLOSED_WON",
    "CLOSED_LOST",
  ];
  const LINES: CrmLine[] = ["MANAGED_SERVICES", "MANAGED_NOC", "M365"];

  return {
    openCount,
    openAmount: round2(openAmount),
    weightedPipeline: round2(weightedPipeline),
    wonCount,
    wonAmount: round2(wonAmount),
    wonMargin: round2(wonMargin),
    lostCount,
    lostAmount: round2(lostAmount),
    winRatePct: closed > 0 ? Math.round((wonCount / closed) * 1000) / 10 : 0,
    byStage: Object.fromEntries(
      STAGES.map((s) => [s, tidy(byStage[s] ?? emptyBucket())]),
    ) as Record<CrmStage, Bucket>,
    byLine: Object.fromEntries(
      LINES.map((l) => [l, tidy(byLine[l] ?? emptyBucket())]),
    ) as Record<CrmLine, Bucket>,
    byMonth: Object.keys(byMonth)
      .sort()
      .map((month) => ({ month, ...tidy(byMonth[month] ?? emptyBucket()) })),
  };
}

/** Margin % = marginAmount / amount × 100. 0 when amount is 0/absent. */
export function computeMarginPercentage(
  amount: number | null | undefined,
  marginAmount: number | null | undefined,
): number {
  const a = amount ?? 0;
  const m = marginAmount ?? 0;
  if (a === 0) return 0;
  return Math.round((m / a) * 10000) / 100;
}
