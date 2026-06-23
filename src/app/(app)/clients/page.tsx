import Link from "next/link";
import { Building2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";

/** Master client list. Populated by connector syncs + mapping. */
export default async function ClientsPage() {
  await requirePermission("clients:read");
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    include: {
      qboCustomer: { select: { id: true } },
      tdSynnexCustomer: {
        select: {
          stellrId: true,
          active: true,
          _count: { select: { subscriptions: true } },
        },
      },
    },
    take: 1000,
  });

  const withTd = clients.filter((c) => c.tdSynnexCustomer).length;
  const totalLicenses = clients.reduce(
    (a, c) => a + (c.tdSynnexCustomer?._count.subscriptions ?? 0),
    0,
  );

  return (
    <div>
      <PageHeader
        title="Clients"
        description={`${clients.length} clients · ${withTd} with TD SYNNEX · ${totalLicenses} M365 subscriptions. Click a client to drill into records and licensing.`}
      />
      <div className="p-8">
        {clients.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-8 w-8" />}
            title="No clients yet"
            description="Sync QuickBooks and TD SYNNEX, then run Mappings → auto-match to create client records."
          />
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Client</th>
                  <th className="px-4 py-2 font-medium">TD SYNNEX #</th>
                  <th className="px-4 py-2 font-medium">Subscriptions</th>
                  <th className="px-4 py-2 font-medium">QBO</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="border-t hover:bg-accent/40">
                    <td className="px-4 py-2 font-medium">
                      <Link href={`/clients/${c.id}`} className="block hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                      {c.tdSynnexCustomer?.stellrId ?? "—"}
                    </td>
                    <td className="px-4 py-2 tabular-nums">
                      {c.tdSynnexCustomer ? c.tdSynnexCustomer._count.subscriptions : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {c.qboCustomer ? (
                        <span className="text-success">Linked</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {c.tdSynnexCustomer?.active === false ? (
                        <span className="text-warning">Inactive</span>
                      ) : (
                        <span className="text-muted-foreground">Active</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
