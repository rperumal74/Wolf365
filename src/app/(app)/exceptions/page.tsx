import { CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { PageHeader, EmptyState, Card } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/utils";

const SEVERITY_STYLES: Record<string, string> = {
  error: "text-danger",
  warning: "text-warning",
  info: "text-muted-foreground",
};

/** Exception / reconciliation queue. Real rows produced by sync + discrepancy
 * detection; empty when there is genuinely nothing to resolve. */
export default async function ExceptionsPage() {
  await requirePermission("reports:read");
  const exceptions = await prisma.exception.findMany({
    where: { status: { not: "RESOLVED" } },
    orderBy: { createdAt: "desc" },
    include: { client: true },
    take: 300,
  });

  return (
    <div>
      <PageHeader
        title="Exceptions"
        description="Unmapped clients/SKUs, missing prices, discrepancies, and connector failures."
      />
      <div className="p-8">
        {exceptions.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-8 w-8 text-success" />}
            title="No open exceptions"
            description="Reconciliation issues will appear here as connectors sync and billing runs are generated."
          />
        ) : (
          <div className="space-y-2">
            {exceptions.map((e) => (
              <Card key={e.id} className="flex items-start justify-between gap-4">
                <div>
                  <p className={`text-sm font-medium ${SEVERITY_STYLES[e.severity] ?? ""}`}>
                    {e.type.replaceAll("_", " ")}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{e.message}</p>
                  {e.client && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Client: {e.client.name}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDateTime(e.createdAt)}
                </span>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
