import { connectorFetch } from "@/connectors/http";
import {
  QBO_AUTHORIZE_URL,
  QBO_TOKEN_URL,
  QBO_REVOKE_URL,
  type QboEnvironment,
} from "@/connectors/quickbooks/oauth";

/**
 * Intuit OpenID Connect discovery document.
 *
 * Per Intuit's recommendation, OAuth endpoints are resolved at runtime from the
 * discovery document rather than hardcoded, so they track Intuit changes. The
 * result is cached per process. If the document can't be fetched/parsed, we fall
 * back to the documented stable endpoints so the OAuth flow never breaks.
 *
 * Docs: https://developer.intuit.com/.../oauth-openid-discovery-doc
 */
const DISCOVERY_URLS: Record<QboEnvironment, string> = {
  production: "https://developer.api.intuit.com/.well-known/openid_configuration",
  sandbox:
    "https://developer.api.intuit.com/.well-known/openid_sandbox_configuration",
};

export interface QboEndpoints {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  revocationEndpoint: string;
}

const FALLBACK: QboEndpoints = {
  authorizationEndpoint: QBO_AUTHORIZE_URL,
  tokenEndpoint: QBO_TOKEN_URL,
  revocationEndpoint: QBO_REVOKE_URL,
};

const cache: Partial<Record<QboEnvironment, QboEndpoints>> = {};

/**
 * Resolve QBO OAuth endpoints from the discovery document for the environment,
 * cached. Falls back to the documented constants on any failure.
 */
export async function getQboEndpoints(
  env: QboEnvironment,
): Promise<QboEndpoints> {
  const cached = cache[env];
  if (cached) return cached;
  try {
    const res = await connectorFetch(DISCOVERY_URLS[env], {
      connectorType: "QUICKBOOKS_ONLINE",
      environment: env,
      action: "openid_discovery",
      maxAttempts: 2,
    });
    if (res.ok) {
      const doc = JSON.parse(res.body) as {
        authorization_endpoint?: string;
        token_endpoint?: string;
        revocation_endpoint?: string;
      };
      const endpoints: QboEndpoints = {
        authorizationEndpoint:
          doc.authorization_endpoint ?? FALLBACK.authorizationEndpoint,
        tokenEndpoint: doc.token_endpoint ?? FALLBACK.tokenEndpoint,
        revocationEndpoint:
          doc.revocation_endpoint ?? FALLBACK.revocationEndpoint,
      };
      cache[env] = endpoints;
      return endpoints;
    }
  } catch {
    // fall through to constants
  }
  return FALLBACK;
}
