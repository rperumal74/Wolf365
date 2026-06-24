import { prisma } from "@/lib/db";

/**
 * DB-backed fixed-window rate limiter for sensitive endpoints. Works across
 * serverless instances (state lives in Postgres). Fails OPEN — if the limiter
 * store errors, the request is allowed rather than breaking the endpoint.
 */
export interface RateLimitResult {
  ok: boolean;
  remaining: number;
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  try {
    const now = new Date();
    const cutoff = new Date(now.getTime() - windowMs);
    const existing = await prisma.rateLimit.findUnique({ where: { key } });

    if (!existing || existing.windowStart < cutoff) {
      await prisma.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, windowStart: now },
        update: { count: 1, windowStart: now },
      });
      return { ok: true, remaining: limit - 1 };
    }
    if (existing.count >= limit) return { ok: false, remaining: 0 };
    await prisma.rateLimit.update({
      where: { key },
      data: { count: { increment: 1 } },
    });
    return { ok: true, remaining: limit - existing.count - 1 };
  } catch {
    return { ok: true, remaining: limit };
  }
}

/**
 * Client IP for rate-limit keying. Prefers `x-real-ip` (set by the Vercel edge,
 * not client-spoofable). For `x-forwarded-for` we take the LAST entry — the hop
 * appended by the trusted proxy — not the leftmost entry, which is
 * client-controlled and would let a caller mint a fresh bucket per request.
 */
export function clientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1]!;
  }
  return "unknown";
}
