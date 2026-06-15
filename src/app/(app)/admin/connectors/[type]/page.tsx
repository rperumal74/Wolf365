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

const QBO_STATUS_MESSAGES: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: "QuickBooks connected successfully." },
  state_mismatch: { ok: false, text: "Connection aborted: state mismatch (CSRF check failed)." },
  missing_code: { ok: false, text: "QuickBooks did not return an authorization code." },
  missing_client: { ok: false, text: "Save the OAuth Client ID/Secret before connecting." },
  error: { ok: false, text: "QuickBooks token exchange failed. Check credentials and try again." },
};

export default async function ConnectorConfigPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ qbo?: string }>;
}) {
  const user = await requirePermission("connectors:read");
  const { type } = await params;
  const { qbo } = await searchParams;
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

        {/* QuickBooks-specific OAuth connect section */}
        {type === "QUICKBOOKS_ONLINE" && (
          <div className="mb-6 rounded-lg border bg-card p-6">
            <h3 className="text-sm font-semibold">QuickBooks connection</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {view.secretsSet.clientId
                ? "Authorize Wolf365 to access your QuickBooks company. Tokens are stored encrypted."
                : "Save the OAuth Client ID and Secret below, then return here to connect."}
            </p>
            {qbo && QBO_STATUS_MESSAGES[qbo] && (
              <p
                className={`mt-3 rounded-md px-3 py-2 text-sm ${
                  QBO_STATUS_MESSAGES[qbo].ok
                    ? "bg-success/10 text-success"
                    : "bg-danger/10 text-danger"
                }`}
              >
                {QBO_STATUS_MESSAGES[qbo].text}
              </p>
            )}
            {canConfigure && view.secretsSet.clientId && (
              <a
                href="/api/connectors/quickbooks/connect"
                className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              >
                Connect QuickBooks
              </a>
            )}
          </div>
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
