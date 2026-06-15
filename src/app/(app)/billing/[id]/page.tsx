import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { PageHeader, Card, StatItem } from "@/components/ui/primitives";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { transitionRunAction, pushRunAction } from "../actions";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  REVIEWED: "bg-accent text-accent-foreground",
  APPROVED: "bg-warning/15 text-warning",
  PUSHED: "bg-success/15 text-success",
  PARTIALLY_FAILED: "bg-danger/15 text-danger",
  CANCELLED: "bg-muted text-muted-foreground",
};

export default async function BillingRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!can(user.role, "billing:read")) notFound();
  const { id } = await params;

  const run = await prisma.billingRun.findUnique({
    where: { id },
    include: {
      client: { include: { qboCustomer: true } },
      lines: true,
    },
  });
  if (!run) notFound();

  const qbo = run.client?.qboCustomer;
  const grandTotal = run.lines.reduce((a, l) => a + Number(l.total), 0);
  const grandCost = run.lines.reduce(
    (a, l) => a + (l.estimatedCost != null ? Number(l.estimatedCost) : 0),
    0,
  );
  const margin = grandTotal - grandCost;
  const canApprove = can(user.role, "billing:approve");
  const pushEligible = (qboItemId: string | null) => Boolean(qboItemId && qbo);

  return (
    <div>
      <PageHeader
        title={`Billing run — ${run.client?.name ?? "Unknown client"}`}
        description="Pre-push report. Review every line before pushing to QuickBooks."
        actions={
          <div className="flex items-center gap-3">
            {can(user.role, "reports:export") && (
              <a
                href={`/api/export?type=run&runId=${run.id}`}
                className="rounded-md border px-3 py-2 text-sm font-medium transition hover:bg-accent"
              >
                Export CSV
              </a>
            )}
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[run.status]}`}>
              {run.status.replaceAll("_", " ")}
            </span>
          </div>
        }
      />
      <div className="space-y-6 p-8">
        <Link href="/billing" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Billing runs
        </Link>

        {/* Run summary */}
        <Card>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            <StatItem label="Client" value={run.client?.name ?? "—"} />
            <StatItem label="Matched QBO customer" value={qbo?.displayName ?? "Not matched"} />
            <StatItem label="Invoice date" value={formatDateTime(run.invoiceDate)} />
            <StatItem label="Period" value={`${formatDateTime(run.periodStart)} – ${formatDateTime(run.periodEnd)}`} />
            <StatItem label="Lines" value={run.lines.length} />
            <StatItem label="Version" value={`v${run.version}`} />
          </div>
        </Card>

        {/* Line items */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Description</th>
                  <th className="py-2 pr-4 font-medium">Qty</th>
                  <th className="py-2 pr-4 font-medium">Unit price</th>
                  <th className="py-2 pr-4 font-medium">Proration</th>
                  <th className="py-2 pr-4 font-medium">Disc / Adj</th>
                  <th className="py-2 pr-4 font-medium">Subtotal</th>
                  <th className="py-2 pr-4 font-medium">Tax</th>
                  <th className="py-2 pr-4 font-medium">Total</th>
                  <th className="py-2 pr-4 font-medium">Push eligibility</th>
                </tr>
              </thead>
              <tbody>
                {run.lines.map((l) => {
                  const eligible = pushEligible(l.qboItemId);
                  return (
                    <tr key={l.id} className="border-t align-top">
                      <td className="py-2 pr-4">{l.description}</td>
                      <td className="py-2 pr-4 tabular-nums">{Number(l.quantity)}</td>
                      <td className="py-2 pr-4 tabular-nums">{formatCurrency(Number(l.unitPrice))}</td>
                      <td className="py-2 pr-4 tabular-nums text-muted-foreground">
                        {l.proratedDays != null && l.periodDays != null
                          ? `${l.proratedDays}/${l.periodDays} d (${Number(l.prorationFactor).toFixed(4)})`
                          : "—"}
                      </td>
                      <td className="py-2 pr-4 tabular-nums">
                        {formatCurrency(Number(l.discount))} / {formatCurrency(Number(l.adjustment))}
                      </td>
                      <td className="py-2 pr-4 tabular-nums">{formatCurrency(Number(l.subtotal))}</td>
                      <td className="py-2 pr-4">{l.taxStatus ?? "—"}</td>
                      <td className="py-2 pr-4 font-medium tabular-nums">{formatCurrency(Number(l.total))}</td>
                      <td className="py-2 pr-4">
                        {eligible ? (
                          <span className="text-success">Eligible</span>
                        ) : (
                          <span className="text-danger">
                            {qbo ? "No QBO item" : "No QBO customer"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t font-medium">
                  <td className="py-2 pr-4" colSpan={7}>
                    Grand total
                  </td>
                  <td className="py-2 pr-4 tabular-nums" colSpan={2}>
                    {formatCurrency(grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {run.lines.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No billable lines were generated. Check mappings, prices, and the
              exception queue.
            </p>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Estimated margin: {formatCurrency(margin)} (revenue {formatCurrency(grandTotal)} − est. cost {formatCurrency(grandCost)})
          </p>
        </Card>

        {/* Workflow actions */}
        {canApprove && (
          <Card className="flex flex-wrap items-center gap-3">
            {run.status === "DRAFT" && (
              <TransitionButton runId={run.id} to="REVIEWED" label="Mark reviewed" />
            )}
            {run.status === "REVIEWED" && (
              <>
                <TransitionButton runId={run.id} to="APPROVED" label="Approve" />
                <TransitionButton runId={run.id} to="DRAFT" label="Back to draft" subtle />
              </>
            )}
            {run.status === "APPROVED" && can(user.role, "billing:push") && (
              <form action={pushRunAction}>
                <input type="hidden" name="runId" value={run.id} />
                <button
                  type="submit"
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                >
                  Approve &amp; Push Selected Invoices to QuickBooks Online
                </button>
              </form>
            )}
            {run.status === "PARTIALLY_FAILED" && can(user.role, "billing:push") && (
              <form action={pushRunAction}>
                <input type="hidden" name="runId" value={run.id} />
                <button
                  type="submit"
                  className="rounded-md border border-danger/40 px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger/10"
                >
                  Retry push to QuickBooks
                </button>
              </form>
            )}
            {(run.status === "DRAFT" || run.status === "REVIEWED" || run.status === "APPROVED") && (
              <TransitionButton runId={run.id} to="CANCELLED" label="Cancel run" subtle />
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function TransitionButton({
  runId,
  to,
  label,
  subtle,
}: {
  runId: string;
  to: string;
  label: string;
  subtle?: boolean;
}) {
  return (
    <form action={transitionRunAction}>
      <input type="hidden" name="runId" value={runId} />
      <input type="hidden" name="to" value={to} />
      <button
        type="submit"
        className={
          subtle
            ? "rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-accent"
            : "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        }
      >
        {label}
      </button>
    </form>
  );
}
