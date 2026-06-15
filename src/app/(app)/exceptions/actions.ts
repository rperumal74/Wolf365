"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { reconcileAllClients } from "@/lib/reconciliation/service";

/** Re-run discrepancy detection across all clients and refresh the queue. */
export async function runReconciliationAction(): Promise<void> {
  const user = await requirePermission("mappings:propose");
  await reconcileAllClients({ id: user.id, email: user.email });
  revalidatePath("/exceptions");
}
