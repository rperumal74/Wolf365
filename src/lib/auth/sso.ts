import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { getEnv } from "@/env";

/**
 * Resolved Entra ID SSO configuration used to build the OAuth provider.
 *
 * Source precedence:
 *  1. The active SsoSettings row (admin-configured, secret decrypted here).
 *  2. First-run env fallback (ENTRA_*), used only until SSO is configured
 *     in-app so a bootstrap admin can sign in to set it up.
 */
export interface ResolvedSso {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  allowedDomains: string[];
  groupRoleMappings: Record<string, Role>;
  source: "database" | "env";
}

export async function resolveSso(): Promise<ResolvedSso | null> {
  const settings = await prisma.ssoSettings.findFirst({
    where: { active: true },
    orderBy: { updatedAt: "desc" },
  });

  if (settings) {
    return {
      tenantId: settings.tenantId,
      clientId: settings.clientId,
      clientSecret: decrypt(settings.clientSecretEnc),
      allowedDomains: settings.allowedDomains,
      groupRoleMappings: (settings.groupRoleMappings ??
        {}) as Record<string, Role>,
      source: "database",
    };
  }

  const env = getEnv();
  if (env.ENTRA_TENANT_ID && env.ENTRA_CLIENT_ID && env.ENTRA_CLIENT_SECRET) {
    return {
      tenantId: env.ENTRA_TENANT_ID,
      clientId: env.ENTRA_CLIENT_ID,
      clientSecret: env.ENTRA_CLIENT_SECRET,
      allowedDomains: [],
      groupRoleMappings: {},
      source: "env",
    };
  }

  return null;
}

/** True when an email's domain is permitted (empty allowlist = allow all). */
export function isDomainAllowed(
  email: string | null | undefined,
  allowedDomains: string[],
): boolean {
  if (!email) return false;
  if (allowedDomains.length === 0) return true;
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return allowedDomains.some((d) => d.trim().toLowerCase() === domain);
}
