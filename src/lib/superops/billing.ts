import "server-only";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { safeErrorMessage } from "@/lib/redact";
import { buildContext } from "@/connectors/runtime";
import { connectorFetch } from "@/connectors/http";
import {
  getValidAccessToken,
  qboApiBase,
  type QboEnvironment,
  type QboSecrets,
} from "@/connectors/quickbooks/oauth";

/**
 * SuperOps billing service: push an imported SuperOps invoice to QuickBooks
 * Online, and manage its review status. This is a SEPARATE pipeline from the
 * M365/TD SYNNEX BillingRun flow, but reuses the QBO connection + invoice API.
 */

export async function setSuperOpsReviewStatus(
  invoiceId: string,
  status: "PENDING" | "REVIEWED" | "SKIPPED",
  actor: { id: string; email: string },
): Promise<void> {
  await prisma.superOpsInvoice.update({
    where: { id: invoiceId },
    data: { reviewStatus: status },
  });
  await audit({
    action: "BILLING_LINE_EDITED",
    actorId: actor.id,
    actorEmail: actor.email,
    target: `superOpsInvoice:${invoiceId}`,
    metadata: { reviewStatus: status },
  });
}

export interface SuperOpsPushResult {
  ok: boolean;
  message: string;
  qboInvoiceId?: string;
}

export async function pushSuperOpsInvoiceToQbo(
  invoiceId: string,
  actor: { id: string; email: string },
): Promise<SuperOpsPushResult> {
  const invoice = await prisma.superOpsInvoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { client: { include: { qboCustomer: true } }, lines: true },
  });

  const qboCustomerId = invoice.client?.qboCustomer?.qboId;
  if (!qboCustomerId) {
    return {
      ok: false,
      message:
        "Invoice's client is not linked to a QuickBooks customer. Map the client first.",
    };
  }
  if (invoice.lines.length === 0) {
    return { ok: false, message: "Invoice has no line items to push." };
  }

  const connector = await prisma.connector.findUnique({
    where: { type: "QUICKBOOKS_ONLINE" },
  });
  if (!connector) {
    return { ok: false, message: "QuickBooks connector is not configured." };
  }
  const ctx = await buildContext(connector);
  const secrets = ctx.secrets as QboSecrets;
  const env = (ctx.config.environment as QboEnvironment) ?? "sandbox";

  // Resolve the QBO item id for each line: per-line override, else the SuperOps
  // connector's default item. Required by QBO's SalesItemLineDetail.
  const soConnector = await prisma.connector.findUnique({ where: { type: "SUPEROPS" } });
  const defaultItemId =
    ((soConnector?.config as Record<string, unknown> | null)?.defaultQboItemId as
      | string
      | undefined) ?? undefined;

  const missingItem = invoice.lines.find((l) => !l.qboItemId && !defaultItemId);
  if (missingItem) {
    return {
      ok: false,
      message:
        "No QuickBooks item to bill against. Set a 'Default QuickBooks item id' on the SuperOps connector.",
    };
  }

  try {
    const accessToken = await getValidAccessToken(secrets, (next) =>
      ctx.saveSecrets(next as Record<string, unknown>),
    );
    const payload = {
      CustomerRef: { value: qboCustomerId },
      ...(invoice.invoiceDate
        ? { TxnDate: invoice.invoiceDate.toISOString().slice(0, 10) }
        : {}),
      Line: invoice.lines.map((l) => ({
        DetailType: "SalesItemLineDetail",
        Amount: Number(l.amount),
        Description: l.description,
        SalesItemLineDetail: {
          ItemRef: { value: l.qboItemId ?? defaultItemId! },
          Qty: Number(l.quantity),
          UnitPrice: Number(l.unitPrice),
        },
      })),
      PrivateNote: `Wolf365 SuperOps invoice ${invoice.invoiceNumber ?? invoice.superOpsId}`,
    };

    const res = await connectorFetch(
      `${qboApiBase(env)}/v3/company/${secrets.realmId}/invoice?minorversion=73`,
      {
        connectorType: "QUICKBOOKS_ONLINE",
        connectorId: connector.id,
        environment: env,
        action: "push_superops_invoice",
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        correlationHeader: "intuit_tid",
      },
    );
    if (!res.ok) {
      throw new Error(`QuickBooks invoice creation failed (HTTP ${res.status})`);
    }
    const created = JSON.parse(res.body) as { Invoice?: { Id?: string } };
    const qboInvoiceId = created.Invoice?.Id ?? null;

    await prisma.superOpsInvoice.update({
      where: { id: invoiceId },
      data: {
        reviewStatus: "PUSHED",
        qboInvoiceId,
        pushedAt: new Date(),
        pushError: null,
      },
    });
    await audit({
      action: "QBO_INVOICE_PUSHED",
      actorId: actor.id,
      actorEmail: actor.email,
      target: `superOpsInvoice:${invoiceId}`,
      metadata: { qboInvoiceId, source: "superops" },
    });
    return {
      ok: true,
      qboInvoiceId: qboInvoiceId ?? undefined,
      message: `Invoice ${qboInvoiceId} created in QuickBooks.`,
    };
  } catch (err) {
    const message = safeErrorMessage(err);
    await prisma.superOpsInvoice.update({
      where: { id: invoiceId },
      data: { pushError: message },
    });
    return { ok: false, message };
  }
}
