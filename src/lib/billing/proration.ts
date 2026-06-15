/**
 * Proration calculations.
 *
 * Proration is by whole days: the fraction of the billing period during which a
 * subscription was active. All math is done in UTC day units so DST and local
 * time zones never shift a boundary. Convention: periods are half-open
 * [start, end) — `periodEnd` is the first instant NOT in the period (e.g. the
 * 1st of the next month), so a full calendar month bills at factor 1.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole days between two dates for a half-open [a, b) interval. */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfUtcDay(b).getTime() - startOfUtcDay(a).getTime()) / MS_PER_DAY);
}

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

export interface ProrationInput {
  periodStart: Date;
  periodEnd: Date;
  /** When the subscription became active (defaults to the period start). */
  activeStart?: Date | null;
  /** When the subscription ended (defaults to the period end). */
  activeEnd?: Date | null;
}

export interface ProrationResult {
  /** Total days in the billing period. */
  periodDays: number;
  /** Days within the period the subscription was active. */
  billedDays: number;
  /** billedDays / periodDays, clamped to [0, 1]. 6 dp for invoice stability. */
  factor: number;
}

export function computeProration(input: ProrationInput): ProrationResult {
  const periodDays = daysBetween(input.periodStart, input.periodEnd);

  const overlapStart =
    input.activeStart && input.activeStart > input.periodStart
      ? input.activeStart
      : input.periodStart;
  const overlapEnd =
    input.activeEnd && input.activeEnd < input.periodEnd
      ? input.activeEnd
      : input.periodEnd;

  const rawBilled = daysBetween(overlapStart, overlapEnd);
  const billedDays = Math.max(0, Math.min(rawBilled, periodDays));

  const factor =
    periodDays > 0
      ? Math.round((billedDays / periodDays) * 1_000_000) / 1_000_000
      : 0;

  return { periodDays, billedDays, factor };
}
