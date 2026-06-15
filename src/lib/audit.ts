import type { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Append a security-relevant event to the audit log.
 *
 * Audit entries are append-only and must never contain secrets. Pass only safe,
 * non-secret context in `metadata` (ids, counts, field names — not values of
 * credentials/tokens).
 */
export async function audit(params: {
  action: AuditAction;
  actorId?: string | null;
  actorEmail?: string | null;
  target?: string | null;
  metadata?: Prisma.InputJsonValue;
  ip?: string | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        actorId: params.actorId ?? null,
        actorEmail: params.actorEmail ?? null,
        target: params.target ?? null,
        metadata: params.metadata,
        ip: params.ip ?? null,
      },
    });
  } catch (err) {
    // Auditing must never break the primary operation, but a failure to audit
    // is itself notable — surface it to server logs (no secrets here).
    console.error("[audit] failed to write audit log", {
      action: params.action,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}
