import { computeProration, type ProrationInput } from "@/lib/billing/proration";

/**
 * Billing-line math. Kept pure so it can be unit-tested and reused by the
 * preview generator and the pre-push report identically.
 *
 *   subtotal = quantity * unitPrice * prorationFactor
 *   total    = subtotal - discount + adjustment
 *
 * Discounts reduce and adjustments can increase or decrease the line. All
 * monetary outputs are rounded to 2 decimal places.
 */
export interface LineInput {
  quantity: number;
  unitPrice: number;
  prorationFactor?: number;
  discount?: number;
  adjustment?: number;
}

export interface LineResult {
  subtotal: number;
  total: number;
}

export function computeLine(input: LineInput): LineResult {
  const factor = input.prorationFactor ?? 1;
  const discount = input.discount ?? 0;
  const adjustment = input.adjustment ?? 0;

  const subtotal = round2(input.quantity * input.unitPrice * factor);
  const total = round2(subtotal - discount + adjustment);
  return { subtotal, total };
}

/** Convenience: compute a fully prorated line from a billing period + window. */
export function computeProratedLine(
  input: LineInput & ProrationInput,
): LineResult & { prorationFactor: number; billedDays: number; periodDays: number } {
  const proration = computeProration(input);
  const line = computeLine({ ...input, prorationFactor: proration.factor });
  return {
    ...line,
    prorationFactor: proration.factor,
    billedDays: proration.billedDays,
    periodDays: proration.periodDays,
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
