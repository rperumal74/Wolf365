import { BarChart3 } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { PageHeader, Card } from "@/components/ui/primitives";

/**
 * Reports index. Each report is computed from real synced + billing data and
 * will render honest empty results until that data exists.
 */
const REPORTS = [
  {
    title: "Revenue leakage",
    description: "Licenses present in TD SYNNEX but not billed in QuickBooks.",
  },
  {
    title: "Overbilling risk",
    description: "QBO billing items that no longer exist in TD SYNNEX.",
  },
  {
    title: "Margin report",
    description: "Estimated TD SYNNEX cost vs. invoiced revenue by client/SKU.",
  },
  {
    title: "Change explanation",
    description: "Plain-English explanation of why an invoice changed since last period.",
  },
];

export default async function ReportsPage() {
  await requirePermission("reports:read");
  return (
    <div>
      <PageHeader
        title="Reports"
        description="Reconciliation and revenue-integrity reports with CSV/Excel export."
      />
      <div className="grid grid-cols-1 gap-4 p-8 sm:grid-cols-2">
        {REPORTS.map((r) => (
          <Card key={r.title}>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-medium">{r.title}</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              Available once connectors are synced and billing runs exist.
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
