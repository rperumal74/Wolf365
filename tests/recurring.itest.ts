import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { recurringSummary, toRecurringInput } from "@/lib/billing/recurring";

/**
 * DB-backed proof of MRR normalization: annual / triennial prices stored in
 * TD SYNNEX must be divided to a monthly figure. Mirrors the dashboard path
 * (Prisma rows → toRecurringInput → recurringSummary).
 */
const TAG = "itest-recurring";

afterAll(async () => {
  await prisma.tdSynnexSubscription.deleteMany({
    where: { stellrSubscriptionId: { startsWith: TAG } },
  });
  await prisma.tdSynnexCustomer.deleteMany({ where: { stellrId: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("MRR normalization against a real database", () => {
  it("divides annual/triennial prices to monthly; keeps monthly as-is", async () => {
    const customer = await prisma.tdSynnexCustomer.create({
      data: { stellrId: `${TAG}-cust`, name: "Integration Test Co" },
    });

    await prisma.tdSynnexSubscription.createMany({
      data: [
        // Monthly price → counts in full.
        {
          stellrSubscriptionId: `${TAG}-m`,
          customerId: customer.id,
          quantity: 2,
          customerPrice: 10, // $20/mo
          billingFrequency: "Monthly",
          status: "Active",
        },
        // Annual price in ISO form → ÷12.
        {
          stellrSubscriptionId: `${TAG}-y`,
          customerId: customer.id,
          quantity: 1,
          customerPrice: 120, // $10/mo
          billingFrequency: "P1Y",
          status: "Active",
        },
        // Triennial → ÷36.
        {
          stellrSubscriptionId: `${TAG}-t`,
          customerId: customer.id,
          quantity: 1,
          customerPrice: 360, // $10/mo
          billingFrequency: "Triennial",
          status: "Active",
        },
        // Cancelled → excluded entirely.
        {
          stellrSubscriptionId: `${TAG}-x`,
          customerId: customer.id,
          quantity: 5,
          customerPrice: 999,
          billingFrequency: "Monthly",
          status: "Cancelled",
        },
      ],
    });

    const rows = await prisma.tdSynnexSubscription.findMany({
      where: { customerId: customer.id },
    });
    const summary = recurringSummary(rows.map(toRecurringInput));

    expect(summary.activeCount).toBe(3);
    expect(summary.mrr).toBeCloseTo(40, 2); // 20 + 10 + 10
    expect(summary.arr).toBeCloseTo(480, 2);
  });
});
