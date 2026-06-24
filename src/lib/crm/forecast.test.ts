import { describe, it, expect } from "vitest";
import {
  computeForecast,
  computeMarginPercentage,
  type ForecastOpportunityInput,
} from "@/lib/crm/forecast";

const opp = (
  over: Partial<ForecastOpportunityInput> = {},
): ForecastOpportunityInput => ({
  line: "MANAGED_SERVICES",
  stage: "PROSPECTING",
  amount: 1000,
  marginAmount: 400,
  probability: 10,
  closeMonth: "2026-07",
  ...over,
});

describe("computeForecast", () => {
  it("separates open, won and lost; weights open pipeline by probability", () => {
    const f = computeForecast([
      opp({ stage: "PROSPECTING", amount: 1000, probability: 10 }), // open, w=100
      opp({ stage: "NEGOTIATION", amount: 2000, probability: 75 }), // open, w=1500
      opp({ stage: "CLOSED_WON", amount: 5000, marginAmount: 2000 }), // won
      opp({ stage: "CLOSED_LOST", amount: 9000 }), // lost
    ]);
    expect(f.openCount).toBe(2);
    expect(f.openAmount).toBe(3000);
    expect(f.weightedPipeline).toBeCloseTo(1600, 2);
    expect(f.wonCount).toBe(1);
    expect(f.wonAmount).toBe(5000);
    expect(f.wonMargin).toBe(2000);
    expect(f.lostCount).toBe(1);
    expect(f.winRatePct).toBe(50); // 1 won / 2 closed
  });

  it("groups by line and by close month (open only)", () => {
    const f = computeForecast([
      opp({ line: "M365", amount: 100, closeMonth: "2026-07", probability: 50 }),
      opp({ line: "M365", amount: 300, closeMonth: "2026-08", probability: 50 }),
      opp({ line: "MANAGED_NOC", amount: 500, closeMonth: "2026-07", probability: 20 }),
      opp({ line: "M365", stage: "CLOSED_WON", amount: 999, closeMonth: "2026-07" }),
    ]);
    expect(f.byLine.M365.count).toBe(3);
    expect(f.byLine.M365.amount).toBe(1399);
    expect(f.byLine.MANAGED_NOC.amount).toBe(500);
    // Months only include open deals; the won one is excluded.
    expect(f.byMonth.map((m) => m.month)).toEqual(["2026-07", "2026-08"]);
    expect(f.byMonth[0]?.amount).toBe(600); // 100 + 500
  });

  it("win rate is 0 when nothing is closed", () => {
    expect(computeForecast([opp()]).winRatePct).toBe(0);
  });

  it("handles an empty pipeline", () => {
    const f = computeForecast([]);
    expect(f.openAmount).toBe(0);
    expect(f.byMonth).toEqual([]);
    expect(f.byLine.MANAGED_SERVICES.count).toBe(0);
  });
});

describe("computeMarginPercentage", () => {
  it("is marginAmount / amount × 100", () => {
    expect(computeMarginPercentage(1000, 400)).toBe(40);
    expect(computeMarginPercentage(800, 200)).toBe(25);
  });
  it("is 0 when amount is missing/zero", () => {
    expect(computeMarginPercentage(0, 100)).toBe(0);
    expect(computeMarginPercentage(null, 100)).toBe(0);
  });
});
