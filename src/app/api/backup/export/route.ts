import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { exportPlatformData } from "@/lib/backup/service";

export const dynamic = "force-dynamic";
// A full data export can take a while on large datasets.
export const maxDuration = 300;

/**
 * Download a sanitized JSON snapshot of the platform's core business data.
 * RBAC-gated and audited; excludes all secrets, OAuth tokens and sessions.
 */
export async function GET() {
  const user = await requirePermission("backups:manage");

  const now = new Date();
  const data = await exportPlatformData(now);

  await audit({
    action: "EXPORT",
    actorId: user.id,
    actorEmail: user.email,
    target: "backup:logical-export",
  });

  // BigInt-safe serialization (any BigInt column → string).
  const body = JSON.stringify(
    data,
    (_key, value) => (typeof value === "bigint" ? value.toString() : value),
    2,
  );
  const filename = `wolf365-export-${now.toISOString().slice(0, 10)}.json`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
