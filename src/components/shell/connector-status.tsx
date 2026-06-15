import { prisma } from "@/lib/db";

/**
 * Compact connector-health summary for the lower-left status panel. Honest
 * empty state when no connectors are configured yet — no fake "all systems go".
 */
export async function ConnectorStatusBadge() {
  const connectors = await prisma.connector.findMany({
    select: { health: true },
  });

  if (connectors.length === 0) {
    return (
      <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        No connectors configured
      </div>
    );
  }

  const healthy = connectors.filter((c) => c.health === "HEALTHY").length;
  const error = connectors.filter((c) => c.health === "ERROR").length;
  const dot = error > 0 ? "bg-danger" : healthy > 0 ? "bg-success" : "bg-warning";

  return (
    <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs">
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
      <span className="text-muted-foreground">
        {healthy}/{connectors.length} connectors healthy
        {error > 0 ? ` · ${error} error` : ""}
      </span>
    </div>
  );
}
