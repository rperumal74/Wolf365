import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ConnectorType } from "@prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { getConnectorView } from "@/lib/connectors/service";
import { PageHeader, HealthBadge, StatItem } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/utils";
import { ConnectorConfigForm } from "./config-form";
import {
  saveConnectorAction,
  testConnectionAction,
  syncNowAction,
  toggleConnectorAction,
} from "../actions";

const VALID_TYPES: ConnectorType[] = [
  "TD_SYNNEX_STELLR",
  "QUICKBOOKS_ONLINE",
  "HUDU",
  "SUPEROPS",
];

export default async function ConnectorConfigPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const user = await requirePermission("connectors:read");
  const { type } = await params;
  if (!VALID_TYPES.includes(type as ConnectorType)) notFound();

  const view = await getConnectorView(type as ConnectorType);
  const canConfigure = can(user.role, "connectors:configure");
  const canSync = can(user.role, "connectors:sync");

  return (
    <div>
      <PageHeader
        title={view.displayName}
        description={view.description}
        actions={<HealthBadge health={view.health} />}
      />
      <div className="p-8">
        <Link
          href="/admin/connectors"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All connectors
        </Link>

        {/* Sync telemetry */}
        <div className="mb-6 grid grid-cols-2 gap-4 rounded-lg border bg-card p-5 sm:grid-cols-3 lg:grid-cols-6">
          <StatItem label="Last success" value={formatDateTime(view.lastSuccessfulSyncAt)} />
          <StatItem label="Last failure" value={formatDateTime(view.lastFailedSyncAt)} />
          <StatItem
            label="Duration"
            value={view.lastSyncDurationMs != null ? `${view.lastSyncDurationMs} ms` : "—"}
          />
          <StatItem label="Imported" value={view.lastRecordsImported ?? "—"} />
          <StatItem label="Updated" value={view.lastRecordsUpdated ?? "—"} />
          <StatItem label="Skipped" value={view.lastRecordsSkipped ?? "—"} />
        </div>

        {view.lastError && (
          <p className="mb-6 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            Last error: {view.lastError}
          </p>
        )}

        <ConnectorConfigForm
          view={view}
          canConfigure={canConfigure}
          canSync={canSync}
          saveAction={saveConnectorAction}
          testAction={testConnectionAction}
          syncAction={syncNowAction}
          toggleAction={toggleConnectorAction}
        />
      </div>
    </div>
  );
}
