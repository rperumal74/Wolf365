import { beforeAll } from "vitest";

/**
 * Safety guard for integration tests: they create and delete rows, so they must
 * ONLY ever run against a local database — never production (Neon). We refuse to
 * proceed unless DATABASE_URL clearly points at localhost.
 */
beforeAll(() => {
  const url = process.env.DATABASE_URL ?? "";
  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Point it at the local test database, e.g. " +
        "postgresql://wolf365:wolf365@localhost:5433/wolf365_test",
    );
  }
  if (!isLocal) {
    throw new Error(
      "Refusing to run integration tests against a non-local DATABASE_URL. " +
        "These tests write and delete data — use the local Postgres only " +
        `(got host that is not localhost). See docs/LOCAL_DEV.md.`,
    );
  }
});
