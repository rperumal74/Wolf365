import type { ConnectorType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { safeEndpoint, safeErrorMessage } from "@/lib/redact";

/**
 * Admin-only connector debug logger.
 *
 * SECURITY: this is the ONLY sanctioned path for writing connector debug
 * entries. It enforces redaction so secrets (client secrets, API keys, refresh/
 * access tokens, auth codes, full headers, raw sensitive payloads) can never be
 * persisted. Callers pass structured, safe fields only.
 */
export interface DebugLogInput {
  type: ConnectorType;
  connectorId?: string | null;
  environment?: string | null;
  action: string;
  endpoint?: string | null;
  httpMethod?: string | null;
  httpStatus?: number | null;
  durationMs?: number | null;
  correlationId?: string | null;
  recordsRequested?: number | null;
  recordsReturned?: number | null;
  recordsCreated?: number | null;
  recordsUpdated?: number | null;
  recordsSkipped?: number | null;
  authStatus?: string | null;
  retryAttempts?: number;
  rateLimited?: boolean;
  outcome: "success" | "failure";
  /** Raw error/message — will be redacted and truncated before storage. */
  error?: unknown;
}

export async function writeDebugLog(input: DebugLogInput): Promise<void> {
  try {
    await prisma.debugLog.create({
      data: {
        type: input.type,
        connectorId: input.connectorId ?? null,
        environment: input.environment ?? null,
        action: input.action,
        // Defensively strip any query string that might carry tokens.
        endpoint: input.endpoint ? safeEndpoint(input.endpoint) : null,
        httpMethod: input.httpMethod ?? null,
        httpStatus: input.httpStatus ?? null,
        durationMs: input.durationMs ?? null,
        correlationId: input.correlationId ?? null,
        recordsRequested: input.recordsRequested ?? null,
        recordsReturned: input.recordsReturned ?? null,
        recordsCreated: input.recordsCreated ?? null,
        recordsUpdated: input.recordsUpdated ?? null,
        recordsSkipped: input.recordsSkipped ?? null,
        authStatus: input.authStatus ?? null,
        retryAttempts: input.retryAttempts ?? 0,
        rateLimited: input.rateLimited ?? false,
        outcome: input.outcome,
        message:
          input.error !== undefined ? safeErrorMessage(input.error) : null,
      },
    });
  } catch (err) {
    console.error("[debug-log] failed to write debug log", {
      type: input.type,
      action: input.action,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}

/**
 * Delete debug logs older than the retention window. Intended to be called from
 * a Vercel Cron job. Default 30 days; configurable per call (30–90 typical).
 */
export async function purgeOldDebugLogs(retentionDays = 30): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await prisma.debugLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return result.count;
}
