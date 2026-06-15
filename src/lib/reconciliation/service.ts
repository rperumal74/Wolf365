import "server-only";
import type { ExceptionType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import {
  detectDiscrepancies,
  type AddressLike,
} from "@/lib/reconciliation/discrepancies";

/** Exception types produced by discrepancy detection (vs. billing generation). */
const DISCREPANCY_TYPES: ExceptionType[] = [
  "NAME_MISMATCH",
  "ADDRESS_MISMATCH",
  "MISSING_BILLING_EMAIL",
  "CLIENT_ONLY_IN_QBO",
  "CLIENT_ONLY_IN_TDSYNNEX",
  "ACTIVE_STATUS_MISMATCH",
  "CURRENCY_MISMATCH",
  "TAX_MISMATCH",
];

/**
 * Scan every client with at least one source record, run discrepancy detection,
 * and refresh the open discrepancy exceptions in the queue. Existing open
 * discrepancy exceptions are cleared first so resolved issues disappear and the
 * queue reflects current state (idempotent).
 */
export async function reconcileAllClients(actor: {
  id: string | null;
  email: string;
}): Promise<{ scanned: number; flagged: number }> {
  const clients = await prisma.client.findMany({
    include: { qboCustomer: true, tdSynnexCustomer: true },
  });

  let flagged = 0;

  for (const client of clients) {
    const qbo = client.qboCustomer;
    const td = client.tdSynnexCustomer;
    if (!qbo && !td) continue;

    const discrepancies = detectDiscrepancies({
      qbo: qbo
        ? {
            displayName: qbo.displayName,
            companyName: qbo.companyName,
            billingEmail: qbo.billingEmail,
            billingAddress: qbo.billingAddress as AddressLike | null,
            currency: qbo.currency,
            taxable: qbo.taxable,
            active: qbo.active,
          }
        : null,
      td: td
        ? {
            name: td.name,
            domain: td.domain,
            serviceAddress: td.serviceAddress as AddressLike | null,
            active: td.active,
          }
        : null,
    });

    await prisma.$transaction([
      prisma.exception.deleteMany({
        where: {
          clientId: client.id,
          status: "OPEN",
          type: { in: DISCREPANCY_TYPES },
        },
      }),
      prisma.exception.createMany({
        data: discrepancies.map((d) => ({
          type: d.type,
          severity: d.severity,
          clientId: client.id,
          message: d.message,
          details: {} as Prisma.InputJsonValue,
        })),
      }),
    ]);
    flagged += discrepancies.length;
  }

  await audit({
    action: "MAPPING_CHANGED",
    actorId: actor.id,
    actorEmail: actor.email,
    target: "reconciliation:run",
    metadata: { scanned: clients.length, flagged },
  });

  return { scanned: clients.length, flagged };
}
