import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, LinkIcon } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { PageHeader, Card, StatItem } from "@/components/ui/primitives";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { isSourceSlug, SOURCE_LABELS } from "@/lib/connector-sources";

interface Field {
  label: string;
  value: string | number;
}

function fmtAddr(addr: unknown): string {
  if (!addr || typeof addr !== "object") return "—";
  const a = addr as Record<string, unknown>;
  const parts = [a.Line1 ?? a.line1, a.City ?? a.city, a.CountrySubDivisionCode ?? a.region, a.PostalCode ?? a.postalCode]
    .filter(Boolean)
    .map(String);
  return parts.length ? parts.join(", ") : "—";
}

export default async function SyncedDetailPage({
  params,
}: {
  params: Promise<{ source: string; id: string }>;
}) {
  const user = await requirePermission("clients:read");
  const { source, id } = await params;
  if (!isSourceSlug(source)) notFound();

  let title = "";
  let clientId: string | null = null;
  let fields: Field[] = [];
  let raw: unknown = null;
  // TD SYNNEX subscriptions, when applicable.
  let subscriptions: Awaited<ReturnType<typeof prisma.tdSynnexSubscription.findMany>> = [];

  if (source === "td-synnex") {
    const c = await prisma.tdSynnexCustomer.findUnique({
      where: { id },
      include: { subscriptions: { orderBy: { productName: "asc" } } },
    });
    if (!c) notFound();
    title = c.name;
    clientId = c.clientId;
    raw = c.raw;
    subscriptions = c.subscriptions;
    fields = [
      { label: "Name", value: c.name },
      { label: "StreamOne ID", value: c.stellrId },
      { label: "Domain", value: c.domain ?? "—" },
      { label: "MS tenant ID", value: c.microsoftTenantId ?? "—" },
      { label: "Service address", value: fmtAddr(c.serviceAddress) },
      { label: "Subscriptions", value: c.subscriptions.length },
      { label: "Status", value: c.active ? "Active" : "Inactive" },
      { label: "Last synced", value: formatDateTime(c.lastSyncedAt, user.timezone) },
    ];
  } else if (source === "qbo") {
    const c = await prisma.qboCustomer.findUnique({ where: { id } });
    if (!c) notFound();
    title = c.displayName;
    clientId = c.clientId;
    raw = c.raw;
    fields = [
      { label: "Display name", value: c.displayName },
      { label: "Company", value: c.companyName ?? "—" },
      { label: "QBO Customer ID", value: c.qboId },
      { label: "Billing email", value: c.billingEmail ?? "—" },
      { label: "Billing address", value: fmtAddr(c.billingAddress) },
      { label: "Currency", value: c.currency ?? "—" },
      { label: "Payment terms", value: c.paymentTerms ?? "—" },
      {
        label: "Tax status",
        value: c.taxStatus ?? (c.taxable == null ? "Unknown" : c.taxable ? "Taxable" : "Non-taxable"),
      },
      { label: "Status", value: c.active ? "Active" : "Inactive" },
      { label: "Last synced", value: formatDateTime(c.lastSyncedAt, user.timezone) },
    ];
  } else if (source === "superops") {
    const c = await prisma.superOpsClient.findUnique({ where: { id } });
    if (!c) notFound();
    title = c.name;
    clientId = c.clientId;
    raw = c.raw;
    fields = [
      { label: "Name", value: c.name },
      { label: "SuperOps ID", value: c.superOpsId },
      { label: "Last synced", value: formatDateTime(c.lastSyncedAt, user.timezone) },
    ];
  } else {
    const c = await prisma.huduCompany.findUnique({ where: { id } });
    if (!c) notFound();
    title = c.name;
    clientId = c.clientId;
    raw = c.raw;
    fields = [
      { label: "Name", value: c.name },
      { label: "Hudu ID", value: c.huduId },
      { label: "Last synced", value: formatDateTime(c.lastSyncedAt, user.timezone) },
    ];
  }

  return (
    <div>
      <PageHeader title={title} description={`Synced from ${SOURCE_LABELS[source]}`} />
      <div className="space-y-6 p-8">
        <Link
          href={`/synced/${source}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to {SOURCE_LABELS[source]}
        </Link>

        {clientId && (
          <Link
            href={`/clients/${clientId}`}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition hover:bg-accent"
          >
            <LinkIcon className="h-4 w-4" /> View linked Wolf365 client
          </Link>
        )}

        <Card>
          <h2 className="mb-3 text-sm font-semibold">Synced fields</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {fields.map((f) => (
              <StatItem key={f.label} label={f.label} value={f.value} />
            ))}
          </div>
        </Card>

        {source === "td-synnex" && (
          <Card>
            <h2 className="mb-3 text-sm font-semibold">
              Microsoft 365 licensing ({subscriptions.length})
            </h2>
            {subscriptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No subscriptions synced.</p>
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
                      <th className="py-1 pr-4 font-medium">Renewal</th>
                      <th className="py-1 pr-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((s) => (
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
                        <td className="py-1.5 pr-4">{formatDateTime(s.renewalDate, user.timezone)}</td>
                        <td className="py-1.5 pr-4">{s.status ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        <Card>
          <h2 className="mb-3 text-sm font-semibold">Raw synced payload</h2>
          {raw ? (
            <pre className="max-h-[28rem] overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(raw, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">No raw payload stored for this record.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
