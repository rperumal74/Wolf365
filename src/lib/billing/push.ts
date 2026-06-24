import "server-only";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { safeErrorMessage } from "@/lib/redact";
import { assertTransition } from "@/lib/billing/state";
import { buildContext } from "@/connectors/runtime";
import { connectorFetch } from "@/connectors/http";
import {
  getValidAccessToken,
  qboApiBase,
  type QboEnvironment,
  type QboSecrets,
} from "@/connectors/quickbooks/oauth";
import { getQboEndpoints } from "@/connectors/quickbooks/discovery";

/**
 * Push an approved billing run to QuickBooks Online as a single invoice for the
 * client. Only lines with a mapped QBO item are included; if any line is
 * ineligible the run is marked PARTIALLY_FAILED so nothing is silently dropped.
 *
 * Invoices are NEVER pushed unless the run is APPROVED and a human triggered it.
 */
export interface PushResult {
  ok: boolean;
  qboInvoiceId?: string;
  pushedLines: number;
  skippedLines: number;
  message: string;
}

export async function pushBillingRunToQbo(
  runId: string,
  actor: { id: string; email: string },
): Promise<PushResult> {
  const run = await prisma.billingRun.findUniqueOrThrow({
    where: { id: runId },
    include: { client: { include: { qboCustomer: true } }, lines: true },
  });

  // Push from APPROVED (first attempt) or PARTIALLY_FAILED (retry).
  if (run.status !== "APPROVED" && run.status !== "PARTIALLY_FAILED") {
    throw new Error(`Run must be APPROVED to push (current: ${run.status})`);
  }
  const fromStatus = run.status;
  const qboCustomerId = run.client?.qboCustomer?.qboId;
  if (!qboCustomerId) {
    throw new Error("Client has no linked QuickBooks customer; cannot push.");
  }

  const eligible = run.lines.filter((l) => l.qboItemId);
  const skipped = run.lines.length - eligible.length;
  if (eligible.length === 0) {
    throw new Error("No lines have a mapped QuickBooks item; nothing to push.");
  }

  const connector = await prisma.connector.findUniqueOrThrow({
    where: { type: "QUICKBOOKS_ONLINE" },
  });
  const ctx = await buildContext(connector);
  const secrets = ctx.secrets as QboSecrets;
  const env = (ctx.config.environment as QboEnvironment) ?? "sandbox";
  const { tokenEndpoint } = await getQboEndpoints(env);

  const accessToken = await getValidAccessToken(
    secrets,
    (next) => ctx.saveSecrets(next as Record<string, unknown>),
    tokenEndpoint,
  );

  // Build the QBO invoice payload from eligible lines.
  const invoicePayload = {
    CustomerRef: { value: qboCustomerId },
    TxnDate: run.invoiceDate.toISOString().slice(0, 10),
    Line: eligible.map((l) => ({
      DetailType: "SalesItemLineDetail",
      Amount: Number(l.total),
      Description: l.description,
      SalesItemLineDetail: {
        ItemRef: { value: l.qboItemId! },
        Qty: Number(l.quantity),
        UnitPrice: Number(l.unitPrice),
      },
    })),
    PrivateNote: `Wolf365 billing run ${run.id} (period ${run.periodStart
      .toISOString()
      .slice(0, 10)} – ${run.periodEnd.toISOString().slice(0, 10)})`,
  };

  try {
    const res = await connectorFetch(
      `${qboApiBase(env)}/v3/company/${secrets.realmId}/invoice?minorversion=73`,
      {
        connectorType: "QUICKBOOKS_ONLINE",
        connectorId: connector.id,
        environment: env,
        action: "push_invoice",
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(invoicePayload),
        correlationHeader: "intuit_tid",
      },
    );
    if (!res.ok) {
      throw new Error(`QuickBooks invoice creation failed (HTTP ${res.status})`);
    }
    const created = JSON.parse(res.body) as { Invoice?: { Id?: string } };
    const invoiceId = created.Invoice?.Id ?? null;

    const finalStatus = skipped > 0 ? "PARTIALLY_FAILED" : "PUSHED";
    if (fromStatus !== finalStatus) assertTransition(fromStatus, finalStatus);

    await prisma.$transaction([
      prisma.billingRun.update({
        where: { id: runId },
        data: {
          status: finalStatus,
          pushedAt: new Date(),
          qboInvoiceId: invoiceId,
          pushError:
            skipped > 0
              ? `${skipped} line(s) skipped (no mapped QuickBooks item)`
              : null,
        },
      }),
      prisma.billingLine.updateMany({
        where: { billingRunId: runId, qboItemId: { not: null } },
        data: { qboInvoiceId: invoiceId },
      }),
    ]);

    await audit({
      action: "QBO_INVOICE_PUSHED",
      actorId: actor.id,
      actorEmail: actor.email,
      target: `billingRun:${runId}`,
      metadata: { qboInvoiceId: invoiceId, pushedLines: eligible.length, skipped },
    });

    return {
      ok: true,
      qboInvoiceId: invoiceId ?? undefined,
      pushedLines: eligible.length,
      skippedLines: skipped,
      message:
        skipped > 0
          ? `Invoice ${invoiceId} created; ${skipped} line(s) skipped.`
          : `Invoice ${invoiceId} created in QuickBooks.`,
    };
  } catch (err) {
    const message = safeErrorMessage(err);
    await prisma.billingRun.update({
      where: { id: runId },
      data: { status: "PARTIALLY_FAILED", pushError: message },
    });
    await audit({
      action: "QBO_INVOICE_PUSHED",
      actorId: actor.id,
      actorEmail: actor.email,
      target: `billingRun:${runId}`,
      metadata: { error: message },
    });
    return {
      ok: false,
      pushedLines: 0,
      skippedLines: skipped,
      message,
    };
  }
}
