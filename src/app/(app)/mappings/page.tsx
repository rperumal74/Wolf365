import { GitMerge } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { PageHeader, EmptyState, Card } from "@/components/ui/primitives";

/** SKU/product mapping overview. Client mapping lives on each client page. */
export default async function MappingsPage() {
  await requirePermission("mappings:read");
  const productMappings = await prisma.productMapping.findMany({
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <PageHeader
        title="Mappings"
        description="SKU/product mapping between TD SYNNEX and QuickBooks. Uncertain matches require approval."
      />
      <div className="p-8">
        {productMappings.length === 0 ? (
          <EmptyState
            icon={<GitMerge className="h-8 w-8" />}
            title="No mappings yet"
            description="After syncing, deterministic and AI-assisted matching will propose SKU/product mappings here for review."
          />
        ) : (
          <div className="space-y-2">
            {productMappings.map((m) => (
              <Card key={m.id} className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm">{m.tdSynnexSku}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    → {m.qboItemName ?? m.qboItemId ?? "Unmapped"}
                    {m.confidence != null
                      ? ` · ${Math.round(m.confidence * 100)}% confidence`
                      : ""}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">{m.status}</span>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
