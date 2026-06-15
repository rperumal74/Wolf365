import { describe, it, expect } from "vitest";
import { computeLine, computeProratedLine } from "@/lib/billing/line";

const d = (s: string) => new Date(s + "T00:00:00.000Z");

describe("line math", () => {
  it("computes subtotal and total with no proration", () => {
    const r = computeLine({ quantity: 10, unitPrice: 12.5 });
    expect(r.subtotal).toBe(125);
    expect(r.total).toBe(125);
  });

  it("applies proration, discount, and adjustment", () => {
    const r = computeLine({
      quantity: 10,
      unitPrice: 12.5,
      prorationFactor: 0.5,
      discount: 5,
      adjustment: 2,
    });
    // 10 * 12.5 * 0.5 = 62.5; 62.5 - 5 + 2 = 59.5
    expect(r.subtotal).toBe(62.5);
    expect(r.total).toBe(59.5);
  });

  it("rounds to 2 decimal places", () => {
    const r = computeLine({ quantity: 3, unitPrice: 9.999, prorationFactor: 1 });
    expect(r.subtotal).toBe(30);
  });

  it("computes a fully prorated line from a period window", () => {
    const r = computeProratedLine({
      quantity: 31,
      unitPrice: 10,
      periodStart: d("2026-01-01"),
      periodEnd: d("2026-02-01"),
      activeStart: d("2026-01-16"),
    });
    expect(r.billedDays).toBe(16);
    expect(r.periodDays).toBe(31);
    // 31 * 10 * (16/31) = 160
    expect(r.subtotal).toBe(160);
  });
});
