import { Receipt } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { PageHeader, EmptyState, Card } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  REVIEWED: "bg-accent text-accent-foreground",
  APPROVED: "bg-warning/15 text-warning",
  PUSHED: "bg-success/15 text-success",
  PARTIALLY_FAILED: "bg-danger/15 text-danger",
  CANCELLED: "bg-muted text-muted-foreground",
};

/** Billing run history. Real runs only; empty until the first run is created. */
export default async function BillingPage() {
  await requirePermission("billing:read");
  const runs = await prisma.billingRun.findMany({
    orderBy: { createdAt: "desc" },
    include: { client: true, _count: { select: { lines: true } } },
    take: 100,
  });

  return (
    <div>
      <PageHeader
        title="Billing Runs"
        description="Generate, review, approve, and push invoices to QuickBooks Online."
      />
      <div className="p-8">
        {runs.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-8 w-8" />}
            title="No billing runs yet"
            description="Once connectors are synced and clients mapped, you can generate a billing run, review the pre-push report, and push approved invoices."
          />
        ) : (
          <div className="space-y-2">
            {runs.map((r) => (
              <Card key={r.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {r.client?.name ?? "Bulk run"} · v{r.version}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Period {formatDateTime(r.periodStart)} – {formatDateTime(r.periodEnd)} ·{" "}
                    {r._count.lines} lines
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    STATUS_STYLES[r.status] ?? STATUS_STYLES.DRAFT
                  }`}
                >
                  {r.status.replaceAll("_", " ")}
                </span>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
