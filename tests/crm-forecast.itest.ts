import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { forecastGrid } from "@/lib/crm/forecast";

/**
 * DB-backed proof of the CRM forecast grid: opportunities stored in the
 * database roll up into the Closed / Commit / Best Case / Open Pipeline columns
 * by close month.
 */
const TAG = "itest-crm";
const EMAIL = "itest-crm-owner@example.com";

afterAll(async () => {
  await prisma.crmOpportunity.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

describe("CRM forecast grid against a real database", () => {
  it("buckets opportunities by month and probability-driven category", async () => {
    const owner = await prisma.user.create({
      data: { email: EMAIL, name: "Forecast Owner", role: "SALES" },
    });

    const base = {
      line: "MANAGED_SERVICES" as const,
      accountName: "Acme",
      ownerId: owner.id,
      billingFrequency: "MONTHLY" as const,
      termYears: 1,
    };
    await prisma.crmOpportunity.createMany({
      data: [
        { ...base, name: `${TAG}-won`, amount: 1000, stage: "CLOSED_WON", probability: 100, closeDate: new Date("2026-07-15") },
        { ...base, name: `${TAG}-commit`, amount: 500, stage: "NEGOTIATION", probability: 99, closeDate: new Date("2026-07-20") },
        { ...base, name: `${TAG}-best`, amount: 200, stage: "PROPOSAL", probability: 80, closeDate: new Date("2026-07-25") },
        { ...base, name: `${TAG}-open`, amount: 700, stage: "PROSPECTING", probability: 20, closeDate: new Date("2026-07-28") },
      ],
    });

    const rows = await prisma.crmOpportunity.findMany({
      where: { name: { startsWith: TAG } },
    });
    const { rows: grid, total } = forecastGrid(
      rows.map((o) => ({
        line: o.line,
        stage: o.stage,
        amount: o.amount ? Number(o.amount) : 0,
        marginAmount: o.marginAmount ? Number(o.marginAmount) : 0,
        probability: o.probability,
        closeMonth: o.closeDate.toISOString().slice(0, 7),
      })),
    );

    expect(grid).toHaveLength(1);
    expect(grid[0]?.month).toBe("2026-07");
    expect(total.closedOnly).toBe(1000);
    expect(total.commit).toBe(1500); // closed + commit
    expect(total.bestCase).toBe(1700); // + best case
    expect(total.openPipeline).toBe(700);
  });
});
