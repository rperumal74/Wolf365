import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { toCsv, type CsvColumn } from "@/lib/reports/csv";
import {
  getMarginReport,
  getRevenueLeakage,
  getOverbillingRisk,
} from "@/lib/reports/queries";

export const dynamic = "force-dynamic";

/**
 * CSV/Excel export endpoint. Supports report exports and billing-run /
 * exception exports. RBAC-gated and audited; never includes secrets.
 *   /api/export?type=margin|leakage|overbilling|exceptions|run&runId=...
 */
export async function GET(request: Request) {
  const user = await requirePermission("reports:export");
  const type = new URL(request.url).searchParams.get("type") ?? "";
  const runId = new URL(request.url).searchParams.get("runId") ?? "";

  let csv: string;
  let filename: string;

  switch (type) {
    case "margin": {
      const rows = await getMarginReport();
      csv = toCsv<(typeof rows)[number]>(rows, [
        { header: "Client", value: (r) => r.client },
        { header: "Description", value: (r) => r.description },
        { header: "Revenue", value: (r) => r.revenue },
        { header: "Estimated Cost", value: (r) => r.estimatedCost },
        { header: "Margin", value: (r) => r.margin },
        { header: "Margin %", value: (r) => r.marginPct },
      ]);
      filename = "margin-report.csv";
      break;
    }
    case "leakage": {
      const rows = await getRevenueLeakage();
      csv = toCsv<(typeof rows)[number]>(rows, [
        { header: "Client", value: (r) => r.client },
        { header: "SKU", value: (r) => r.sku },
        { header: "Product", value: (r) => r.product },
        { header: "Quantity", value: (r) => r.quantity },
        { header: "Estimated Monthly Cost", value: (r) => r.estimatedMonthlyCost },
      ]);
      filename = "revenue-leakage.csv";
      break;
    }
    case "overbilling": {
      const rows = await getOverbillingRisk();
      csv = toCsv<(typeof rows)[number]>(rows, [
        { header: "Client", value: (r) => r.client },
        { header: "Description", value: (r) => r.description },
        { header: "Total", value: (r) => r.total },
        { header: "Reason", value: (r) => r.reason },
      ]);
      filename = "overbilling-risk.csv";
      break;
    }
    case "exceptions": {
      const rows = await prisma.exception.findMany({
        where: { status: { not: "RESOLVED" } },
        include: { client: true },
        orderBy: { createdAt: "desc" },
      });
      const cols: CsvColumn<(typeof rows)[number]>[] = [
        { header: "Type", value: (r) => r.type },
        { header: "Severity", value: (r) => r.severity },
        { header: "Client", value: (r) => r.client?.name ?? "" },
        { header: "Message", value: (r) => r.message },
        { header: "Created", value: (r) => r.createdAt.toISOString() },
      ];
      csv = toCsv(rows, cols);
      filename = "exceptions.csv";
      break;
    }
    case "run": {
      const run = await prisma.billingRun.findUnique({
        where: { id: runId },
        include: { client: true, lines: true },
      });
      if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
      const cols: CsvColumn<(typeof run.lines)[number]>[] = [
        { header: "Description", value: (l) => l.description },
        { header: "Quantity", value: (l) => Number(l.quantity) },
        { header: "Unit Price", value: (l) => Number(l.unitPrice) },
        { header: "Proration", value: (l) => Number(l.prorationFactor) },
        { header: "Discount", value: (l) => Number(l.discount) },
        { header: "Adjustment", value: (l) => Number(l.adjustment) },
        { header: "Subtotal", value: (l) => Number(l.subtotal) },
        { header: "Total", value: (l) => Number(l.total) },
        { header: "QBO Item", value: (l) => l.qboItemId ?? "" },
      ];
      csv = toCsv(run.lines, cols);
      filename = `billing-run-${runId}.csv`;
      break;
    }
    default:
      return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
  }

  await audit({
    action: "EXPORT",
    actorId: user.id,
    actorEmail: user.email,
    target: `export:${type}`,
    metadata: runId ? { runId } : undefined,
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
