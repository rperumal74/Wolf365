"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { safeErrorMessage } from "@/lib/redact";
import { runNeonBackup } from "@/lib/backup/service";

export interface BackupActionResult {
  ok: boolean;
  message: string;
}

/** Trigger an on-demand Neon backup snapshot. */
export async function triggerBackupAction(
  _prev: BackupActionResult | null,
  _formData: FormData,
): Promise<BackupActionResult> {
  const actor = await requirePermission("backups:manage");
  try {
    const result = await runNeonBackup({
      trigger: "MANUAL",
      actor: { id: actor.id, email: actor.email },
      now: new Date(),
    });
    revalidatePath("/admin/backup");
    return { ok: result.ok, message: result.message };
  } catch (err) {
    return { ok: false, message: safeErrorMessage(err) };
  }
}
