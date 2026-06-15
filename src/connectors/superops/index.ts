import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { connectorFetch } from "@/connectors/http";
import type {
  ConnectorContext,
  ConnectorDefinition,
  ConnectorSyncResult,
  ConnectorTestResult,
} from "@/connectors/types";

/**
 * SuperOps connector.
 *
 * SuperOps exposes a single GraphQL endpoint authenticated with a Bearer API
 * token plus a `CustomerSubDomain` header. Endpoints are region specific:
 *   US: https://api.superops.ai/msp
 *   EU: https://euapi.superops.ai/msp
 * We sync clients for mapping only (no ticket creation — deferred feature).
 */
interface SuperOpsConfig {
  subdomain?: string;
  dataCenter?: "us" | "eu";
}
interface SuperOpsSecrets {
  apiToken?: string;
}

function superOpsEndpoint(dc: "us" | "eu" | undefined): string {
  return dc === "eu"
    ? "https://euapi.superops.ai/msp"
    : "https://api.superops.ai/msp";
}

async function superOpsGraphQL(
  ctx: ConnectorContext<SuperOpsConfig, SuperOpsSecrets>,
  action: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: unknown; errors?: unknown }> {
  const res = await connectorFetch(superOpsEndpoint(ctx.config.dataCenter), {
    connectorType: "SUPEROPS",
    connectorId: ctx.connectorId,
    action,
    method: "POST",
    headers: {
      Authorization: `Bearer ${ctx.secrets.apiToken!}`,
      CustomerSubDomain: ctx.config.subdomain!,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const parsed = res.body
    ? (JSON.parse(res.body) as { data?: unknown; errors?: unknown })
    : {};
  return {
    ok: res.ok && !parsed.errors,
    status: res.status,
    data: parsed.data,
    errors: parsed.errors,
  };
}

export const superOpsConnector: ConnectorDefinition<
  SuperOpsConfig,
  SuperOpsSecrets
> = {
  type: "SUPEROPS",
  displayName: "SuperOps",
  description: "Sync SuperOps clients for mapping (read-only GraphQL).",
  configFields: [
    {
      key: "subdomain",
      label: "Account Subdomain",
      type: "text",
      required: true,
      secret: false,
      placeholder: "yourcompany",
      helpText: "Sent as the CustomerSubDomain header.",
    },
    {
      key: "dataCenter",
      label: "Data Center",
      type: "select",
      required: true,
      secret: false,
      options: [
        { value: "us", label: "United States (api.superops.ai)" },
        { value: "eu", label: "Europe (euapi.superops.ai)" },
      ],
    },
  ],
  secretFields: [
    {
      key: "apiToken",
      label: "API Token",
      type: "password",
      required: true,
      secret: true,
      helpText: "Generated in SuperOps under My Profile → API Token.",
    },
  ],
  validateReadiness(config, secrets) {
    const c = config as SuperOpsConfig;
    const missing: string[] = [];
    if (!c.subdomain) missing.push("Account Subdomain");
    if (!c.dataCenter) missing.push("Data Center");
    if (!(secrets as SuperOpsSecrets).apiToken) missing.push("API Token");
    return missing;
  },

  async testConnection(ctx): Promise<ConnectorTestResult> {
    const start = Date.now();
    // Request a single client page as a safe read-only probe.
    const res = await superOpsGraphQL(
      ctx,
      "test_connection",
      CLIENT_LIST_QUERY,
      { input: { page: 1, pageSize: 1 } },
    );
    const durationMs = Date.now() - start;
    if (!res.ok) {
      return {
        ok: false,
        message: `SuperOps GraphQL error (HTTP ${res.status})`,
        durationMs,
      };
    }
    return { ok: true, message: "Connected to SuperOps.", durationMs };
  },

  async sync(ctx): Promise<ConnectorSyncResult> {
    let imported = 0;
    let updated = 0;
    let page = 1;
    const pageSize = 100;

    for (;;) {
      const res = await superOpsGraphQL(ctx, "sync_clients", CLIENT_LIST_QUERY, {
        input: { page, pageSize },
      });
      if (!res.ok) throw new Error(`SuperOps client sync failed (HTTP ${res.status})`);
      const clients =
        (res.data as { getClientList?: { clients?: SuperOpsClientRaw[] } })
          ?.getClientList?.clients ?? [];
      if (clients.length === 0) break;

      for (const c of clients) {
        const existing = await prisma.superOpsClient.findUnique({
          where: { superOpsId: String(c.accountId) },
        });
        const data = {
          name: c.name,
          raw: c as unknown as Prisma.InputJsonValue,
          lastSyncedAt: new Date(),
        };
        if (existing) {
          await prisma.superOpsClient.update({
            where: { superOpsId: String(c.accountId) },
            data,
          });
          updated += 1;
        } else {
          await prisma.superOpsClient.create({
            data: { superOpsId: String(c.accountId), ...data },
          });
          imported += 1;
        }
      }
      if (clients.length < pageSize) break;
      page += 1;
    }

    return { imported, updated, skipped: 0, summary: { entity: "clients" } };
  },
};

interface SuperOpsClientRaw {
  accountId: string;
  name: string;
}

// SuperOps client list query. Field/argument names follow the documented MSP
// schema; if the tenant's schema differs the real GraphQL error surfaces.
const CLIENT_LIST_QUERY = `
query getClientList($input: ListInfoInput!) {
  getClientList(input: $input) {
    clients { accountId name }
    listInfo { totalCount }
  }
}`;
