import { describe, it, expect } from "vitest";
import { monthlyRevenue, computeMrr, computeArr } from "@/lib/billing/recurring";

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
