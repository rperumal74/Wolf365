import { describe, it, expect } from "vitest";
import {
  monthlyRevenue,
  monthlyCost,
  computeMrr,
  computeArr,
  recurringSummary,
} from "@/lib/billing/recurring";

const sub = (over: Partial<Parameters<typeof monthlyRevenue>[0]> = {}) => ({
  customerPrice: 10,
  unitCost: 8,
  quantity: 1,
  billingFrequency: "month",
  status: "Activated",
  ...over,
});

describe("recurring revenue", () => {
  it("monthly line = price * quantity", () => {
    expect(monthlyRevenue(sub({ customerPrice: 29.93, quantity: 4 }))).toBeCloseTo(119.72, 2);
  });

  it("falls back to unitCost when customerPrice is null", () => {
    expect(monthlyRevenue(sub({ customerPrice: null, unitCost: 7, quantity: 2 }))).toBe(14);
  });

  it("excludes one-time charges", () => {
    expect(monthlyRevenue(sub({ billingFrequency: "one_time", customerPrice: 264, quantity: 7 }))).toBe(0);
  });

  it("excludes inactive/expired/discontinued/cancelled", () => {
    expect(monthlyRevenue(sub({ status: "Expire" }))).toBe(0);
    expect(monthlyRevenue(sub({ status: "Discontinued" }))).toBe(0);
    expect(monthlyRevenue(sub({ status: "Cancelled" }))).toBe(0);
  });

  it("divides annually-billed lines by 12", () => {
    expect(monthlyRevenue(sub({ billingFrequency: "annual", customerPrice: 120, quantity: 1 }))).toBe(10);
  });

  it("recognizes annual billing in many forms (incl. ISO + triennial)", () => {
    for (const freq of ["Annually", "Yearly", "1 Year", "P1Y", "12 months"]) {
      expect(monthlyRevenue(sub({ billingFrequency: freq, customerPrice: 120, quantity: 1 }))).toBe(10);
    }
    // Triennial price covers 36 months.
    expect(monthlyRevenue(sub({ billingFrequency: "Triennial", customerPrice: 360, quantity: 1 }))).toBe(10);
    expect(monthlyRevenue(sub({ billingFrequency: "P3Y", customerPrice: 360, quantity: 1 }))).toBe(10);
  });

  it("treats monthly / blank / unknown billing as a monthly price", () => {
    expect(monthlyRevenue(sub({ billingFrequency: "Monthly", customerPrice: 10, quantity: 1 }))).toBe(10);
    expect(monthlyRevenue(sub({ billingFrequency: null, customerPrice: 10, quantity: 1 }))).toBe(10);
  });

  it("computeMrr sums and computeArr is 12x", () => {
    const mrr = computeMrr([
      sub({ customerPrice: 29.93, quantity: 4 }), // 119.72
      sub({ billingFrequency: "one_time", customerPrice: 264, quantity: 7 }), // 0
      sub({ status: "Expire", customerPrice: 50, quantity: 10 }), // 0
      sub({ customerPrice: 5.67, quantity: 5 }), // 28.35
    ]);
    expect(mrr).toBeCloseTo(148.07, 2);
    expect(computeArr(mrr)).toBeCloseTo(1776.84, 2);
  });
});

describe("recurring cost & margin", () => {
  it("monthlyCost uses unitCost (0 if one-time/inactive)", () => {
    expect(monthlyCost(sub({ unitCost: 8, quantity: 3 }))).toBe(24);
    expect(monthlyCost(sub({ unitCost: 8, billingFrequency: "one_time" }))).toBe(0);
    expect(monthlyCost(sub({ unitCost: 8, status: "Cancelled" }))).toBe(0);
  });

  it("recurringSummary rolls up revenue, cost, margin and active count", () => {
    const s = recurringSummary([
      sub({ customerPrice: 10, unitCost: 6, quantity: 2 }), // rev 20, cost 12
      sub({ customerPrice: 30, unitCost: 20, quantity: 1 }), // rev 30, cost 20
      sub({ billingFrequency: "one_time", customerPrice: 100, unitCost: 50 }), // excluded
      sub({ status: "Expire", customerPrice: 99, unitCost: 99 }), // excluded
    ]);
    expect(s.activeCount).toBe(2);
    expect(s.mrr).toBeCloseTo(50, 2);
    expect(s.monthlyCost).toBeCloseTo(32, 2);
    expect(s.monthlyMargin).toBeCloseTo(18, 2);
    expect(s.arr).toBeCloseTo(600, 2);
    expect(s.annualCost).toBeCloseTo(384, 2);
    expect(s.annualMargin).toBeCloseTo(216, 2);
    expect(s.marginPct).toBeCloseTo(36, 1);
  });

  it("marginPct is 0 when there is no revenue", () => {
    expect(recurringSummary([]).marginPct).toBe(0);
    expect(recurringSummary([]).activeCount).toBe(0);
  });
});
