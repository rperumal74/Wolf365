import { getEnv } from "@/env";

/**
 * Minimal Neon control-plane API client used for database backups.
 *
 * A Neon "branch" is an instant copy-on-write snapshot of the whole database at
 * the moment of creation — that is our backup primitive. The control plane is a
 * public HTTPS API with no static-IP requirement, so we use the global `fetch`
 * (not the QuotaGuard-proxied connectorFetch) with a small retry on transient
 * failures.
 *
 * The API key is read from the environment and never logged.
 */

const NEON_API_BASE = "https://console.neon.tech/api/v2";

/** True when both env vars needed for Neon backups are present. */
export function isNeonConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.NEON_API_KEY && env.NEON_PROJECT_ID);
}

export interface NeonBranch {
  id: string;
  name: string;
  created_at?: string;
}

function neonConfig(): { apiKey: string; projectId: string } {
  const env = getEnv();
  if (!env.NEON_API_KEY || !env.NEON_PROJECT_ID) {
    throw new Error("Neon backups are not configured (NEON_API_KEY / NEON_PROJECT_ID).");
  }
  return { apiKey: env.NEON_API_KEY, projectId: env.NEON_PROJECT_ID };
}

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

async function neonFetch(
  path: string,
  apiKey: string,
  init: RequestInit = {},
  attempt = 1,
): Promise<Response> {
  const res = await fetch(`${NEON_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (RETRYABLE.has(res.status) && attempt < 3) {
    await new Promise((r) => setTimeout(r, attempt * 1000));
    return neonFetch(path, apiKey, init, attempt + 1);
  }
  return res;
}

/** Read a concise error body without leaking secrets. */
async function describeError(res: Response): Promise<string> {
  let detail = "";
  try {
    const body = (await res.json()) as { message?: string };
    detail = body?.message ? `: ${body.message}` : "";
  } catch {
    /* ignore non-JSON bodies */
  }
  return `Neon API ${res.status}${detail}`;
}

/** Create a branch (point-in-time snapshot) from the project's default branch. */
export async function createBranch(name: string): Promise<NeonBranch> {
  const { apiKey, projectId } = neonConfig();
  const res = await neonFetch(`/projects/${projectId}/branches`, apiKey, {
    method: "POST",
    body: JSON.stringify({ branch: { name } }),
  });
  if (!res.ok) throw new Error(await describeError(res));
  const data = (await res.json()) as { branch: NeonBranch };
  return data.branch;
}

/** List all branches in the project. */
export async function listBranches(): Promise<NeonBranch[]> {
  const { apiKey, projectId } = neonConfig();
  const res = await neonFetch(`/projects/${projectId}/branches`, apiKey, {
    method: "GET",
  });
  if (!res.ok) throw new Error(await describeError(res));
  const data = (await res.json()) as { branches: NeonBranch[] };
  return data.branches ?? [];
}

/** Delete a branch by id (used to prune expired backups). */
export async function deleteBranch(branchId: string): Promise<void> {
  const { apiKey, projectId } = neonConfig();
  const res = await neonFetch(`/projects/${projectId}/branches/${branchId}`, apiKey, {
    method: "DELETE",
  });
  // 404 = already gone; treat as success so pruning is idempotent.
  if (!res.ok && res.status !== 404) throw new Error(await describeError(res));
}
