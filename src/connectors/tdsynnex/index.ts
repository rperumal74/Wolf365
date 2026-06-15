import { connectorFetch } from "@/connectors/http";
import type {
  ConnectorContext,
  ConnectorDefinition,
  ConnectorSyncResult,
  ConnectorTestResult,
} from "@/connectors/types";
import {
  getStellrAccessToken,
  type StellrConfig,
  type StellrSecrets,
} from "@/connectors/tdsynnex/auth";

/**
 * TD SYNNEX StreamOne Stellr connector.
 *
 * Test Connection performs a REAL OAuth client-credentials request: obtaining a
 * token proves the credentials + connectivity without depending on a specific
 * resource path. Customer/subscription sync requires the documented resource
 * paths from the partner-gated API reference; if they are not configured we
 * fail VISIBLY rather than calling an invented endpoint.
 */
export const tdSynnexConnector: ConnectorDefinition<
  StellrConfig,
  StellrSecrets
> = {
  type: "TD_SYNNEX_STELLR",
  displayName: "TD SYNNEX StreamOne Stellr",
  description:
    "Sync M365 customers, license agreements, and SKUs from StreamOne Stellr.",
  configFields: [
    {
      key: "environment",
      label: "Environment",
      type: "select",
      required: true,
      secret: false,
      options: [
        { value: "sandbox", label: "Sandbox" },
        { value: "production", label: "Production" },
      ],
    },
    {
      key: "region",
      label: "Region",
      type: "select",
      required: true,
      secret: false,
      options: [
        { value: "us", label: "United States" },
        { value: "ca", label: "Canada" },
        { value: "eu", label: "Europe" },
        { value: "uk", label: "United Kingdom" },
        { value: "apac", label: "Asia Pacific" },
      ],
      helpText: "Determines the region-specific API base URL.",
    },
    {
      key: "apiBaseUrl",
      label: "API Base URL",
      type: "url",
      required: true,
      secret: false,
      placeholder: "https://<region>.api.tdsynnex...",
      helpText:
        "Region-specific base URL from the Stellr API reference for your environment.",
    },
    {
      key: "tokenUrl",
      label: "OAuth Token URL",
      type: "url",
      required: true,
      secret: false,
      helpText:
        "OAuth token endpoint from the Stellr Developer Portal for your environment.",
    },
    {
      key: "scope",
      label: "OAuth Scope (optional)",
      type: "text",
      required: false,
      secret: false,
    },
    {
      key: "customersPath",
      label: "Customers resource path (optional)",
      type: "text",
      required: false,
      secret: false,
      placeholder: "/v1/customers",
      helpText:
        "Documented path for listing customers. Required for customer sync.",
    },
    {
      key: "subscriptionsPath",
      label: "Subscriptions resource path (optional)",
      type: "text",
      required: false,
      secret: false,
      helpText:
        "Documented path for listing M365 subscriptions. Required for subscription sync.",
    },
  ],
  secretFields: [
    {
      key: "clientId",
      label: "Client ID",
      type: "password",
      required: true,
      secret: true,
    },
    {
      key: "clientSecret",
      label: "Client Secret",
      type: "password",
      required: true,
      secret: true,
    },
  ],
  validateReadiness(config, secrets) {
    const c = config as StellrConfig;
    const s = secrets as StellrSecrets;
    const missing: string[] = [];
    if (!c.apiBaseUrl) missing.push("API Base URL");
    if (!c.tokenUrl) missing.push("OAuth Token URL");
    if (!s.clientId) missing.push("Client ID");
    if (!s.clientSecret) missing.push("Client Secret");
    return missing;
  },

  async testConnection(ctx): Promise<ConnectorTestResult> {
    const start = Date.now();
    // A successful client-credentials grant is a real, side-effect-free probe.
    await getStellrAccessToken(ctx.config, ctx.secrets, (next) =>
      ctx.saveSecrets(next),
    );
    return {
      ok: true,
      message: "Authenticated with StreamOne Stellr (access token obtained).",
      details: {
        environment: ctx.config.environment ?? "",
        region: ctx.config.region ?? "",
      },
      durationMs: Date.now() - start,
    };
  },

  async sync(ctx): Promise<ConnectorSyncResult> {
    if (!ctx.config.customersPath) {
      // Fail visibly — do not invent an endpoint.
      throw new Error(
        "TD SYNNEX customer sync requires the documented 'Customers resource path' " +
          "to be configured. Add it from the Stellr API reference for your region.",
      );
    }
    const token = await getStellrAccessToken(ctx.config, ctx.secrets, (next) =>
      ctx.saveSecrets(next),
    );
    const base = ctx.config.apiBaseUrl!.replace(/\/$/, "");
    const url = `${base}${ctx.config.customersPath}`;

    const res = await connectorFetch(url, {
      connectorType: "TD_SYNNEX_STELLR",
      connectorId: ctx.connectorId,
      environment: ctx.config.environment ?? ctx.config.region ?? null,
      action: "sync_customers",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(
        `TD SYNNEX customer sync failed (HTTP ${res.status}). Verify the resource path.`,
      );
    }

    // The exact response envelope is region/version specific. We persist the
    // count we can observe and defer field mapping until the verified schema is
    // wired in customer-upsert logic, rather than guessing field names.
    const parsed = JSON.parse(res.body) as unknown;
    const count = Array.isArray(parsed)
      ? parsed.length
      : Array.isArray((parsed as { items?: unknown[] })?.items)
        ? (parsed as { items: unknown[] }).items.length
        : 0;

    return {
      imported: 0,
      updated: 0,
      skipped: count,
      summary: {
        note: "Records fetched; field mapping pending verified Stellr response schema.",
        observedCount: count,
      },
    };
  },
};
