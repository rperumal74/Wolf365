"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { safeErrorMessage } from "@/lib/redact";

export interface SsoActionResult {
  ok: boolean;
  message: string;
}

const ssoInputSchema = z.object({
  tenantId: z.string().min(1, "Tenant ID is required"),
  clientId: z.string().min(1, "Client ID is required"),
  allowedDomains: z.string().optional().default(""),
  groupMappings: z.string().optional().default(""),
});

/** Parse "groupObjectId:ROLE" lines into a validated mapping object. */
function parseGroupMappings(raw: string): Record<string, Role> {
  const out: Record<string, Role> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [group, role] = trimmed.split(/[:=]/).map((s) => s?.trim());
    if (!group || !role) continue;
    if (!(role in Role)) {
      throw new Error(`Invalid role "${role}" (use one of ${Object.keys(Role).join(", ")})`);
    }
    out[group] = role as Role;
  }
  return out;
}

export async function saveSsoSettingsAction(
  _prev: SsoActionResult | null,
  formData: FormData,
): Promise<SsoActionResult> {
  const user = await requirePermission("sso:configure");
  try {
    const parsed = ssoInputSchema.parse({
      tenantId: formData.get("tenantId"),
      clientId: formData.get("clientId"),
      allowedDomains: formData.get("allowedDomains") ?? "",
      groupMappings: formData.get("groupMappings") ?? "",
    });
    const clientSecret = (formData.get("clientSecret") as string | null)?.trim() ?? "";

    const allowedDomains = parsed.allowedDomains
      .split(/[,\n]/)
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    const groupRoleMappings = parseGroupMappings(parsed.groupMappings);

    const existing = await prisma.ssoSettings.findFirst({
      where: { active: true },
      orderBy: { updatedAt: "desc" },
    });

    // Require a secret on first setup; allow keeping the stored one on edit.
    if (!existing && !clientSecret) {
      return { ok: false, message: "Client Secret is required for initial setup." };
    }

    const clientSecretEnc = clientSecret
      ? encrypt(clientSecret)
      : existing!.clientSecretEnc;

    if (existing) {
      await prisma.ssoSettings.update({
        where: { id: existing.id },
        data: {
          tenantId: parsed.tenantId,
          clientId: parsed.clientId,
          clientSecretEnc,
          allowedDomains,
          groupRoleMappings,
          updatedBy: user.email,
        },
      });
    } else {
      await prisma.ssoSettings.create({
        data: {
          tenantId: parsed.tenantId,
          clientId: parsed.clientId,
          clientSecretEnc,
          allowedDomains,
          groupRoleMappings,
          updatedBy: user.email,
        },
      });
    }

    await audit({
      action: "SSO_SETTINGS_CHANGED",
      actorId: user.id,
      actorEmail: user.email,
      target: "sso",
      metadata: {
        tenantId: parsed.tenantId,
        domains: allowedDomains.length,
        groupMappings: Object.keys(groupRoleMappings).length,
      },
    });
    revalidatePath("/admin/security");
    return { ok: true, message: "SSO settings saved. New sign-ins will use them." };
  } catch (err) {
    return { ok: false, message: safeErrorMessage(err) };
  }
}
