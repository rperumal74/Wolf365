import { describe, it, expect } from "vitest";
import { computeProration, daysBetween } from "@/lib/billing/proration";

const d = (s: string) => new Date(s + "T00:00:00.000Z");

describe("proration", () => {
  it("counts whole days for a half-open interval", () => {
    expect(daysBetween(d("2026-01-01"), d("2026-02-01"))).toBe(31);
    expect(daysBetween(d("2026-02-01"), d("2026-03-01"))).toBe(28);
  });

  it("bills a full month at factor 1 when active throughout", () => {
    const r = computeProration({
      periodStart: d("2026-01-01"),
      periodEnd: d("2026-02-01"),
    });
    expect(r.periodDays).toBe(31);
    expect(r.billedDays).toBe(31);
    expect(r.factor).toBe(1);
  });

  it("prorates a mid-period activation", () => {
    // Active from the 16th of a 31-day month => 16 days billed (16..31).
    const r = computeProration({
      periodStart: d("2026-01-01"),
      periodEnd: d("2026-02-01"),
      activeStart: d("2026-01-16"),
    });
    expect(r.billedDays).toBe(16);
    expect(r.factor).toBeCloseTo(16 / 31, 6);
  });

  it("prorates a mid-period cancellation", () => {
    const r = computeProration({
      periodStart: d("2026-01-01"),
      periodEnd: d("2026-02-01"),
      activeEnd: d("2026-01-11"),
    });
    expect(r.billedDays).toBe(10);
    expect(r.factor).toBeCloseTo(10 / 31, 6);
  });

  it("clamps to zero when active window is outside the period", () => {
    const r = computeProration({
      periodStart: d("2026-01-01"),
      periodEnd: d("2026-02-01"),
      activeStart: d("2026-03-01"),
      activeEnd: d("2026-03-15"),
    });
    expect(r.billedDays).toBe(0);
    expect(r.factor).toBe(0);
  });

  it("never exceeds factor 1 when active window spans beyond the period", () => {
    const r = computeProration({
      periodStart: d("2026-01-01"),
      periodEnd: d("2026-02-01"),
      activeStart: d("2025-06-01"),
      activeEnd: d("2026-12-31"),
    });
    expect(r.factor).toBe(1);
  });
});
