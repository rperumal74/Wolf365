import { NextResponse } from "next/server";
import { ConnectorHealth } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { getEnvSecrets, setEnvSecrets } from "@/lib/connectors/secrets";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { safeErrorMessage } from "@/lib/redact";
import { revokeToken, type QboSecrets } from "@/connectors/quickbooks/oauth";

export const dynamic = "force-dynamic";

/**
 * Disconnect QuickBooks Online: revoke the token with Intuit and clear the
 * stored connection (realmId + tokens) for the active environment, while
 * keeping the OAuth client id/secret so the admin can reconnect. This is the
 * production-correct disconnect flow Intuit expects.
 */
export async function GET(request: Request) {
  const user = await requirePermission("connectors:configure");
  const origin = new URL(request.url).origin;
  const back = (status: string) =>
    NextResponse.redirect(
      new URL(`/admin/connectors/QUICKBOOKS_ONLINE?qbo=${status}`, origin),
    );

  const connector = await prisma.connector.findUnique({
    where: { type: "QUICKBOOKS_ONLINE" },
  });
  if (!connector?.secretsEnc) return back("not_connected");

  const stored = decryptJson<Record<string, unknown>>(connector.secretsEnc);
  const config = (connector.config as Record<string, unknown>) ?? {};
  const secrets = getEnvSecrets(stored, config) as QboSecrets;

  try {
    // Revoke with Intuit (best-effort) using the refresh token if present.
    if (secrets.clientId && secrets.clientSecret && secrets.refreshToken) {
      await revokeToken({
        clientId: secrets.clientId,
        clientSecret: secrets.clientSecret,
        token: secrets.refreshToken,
      });
    }

    // Clear the connection but keep the OAuth client credentials.
    const cleared: QboSecrets = {
      clientId: secrets.clientId,
      clientSecret: secrets.clientSecret,
    };
    const merged = setEnvSecrets(stored, config, cleared as Record<string, unknown>);
    await prisma.connector.update({
      where: { type: "QUICKBOOKS_ONLINE" },
      data: { secretsEnc: encryptJson(merged), health: ConnectorHealth.UNCONFIGURED },
    });

    await audit({
      action: "CONNECTOR_CONFIG_CHANGED",
      actorId: user.id,
      actorEmail: user.email,
      target: "connector:QUICKBOOKS_ONLINE",
      metadata: { event: "qbo_disconnected" },
    });
    return back("disconnected");
  } catch (err) {
    await audit({
      action: "CONNECTOR_CONFIG_CHANGED",
      actorId: user.id,
      actorEmail: user.email,
      target: "connector:QUICKBOOKS_ONLINE",
      metadata: { event: "qbo_disconnect_failed", error: safeErrorMessage(err) },
    });
    return back("disconnect_error");
  }
}
