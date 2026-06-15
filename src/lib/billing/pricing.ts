/**
 * Price-rule resolution.
 *
 * The customer's unit price is resolved by selecting the MOST SPECIFIC active
 * rule, in this precedence order:
 *   1. CUSTOMER_SKU  (this client + this SKU)
 *   2. CUSTOMER      (this client, any SKU)
 *   3. SKU           (this SKU, any client)
 *   4. GLOBAL_MARKUP (default markup)
 *
 * A rule resolves either to a fixed unit price or to a markup applied to the
 * supplied base cost. If no rule matches (or a markup rule is used without a
 * known base cost), the price is left unresolved so the caller can raise a
 * MISSING_PRICE exception rather than silently invent a number.
 */

export type PriceRuleScope =
  | "GLOBAL_MARKUP"
  | "SKU"
  | "CUSTOMER"
  | "CUSTOMER_SKU";

export interface PriceRuleLike {
  scope: PriceRuleScope;
  clientId?: string | null;
  sku?: string | null;
  markupPct?: number | null;
  fixedUnitPrice?: number | null;
  active: boolean;
}

export interface PriceResolutionInput {
  rules: PriceRuleLike[];
  clientId: string;
  sku: string;
  /** TD SYNNEX unit cost; required for markup-based rules. */
  baseCost?: number | null;
}

export interface PriceResolution {
  unitPrice: number | null;
  source: "fixed" | "markup" | "unresolved";
  scope: PriceRuleScope | null;
}

const SCOPE_PRECEDENCE: PriceRuleScope[] = [
  "CUSTOMER_SKU",
  "CUSTOMER",
  "SKU",
  "GLOBAL_MARKUP",
];

function matches(
  rule: PriceRuleLike,
  clientId: string,
  sku: string,
): boolean {
  if (!rule.active) return false;
  switch (rule.scope) {
    case "CUSTOMER_SKU":
      return rule.clientId === clientId && rule.sku === sku;
    case "CUSTOMER":
      return rule.clientId === clientId;
    case "SKU":
      return rule.sku === sku;
    case "GLOBAL_MARKUP":
      return true;
  }
}

export function resolveUnitPrice(
  input: PriceResolutionInput,
): PriceResolution {
  for (const scope of SCOPE_PRECEDENCE) {
    const rule = input.rules.find(
      (r) => r.scope === scope && matches(r, input.clientId, input.sku),
    );
    if (!rule) continue;

    // A fixed price always wins for its rule.
    if (rule.fixedUnitPrice != null) {
      return { unitPrice: round2(rule.fixedUnitPrice), source: "fixed", scope };
    }
    // Markup requires a base cost; if absent, keep looking at less specific
    // rules that might carry a fixed price.
    if (rule.markupPct != null && input.baseCost != null) {
      const price = input.baseCost * (1 + rule.markupPct / 100);
      return { unitPrice: round2(price), source: "markup", scope };
    }
  }
  return { unitPrice: null, source: "unresolved", scope: null };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
