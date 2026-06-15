"use server";

import { revalidatePath } from "next/cache";
import type { ConnectorType } from "@prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import {
  saveConnectorConfig,
  setConnectorEnabled,
} from "@/lib/connectors/service";
import { getConnectorDefinition } from "@/connectors/registry";
import { runSync, runTestConnection } from "@/connectors/runtime";
import { safeErrorMessage } from "@/lib/redact";

export interface ActionResult {
  ok: boolean;
  message: string;
}

const CONNECTOR_TYPES: ConnectorType[] = [
  "TD_SYNNEX_STELLR",
  "QUICKBOOKS_ONLINE",
  "HUDU",
  "SUPEROPS",
];

function parseType(value: FormDataEntryValue | null): ConnectorType {
  if (typeof value === "string" && CONNECTOR_TYPES.includes(value as ConnectorType)) {
    return value as ConnectorType;
  }
  throw new Error("Invalid connector type");
}

/** Save non-secret config + any newly entered secrets for a connector. */
export async function saveConnectorAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("connectors:configure");
  try {
    const type = parseType(formData.get("type"));
    const def = getConnectorDefinition(type);

    const config: Record<string, string> = {};
    for (const f of def.configFields) {
      const v = formData.get(`config.${f.key}`);
      if (typeof v === "string") config[f.key] = v;
    }
    const secrets: Record<string, string> = {};
    for (const f of def.secretFields) {
      const v = formData.get(`secret.${f.key}`);
      if (typeof v === "string") secrets[f.key] = v;
    }

    await saveConnectorConfig(type, config, secrets);
    await audit({
      action: "CONNECTOR_CONFIG_CHANGED",
      actorId: user.id,
      actorEmail: user.email,
      target: `connector:${type}`,
      metadata: { configFields: Object.keys(config) },
    });
    revalidatePath(`/admin/connectors/${type}`);
    return { ok: true, message: "Configuration saved." };
  } catch (err) {
    return { ok: false, message: safeErrorMessage(err) };
  }
}

/** Run a real Test Connection probe. */
export async function testConnectionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requirePermission("connectors:configure");
  try {
    const type = parseType(formData.get("type"));
    const result = await runTestConnection(type);
    revalidatePath(`/admin/connectors/${type}`);
    return { ok: result.ok, message: result.message };
  } catch (err) {
    return { ok: false, message: safeErrorMessage(err) };
  }
}

/** Trigger a real sync run. */
export async function syncNowAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("connectors:sync");
  try {
    const type = parseType(formData.get("type"));
    const result = await runSync(type, "manual", user.id);
    await audit({
      action: "SYNC_RUN",
      actorId: user.id,
      actorEmail: user.email,
      target: `connector:${type}`,
      metadata: {
        imported: result.imported,
        updated: result.updated,
        skipped: result.skipped,
      },
    });
    revalidatePath(`/admin/connectors/${type}`);
    return {
      ok: true,
      message: `Sync complete: ${result.imported} imported, ${result.updated} updated, ${result.skipped} skipped.`,
    };
  } catch (err) {
    return { ok: false, message: safeErrorMessage(err) };
  }
}

/** Enable/disable a connector. */
export async function toggleConnectorAction(
  formData: FormData,
): Promise<void> {
  const user = await requirePermission("connectors:configure");
  const type = parseType(formData.get("type"));
  const enabled = formData.get("enabled") === "true";
  await setConnectorEnabled(type, enabled);
  await audit({
    action: enabled ? "CONNECTOR_ENABLED" : "CONNECTOR_DISABLED",
    actorId: user.id,
    actorEmail: user.email,
    target: `connector:${type}`,
  });
  revalidatePath(`/admin/connectors/${type}`);
  revalidatePath("/admin/connectors");
}
