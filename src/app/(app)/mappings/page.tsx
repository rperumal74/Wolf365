import { GitMerge } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { PageHeader, Card, EmptyState } from "@/components/ui/primitives";
import {
  autoMatchClientsAction,
  autoMatchSkusAction,
  confirmClientAction,
  rejectClientAction,
  confirmSkuAction,
  rejectSkuAction,
} from "./actions";

// The auto-match server actions materialize a Client per synced customer and
// can touch hundreds of records; allow up to 5 minutes (capped lower on Hobby).
export const maxDuration = 300;

function ConfidenceBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const pct = Math.round(value * 100);
  const tone =
    pct >= 90 ? "text-success" : pct >= 60 ? "text-warning" : "text-danger";
  return <span className={`font-medium ${tone}`}>{pct}%</span>;
}

export default async function MappingsPage() {
  const user = await requireUser();
  if (!can(user.role, "mappings:read")) {
    return <PageHeader title="Mappings" description="Insufficient permissions." />;
  }
  const canApprove = can(user.role, "mappings:approve");
  const canPropose = can(user.role, "mappings:propose");

  const [clientProposals, productMappings] = await Promise.all([
    prisma.clientMatchProposal.findMany({
      where: { status: "PROPOSED" },
      orderBy: { confidence: "desc" },
      take: 200,
    }),
    prisma.productMapping.findMany({
      orderBy: [{ status: "asc" }, { confidence: "desc" }],
      take: 300,
    }),
  ]);

  // Resolve names for the client proposals in one round-trip each side.
  const qboIds = clientProposals.map((p) => p.qboCustomerId);
  const tdIds = clientProposals.map((p) => p.tdSynnexCustomerId);
  const [qboMap, tdMap] = await Promise.all([
    prisma.qboCustomer
      .findMany({ where: { id: { in: qboIds } } })
      .then((rows) => new Map(rows.map((r) => [r.id, r]))),
    prisma.tdSynnexCustomer
      .findMany({ where: { id: { in: tdIds } } })
      .then((rows) => new Map(rows.map((r) => [r.id, r]))),
  ]);

  return (
    <div>
      <PageHeader
        title="Mappings"
        description="AI-assisted client and SKU mapping. Exact matches auto-confirm; uncertain ones need review."
      />
      <div className="space-y-8 p-8">
        {/* Client mapping */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Client matches awaiting review</h2>
            {canPropose && (
              <form action={autoMatchClientsAction}>
                <button className="rounded-md border px-3 py-1.5 text-sm font-medium transition hover:bg-accent">
                  Run auto-match
                </button>
              </form>
            )}
          </div>
          {clientProposals.length === 0 ? (
            <EmptyState
              icon={<GitMerge className="h-8 w-8" />}
              title="No client proposals"
              description="Run auto-match after syncing QuickBooks and TD SYNNEX to propose client links."
            />
          ) : (
            <div className="space-y-2">
              {clientProposals.map((p) => (
                <Card key={p.id} className="flex items-center justify-between">
                  <div className="text-sm">
                    <p className="font-medium">
                      {qboMap.get(p.qboCustomerId)?.displayName ?? "?"}
                      <span className="mx-2 text-muted-foreground">↔</span>
                      {tdMap.get(p.tdSynnexCustomerId)?.name ?? "?"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Confidence <ConfidenceBadge value={p.confidence} /> · {p.method}
                    </p>
                  </div>
                  {canApprove && (
                    <div className="flex gap-2">
                      <form action={confirmClientAction}>
                        <input type="hidden" name="id" value={p.id} />
                        <button className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90">
                          Confirm
                        </button>
                      </form>
                      <form action={rejectClientAction}>
                        <input type="hidden" name="id" value={p.id} />
                        <button className="rounded-md border px-3 py-1.5 text-sm font-medium transition hover:bg-accent">
                          Reject
                        </button>
                      </form>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* SKU mapping */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">SKU → QuickBooks item mappings</h2>
            {canPropose && (
              <form action={autoMatchSkusAction}>
                <button className="rounded-md border px-3 py-1.5 text-sm font-medium transition hover:bg-accent">
                  Run auto-match
                </button>
              </form>
            )}
          </div>
          {productMappings.length === 0 ? (
            <EmptyState
              icon={<GitMerge className="h-8 w-8" />}
              title="No SKU mappings"
              description="Run auto-match after syncing TD SYNNEX subscriptions and QuickBooks items."
            />
          ) : (
            <div className="space-y-2">
              {productMappings.map((m) => (
                <Card key={m.id} className="flex items-center justify-between">
                  <div className="text-sm">
                    <p className="font-mono">{m.tdSynnexSku}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      → {m.qboItemName ?? m.qboItemId ?? "Unmapped"} · Confidence{" "}
                      <ConfidenceBadge value={m.confidence} /> · {m.status}
                    </p>
                  </div>
                  {canApprove && m.status === "PROPOSED" && (
                    <div className="flex gap-2">
                      <form action={confirmSkuAction}>
                        <input type="hidden" name="sku" value={m.tdSynnexSku} />
                        <button className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90">
                          Confirm
                        </button>
                      </form>
                      <form action={rejectSkuAction}>
                        <input type="hidden" name="sku" value={m.tdSynnexSku} />
                        <button className="rounded-md border px-3 py-1.5 text-sm font-medium transition hover:bg-accent">
                          Reject
                        </button>
                      </form>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
