import { describe, it, expect } from "vitest";
import {
  resolveUnitPrice,
  type PriceRuleLike,
} from "@/lib/billing/pricing";

const CLIENT = "client-1";
const SKU = "CFQ7TTC0LH16";

describe("price-rule resolution", () => {
  it("applies the global default markup to base cost", () => {
    const rules: PriceRuleLike[] = [
      { scope: "GLOBAL_MARKUP", markupPct: 20, active: true },
    ];
    const r = resolveUnitPrice({ rules, clientId: CLIENT, sku: SKU, baseCost: 10 });
    expect(r.unitPrice).toBe(12);
    expect(r.source).toBe("markup");
    expect(r.scope).toBe("GLOBAL_MARKUP");
  });

  it("prefers the most specific rule (CUSTOMER_SKU over others)", () => {
    const rules: PriceRuleLike[] = [
      { scope: "GLOBAL_MARKUP", markupPct: 20, active: true },
      { scope: "SKU", sku: SKU, markupPct: 30, active: true },
      { scope: "CUSTOMER", clientId: CLIENT, markupPct: 40, active: true },
      { scope: "CUSTOMER_SKU", clientId: CLIENT, sku: SKU, fixedUnitPrice: 99, active: true },
    ];
    const r = resolveUnitPrice({ rules, clientId: CLIENT, sku: SKU, baseCost: 10 });
    expect(r.unitPrice).toBe(99);
    expect(r.source).toBe("fixed");
    expect(r.scope).toBe("CUSTOMER_SKU");
  });

  it("ignores inactive rules", () => {
    const rules: PriceRuleLike[] = [
      { scope: "CUSTOMER_SKU", clientId: CLIENT, sku: SKU, fixedUnitPrice: 99, active: false },
      { scope: "GLOBAL_MARKUP", markupPct: 10, active: true },
    ];
    const r = resolveUnitPrice({ rules, clientId: CLIENT, sku: SKU, baseCost: 10 });
    expect(r.unitPrice).toBe(11);
    expect(r.scope).toBe("GLOBAL_MARKUP");
  });

  it("falls through a markup rule with no base cost to a less specific fixed rule", () => {
    const rules: PriceRuleLike[] = [
      { scope: "CUSTOMER", clientId: CLIENT, markupPct: 50, active: true },
      { scope: "GLOBAL_MARKUP", fixedUnitPrice: 5, active: true },
    ];
    const r = resolveUnitPrice({ rules, clientId: CLIENT, sku: SKU, baseCost: null });
    expect(r.unitPrice).toBe(5);
    expect(r.scope).toBe("GLOBAL_MARKUP");
  });

  it("returns unresolved when nothing matches", () => {
    const r = resolveUnitPrice({ rules: [], clientId: CLIENT, sku: SKU, baseCost: 10 });
    expect(r.unitPrice).toBeNull();
    expect(r.source).toBe("unresolved");
  });
});
