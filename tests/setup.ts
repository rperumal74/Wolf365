import { randomBytes } from "node:crypto";

// Provide the minimal valid environment so modules that validate env on import
// (src/env.ts) load cleanly under test.
process.env.DATABASE_URL ??=
  "postgresql://user:pass@localhost:5432/wolf365?sslmode=require";
process.env.AUTH_SECRET ??= randomBytes(32).toString("base64");
process.env.WOLF365_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");
// NODE_ENV is set to "test" by the test runner; do not reassign (read-only).
