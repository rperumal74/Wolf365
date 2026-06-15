import Link from "next/link";
import { Building2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { PageHeader, EmptyState, Card } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/utils";

/** Master client list. Populated by connector syncs + mapping. */
export default async function ClientsPage() {
  await requirePermission("clients:read");
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    include: { qboCustomer: true, tdSynnexCustomer: true },
    take: 200,
  });

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Master billing workspaces, jointly populated by QuickBooks and TD SYNNEX."
      />
      <div className="p-8">
        {clients.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-8 w-8" />}
            title="No clients yet"
            description="Clients appear here after you sync QuickBooks and TD SYNNEX and map their customer records together."
          />
        ) : (
          <div className="space-y-2">
            {clients.map((c) => (
              <Link key={c.id} href={`/clients/${c.id}`}>
                <Card className="flex items-center justify-between transition hover:border-primary/40">
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {c.qboCustomer ? "QBO linked" : "No QBO link"} ·{" "}
                      {c.tdSynnexCustomer ? "TD SYNNEX linked" : "No TD SYNNEX link"}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Updated {formatDateTime(c.updatedAt)}
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
