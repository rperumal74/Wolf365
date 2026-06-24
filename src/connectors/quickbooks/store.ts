import "server-only";
import { headers } from "next/headers";
import type { Connector } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptJson } from "@/lib/crypto";
import { getEnvSecrets } from "@/lib/connectors/secrets";
import type { QboSecrets } from "./oauth";

/**
 * Shared QuickBooks connection loader + redirect-URI derivation, used by the
 * connect/disconnect actions and the OAuth callback so they all read secrets
 * and compute the redirect URI identically.
 */
export interface QboConnection {
  connector: Connector | null;
  stored: Record<string, unknown>;
  config: Record<string, unknown>;
  secrets: QboSecrets;
}

export async function loadQboConnection(): Promise<QboConnection> {
  const connector = await prisma.connector.findUnique({
    where: { type: "QUICKBOOKS_ONLINE" },
  });
  const stored: Record<string, unknown> = connector?.secretsEnc
    ? decryptJson<Record<string, unknown>>(connector.secretsEnc)
    : {};
  const config = (connector?.config as Record<string, unknown>) ?? {};
  const secrets = getEnvSecrets(stored, config) as QboSecrets;
  return { connector, stored, config, secrets };
}

/**
 * The QBO OAuth redirect URI. Prefers AUTH_URL (the canonical app URL, which
 * must match what's registered with Intuit) and falls back to the request
 * origin, so the value is identical at connect time and callback time.
 */
export async function qboRedirectUri(): Promise<string> {
  let base = process.env.AUTH_URL?.replace(/\/$/, "");
  if (!base) {
    const h = await headers();
    base = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  }
  return `${base}/api/connectors/quickbooks/callback`;
}
