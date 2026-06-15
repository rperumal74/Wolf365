/**
 * Next.js instrumentation hook — runs once when the server process starts.
 * We validate the environment here so misconfiguration fails fast and visibly
 * at boot rather than at the first request that needs a given variable.
 */
export async function register() {
  // Only validate in the Node.js runtime (not the edge runtime, which lacks
  // some Node APIs and does not run our server actions).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getEnv } = await import("@/env");
    getEnv();
  }
}
