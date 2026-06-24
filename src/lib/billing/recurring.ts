/**
 * Recurring-revenue math for the dashboard.
 *
 * MRR = sum of each subscription's monthly recurring revenue, using the
 * customer price × quantity. One-time charges and inactive/expired/cancelled
 * subscriptions are excluded; annually-billed lines are divided by 12 so they
 * contribute their monthly share. ARR is MRR × 12. Pure + unit-tested.
 */
export interface RecurringSubscriptionInput {
  /** Vendor-suggested customer price (revenue). Falls back to unitCost. */
  customerPrice: number | null;
  unitCost: number | null;
  quantity: number;
  billingFrequency: string | null;
  status: string | null;
}

const INACTIVE = /expire|cancel|inactiv|suspend|discontinu/i;

/** Monthly recurring revenue for one subscription (0 if one-time/inactive). */
export function monthlyRevenue(sub: RecurringSubscriptionInput): number {
  if (sub.status && INACTIVE.test(sub.status)) return 0;
  const freq = (sub.billingFrequency ?? "").toLowerCase();
  if (freq.includes("one")) return 0; // one_time → not recurring
  const unit = sub.customerPrice ?? sub.unitCost ?? 0;
  const line = unit * sub.quantity;
  // Annually-billed line → monthly share. Monthly/unknown → counted as-is.
  if (freq.includes("ann") || freq.includes("year")) return line / 12;
  return line;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeMrr(subs: RecurringSubscriptionInput[]): number {
  return round2(subs.reduce((acc, s) => acc + monthlyRevenue(s), 0));
}

export function computeArr(mrr: number): number {
  return round2(mrr * 12);
}
