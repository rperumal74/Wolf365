import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { PageHeader, Card, StatItem } from "@/components/ui/primitives";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  detectDiscrepancies,
  type AddressLike,
  type Discrepancy,
} from "@/lib/reconciliation/discrepancies";

const SEVERITY_STYLES: Record<Discrepancy["severity"], string> = {
  error: "border-danger/40 bg-danger/10 text-danger",
  warning: "border-warning/40 bg-warning/10 text-warning",
  info: "border-border bg-muted text-muted-foreground",
};

function formatAddress(addr: unknown): string {
  if (!addr || typeof addr !== "object") return "—";
  const a = addr as AddressLike;
  const parts = [
    a.Line1 ?? a.line1,
    a.City ?? a.city,
    a.CountrySubDivisionCode ?? a.region,
    a.PostalCode ?? a.postalCode,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

export default async function ClientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("clients:read");
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      qboCustomer: true,
      tdSynnexCustomer: { include: { subscriptions: true } },
      huduMatch: true,
      superOpsMatch: true,
    },
  });
  if (!client) notFound();

  const qbo = client.qboCustomer;
  const td = client.tdSynnexCustomer;

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

  return (
    <div>
      <PageHeader
        title={client.name}
        description={client.active ? "Active client" : "Inactive client"}
        actions={
          <Link
            href={`/billing/new?clientId=${client.id}`}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Generate billing run
          </Link>
        }
      />
      <div className="space-y-6 p-8">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All clients
        </Link>

        {/* Discrepancies */}
        {discrepancies.length > 0 && (
          <div className="space-y-2">
            {discrepancies.map((dz, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${SEVERITY_STYLES[dz.severity]}`}
              >
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{dz.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Side-by-side comparison */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="mb-3 text-sm font-semibold">QuickBooks Online</h2>
            {qbo ? (
              <div className="grid grid-cols-2 gap-3">
                <StatItem label="QBO Customer ID" value={qbo.qboId} />
                <StatItem label="Display name" value={qbo.displayName} />
                <StatItem label="Company" value={qbo.companyName ?? "—"} />
                <StatItem label="Billing email" value={qbo.billingEmail ?? "—"} />
                <StatItem label="Billing address" value={formatAddress(qbo.billingAddress)} />
                <StatItem label="Currency" value={qbo.currency ?? "—"} />
                <StatItem label="Payment terms" value={qbo.paymentTerms ?? "—"} />
                <StatItem label="Tax status" value={qbo.taxStatus ?? (qbo.taxable == null ? "Unknown" : qbo.taxable ? "Taxable" : "Non-taxable")} />
                <StatItem label="Status" value={qbo.active ? "Active" : "Inactive"} />
                <StatItem label="Last QBO sync" value={formatDateTime(qbo.lastSyncedAt)} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No linked QuickBooks customer.</p>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold">TD SYNNEX StreamOne</h2>
            {td ? (
              <div className="grid grid-cols-2 gap-3">
                <StatItem label="StreamOne ID" value={td.stellrId} />
                <StatItem label="Name" value={td.name} />
                <StatItem label="Domain" value={td.domain ?? "—"} />
                <StatItem label="MS tenant ID" value={td.microsoftTenantId ?? "—"} />
                <StatItem label="Service address" value={formatAddress(td.serviceAddress)} />
                <StatItem label="Subscriptions" value={td.subscriptions.length} />
                <StatItem label="Status" value={td.active ? "Active" : "Inactive"} />
                <StatItem label="Last TD SYNNEX sync" value={formatDateTime(td.lastSyncedAt)} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No linked TD SYNNEX customer.</p>
            )}
          </Card>
        </div>

        {/* Mapping boxes */}
        {(client.huduMatch || client.superOpsMatch) && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {client.huduMatch && (
              <Card>
                <h2 className="mb-2 text-sm font-semibold">Hudu</h2>
                <StatItem label="Company" value={client.huduMatch.name} />
              </Card>
            )}
            {client.superOpsMatch && (
              <Card>
                <h2 className="mb-2 text-sm font-semibold">SuperOps</h2>
                <StatItem label="Client" value={client.superOpsMatch.name} />
              </Card>
            )}
          </div>
        )}

        {/* Licensing / subscriptions — always shown when a TD SYNNEX record is
            linked, with an honest empty state. */}
        {td && (
          <Card>
            <h2 className="mb-3 text-sm font-semibold">
              Microsoft 365 licensing ({td.subscriptions.length})
            </h2>
            {td.subscriptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No subscriptions synced for this customer. Run a TD SYNNEX sync,
                or this customer may have no active TD SYNNEX subscriptions.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-4 font-medium">SKU</th>
                      <th className="py-1 pr-4 font-medium">Product</th>
                      <th className="py-1 pr-4 font-medium">Qty</th>
                      <th className="py-1 pr-4 font-medium">Cost</th>
                      <th className="py-1 pr-4 font-medium">Cust. price</th>
                      <th className="py-1 pr-4 font-medium">Term</th>
                      <th className="py-1 pr-4 font-medium">Billing</th>
                      <th className="py-1 pr-4 font-medium">Renewal</th>
                      <th className="py-1 pr-4 font-medium">Status</th>
                      <th className="py-1 pr-4 font-medium">Reducible</th>
                    </tr>
                  </thead>
                  <tbody>
                    {td.subscriptions.map((s) => (
                      <tr key={s.id} className="border-t align-top">
                        <td className="py-1.5 pr-4 font-mono text-xs">{s.productSku ?? "—"}</td>
                        <td className="py-1.5 pr-4">{s.productName ?? "—"}</td>
                        <td className="py-1.5 pr-4 tabular-nums">{s.quantity}</td>
                        <td className="py-1.5 pr-4 tabular-nums">
                          {s.unitCost != null ? formatCurrency(Number(s.unitCost), s.currency ?? "CAD") : "—"}
                        </td>
                        <td className="py-1.5 pr-4 tabular-nums">
                          {s.customerPrice != null ? formatCurrency(Number(s.customerPrice), s.currency ?? "CAD") : "—"}
                        </td>
                        <td className="py-1.5 pr-4">{s.commitmentTerm ?? "—"}</td>
                        <td className="py-1.5 pr-4">{s.billingFrequency ?? "—"}</td>
                        <td className="py-1.5 pr-4">{formatDateTime(s.renewalDate)}</td>
                        <td className="py-1.5 pr-4">{s.status ?? "—"}</td>
                        <td className="py-1.5 pr-4">
                          {s.reducible === false ? (
                            <span className="text-warning">NCE locked</span>
                          ) : s.reducible === true ? (
                            "Yes"
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
