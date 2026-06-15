import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEnv } from "@/env";
import { safeEqual } from "@/lib/crypto";
import { runSync } from "@/connectors/runtime";
import { purgeOldDebugLogs } from "@/lib/debug-log";
import { safeErrorMessage } from "@/lib/redact";

// Cron jobs may run longer than the default; allow up to 5 minutes.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Vercel Cron entrypoint (scheduled in vercel.json).
 *
 * Authenticates via the CRON_SECRET bearer token that Vercel injects, then:
 *  - syncs every enabled connector (failures are isolated per connector)
 *  - purges debug logs older than the configured retention window
 *
 * Never runs without a configured + matching secret, so it cannot be triggered
 * by arbitrary callers.
 */
export async function GET(request: Request) {
  const env = getEnv();
  if (!env.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  }
  const authHeader = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${env.CRON_SECRET}`;
  if (!safeEqual(authHeader, expected)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const enabled = await prisma.connector.findMany({
    where: { enabled: true },
    select: { type: true },
  });

  const results: Record<string, unknown> = {};
  for (const { type } of enabled) {
    try {
      const r = await runSync(type, "cron");
      results[type] = { ok: true, ...r };
    } catch (err) {
      // Isolate failures so one bad connector doesn't abort the others.
      results[type] = { ok: false, error: safeErrorMessage(err) };
    }
  }

  // Refresh discrepancy exceptions after syncs (best-effort).
  let reconciled: { scanned: number; flagged: number } | { error: string };
  try {
    const { reconcileAllClients } = await import("@/lib/reconciliation/service");
    reconciled = await reconcileAllClients({ id: null, email: "cron" });
  } catch (err) {
    reconciled = { error: safeErrorMessage(err) };
  }

  const purged = await purgeOldDebugLogs(env.WOLF365_DEBUG_LOG_RETENTION_DAYS);

  return NextResponse.json({
    ok: true,
    synced: results,
    reconciled,
    debugLogsPurged: purged,
  });
}
