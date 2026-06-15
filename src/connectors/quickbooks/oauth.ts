import { ConnectorHttpError, connectorFetch } from "@/connectors/http";

/**
 * QuickBooks Online OAuth 2.0 helpers.
 *
 * QBO uses the authorization-code grant. The admin completes a one-time
 * "Connect QuickBooks" flow (see app/api/connectors/quickbooks/oauth) which
 * yields a realmId + refresh token. Access tokens are short-lived (~1h) and are
 * refreshed on demand here. Refresh tokens are long-lived but rotate, so we
 * always persist the latest one returned.
 *
 * Endpoints are Intuit's documented, stable production endpoints:
 *   Authorization: https://appcenter.intuit.com/connect/oauth2
 *   Token:         https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer
 *   API (sandbox): https://sandbox-quickbooks.api.intuit.com
 *   API (prod):    https://quickbooks.api.intuit.com
 */

export const QBO_AUTHORIZE_URL =
  "https://appcenter.intuit.com/connect/oauth2";
export const QBO_TOKEN_URL =
  "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
// Accounting scope is required for customers, items, and invoices.
export const QBO_SCOPE = "com.intuit.quickbooks.accounting";

export type QboEnvironment = "sandbox" | "production";

export function qboApiBase(env: QboEnvironment): string {
  return env === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

export interface QboSecrets {
  clientId?: string;
  clientSecret?: string;
  realmId?: string;
  refreshToken?: string;
  accessToken?: string;
  /** Epoch ms when the access token expires. */
  accessTokenExpiresAt?: number;
  /** Epoch ms when the refresh token expires (informational). */
  refreshTokenExpiresAt?: number;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
  token_type: string;
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return (
    "Basic " +
    Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
  );
}

/** Exchange an authorization code (from the OAuth callback) for tokens. */
export async function exchangeCodeForTokens(params: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
  });
  const res = await connectorFetch(QBO_TOKEN_URL, {
    connectorType: "QUICKBOOKS_ONLINE",
    action: "oauth_token_exchange",
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(params.clientId, params.clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new ConnectorHttpError(
      `QuickBooks token exchange failed (HTTP ${res.status})`,
    );
  }
  return JSON.parse(res.body) as TokenResponse;
}

/**
 * Return a valid access token, refreshing it if missing or near expiry.
 * Persists rotated tokens via `save`. Throws if the connection is not set up.
 */
export async function getValidAccessToken(
  secrets: QboSecrets,
  save: (next: QboSecrets) => Promise<void>,
): Promise<string> {
  if (!secrets.clientId || !secrets.clientSecret) {
    throw new Error("QuickBooks client credentials are not configured");
  }
  if (!secrets.refreshToken) {
    throw new Error(
      "QuickBooks is not connected — complete the Connect QuickBooks flow first",
    );
  }

  const skewMs = 60_000; // refresh a minute early to avoid edge expiry
  if (
    secrets.accessToken &&
    secrets.accessTokenExpiresAt &&
    secrets.accessTokenExpiresAt - skewMs > Date.now()
  ) {
    return secrets.accessToken;
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: secrets.refreshToken,
  });
  const res = await connectorFetch(QBO_TOKEN_URL, {
    connectorType: "QUICKBOOKS_ONLINE",
    action: "oauth_token_refresh",
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(secrets.clientId, secrets.clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new ConnectorHttpError(
      `QuickBooks token refresh failed (HTTP ${res.status}) — reconnect may be required`,
    );
  }
  const token = JSON.parse(res.body) as TokenResponse;
  const next: QboSecrets = {
    ...secrets,
    accessToken: token.access_token,
    // QBO rotates refresh tokens; always store the newest.
    refreshToken: token.refresh_token,
    accessTokenExpiresAt: Date.now() + token.expires_in * 1000,
    refreshTokenExpiresAt:
      Date.now() + token.x_refresh_token_expires_in * 1000,
  };
  await save(next);
  return token.access_token;
}
