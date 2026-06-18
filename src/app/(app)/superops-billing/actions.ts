"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { runSync } from "@/connectors/runtime";
import { safeErrorMessage } from "@/lib/redact";
import {
  pushSuperOpsInvoiceToQbo,
  setSuperOpsReviewStatus,
} from "@/lib/superops/billing";

export interface SoActionResult {
  ok: boolean;
  message: string;
}

/** Pull clients + invoices from SuperOps. */
export async function syncSuperOpsAction(
  _prev: SoActionResult | null,
  _formData: FormData,
): Promise<SoActionResult> {
  const user = await requirePermission("connectors:sync");
  try {
    const r = await runSync("SUPEROPS", "manual", user.id);
    revalidatePath("/superops-billing");
    return {
      ok: true,
      message: `Imported ${r.imported}, updated ${r.updated} (clients + invoices).`,
    };
  } catch (err) {
    return { ok: false, message: safeErrorMessage(err) };
  }
}

export async function reviewInvoiceAction(formData: FormData): Promise<void> {
  const user = await requirePermission("billing:edit");
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as "REVIEWED" | "SKIPPED" | "PENDING";
  await setSuperOpsReviewStatus(id, status, { id: user.id, email: user.email });
  revalidatePath("/superops-billing");
}

/** Push a single SuperOps invoice to QBO. Result is reflected on the row
 * (PUSHED + qboInvoiceId, or pushError) after revalidation. */
export async function pushInvoiceAction(formData: FormData): Promise<void> {
  const user = await requirePermission("billing:push");
  const id = String(formData.get("id"));
  await pushSuperOpsInvoiceToQbo(id, { id: user.id, email: user.email });
  revalidatePath("/superops-billing");
}
