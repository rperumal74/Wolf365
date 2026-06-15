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
 * Hudu connector.
 *
 * Hudu exposes a REST API under `<baseUrl>/api/v1` authenticated with the
 * `x-api-key` header. We sync companies for client mapping only — the core app
 * never pushes documents to Hudu (deferred feature).
 */
interface HuduConfig {
  baseUrl?: string;
}
interface HuduSecrets {
  apiKey?: string;
}

function huduHeaders(apiKey: string): Record<string, string> {
  return { "x-api-key": apiKey, Accept: "application/json" };
}

interface HuduCompanyRaw {
  id: number;
  name: string;
}

export const huduConnector: ConnectorDefinition<HuduConfig, HuduSecrets> = {
  type: "HUDU",
  displayName: "Hudu",
  description: "Sync Hudu companies for client mapping (read-only).",
  configFields: [
    {
      key: "baseUrl",
      label: "Hudu Base URL",
      type: "url",
      required: true,
      secret: false,
      placeholder: "https://yourcompany.huducloud.com",
    },
  ],
  secretFields: [
    {
      key: "apiKey",
      label: "API Key",
      type: "password",
      required: true,
      secret: true,
      helpText: "Generated in Hudu under Admin → API.",
    },
  ],
  validateReadiness(config, secrets) {
    const missing: string[] = [];
    if (!(config as HuduConfig).baseUrl) missing.push("Hudu Base URL");
    if (!(secrets as HuduSecrets).apiKey) missing.push("API Key");
    return missing;
  },

  async testConnection(
    ctx: ConnectorContext<HuduConfig, HuduSecrets>,
  ): Promise<ConnectorTestResult> {
    const base = ctx.config.baseUrl!.replace(/\/$/, "");
    const start = Date.now();
    // Listing a single company is a safe, read-only probe.
    const res = await connectorFetch(`${base}/api/v1/companies?page_size=1`, {
      connectorType: "HUDU",
      connectorId: ctx.connectorId,
      action: "test_connection",
      headers: huduHeaders(ctx.secrets.apiKey!),
    });
    const durationMs = Date.now() - start;
    if (!res.ok) {
      return {
        ok: false,
        message: `Hudu returned HTTP ${res.status}`,
        durationMs,
      };
    }
    return { ok: true, message: "Connected to Hudu.", durationMs };
  },

  async sync(
    ctx: ConnectorContext<HuduConfig, HuduSecrets>,
  ): Promise<ConnectorSyncResult> {
    const base = ctx.config.baseUrl!.replace(/\/$/, "");
    let imported = 0;
    let updated = 0;
    let page = 1;
    const pageSize = 100;

    for (;;) {
      const res = await connectorFetch(
        `${base}/api/v1/companies?page=${page}&page_size=${pageSize}`,
        {
          connectorType: "HUDU",
          connectorId: ctx.connectorId,
          action: "sync_companies",
          headers: huduHeaders(ctx.secrets.apiKey!),
        },
      );
      if (!res.ok) throw new Error(`Hudu company sync failed (HTTP ${res.status})`);
      const companies =
        (JSON.parse(res.body) as { companies?: HuduCompanyRaw[] }).companies ??
        [];
      if (companies.length === 0) break;

      for (const c of companies) {
        const existing = await prisma.huduCompany.findUnique({
          where: { huduId: String(c.id) },
        });
        const data = {
          name: c.name,
          raw: c as unknown as Prisma.InputJsonValue,
          lastSyncedAt: new Date(),
        };
        if (existing) {
          await prisma.huduCompany.update({
            where: { huduId: String(c.id) },
            data,
          });
          updated += 1;
        } else {
          await prisma.huduCompany.create({
            data: { huduId: String(c.id), ...data },
          });
          imported += 1;
        }
      }
      if (companies.length < pageSize) break;
      page += 1;
    }

    return { imported, updated, skipped: 0, summary: { entity: "companies" } };
  },
};
