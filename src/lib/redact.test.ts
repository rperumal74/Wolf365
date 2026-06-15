import { describe, it, expect } from "vitest";
import { redactObject, safeEndpoint, safeErrorMessage } from "@/lib/redact";

describe("redact", () => {
  it("redacts sensitive keys recursively", () => {
    const input = {
      clientId: "public-ok",
      clientSecret: "TOPSECRET",
      nested: { refresh_token: "rt", access_token: "at", note: "fine" },
      headers: { Authorization: "Bearer abc" },
    };
    const out = redactObject(input) as Record<string, unknown>;
    expect(out.clientId).toBe("public-ok");
    expect(out.clientSecret).toBe("[REDACTED]");
    const nested = out.nested as Record<string, unknown>;
    expect(nested.refresh_token).toBe("[REDACTED]");
    expect(nested.access_token).toBe("[REDACTED]");
    expect(nested.note).toBe("fine");
    // The Authorization value inside the headers object is redacted.
    expect((out.headers as Record<string, unknown>).Authorization).toBe(
      "[REDACTED]",
    );
  });

  it("strips query strings from endpoints", () => {
    expect(safeEndpoint("https://api.example.com/v3/query?token=abc&q=1")).toBe(
      "/v3/query",
    );
    expect(safeEndpoint("/v1/customers?secret=xyz")).toBe("/v1/customers");
  });

  it("redacts bearer tokens in error messages", () => {
    const msg = safeErrorMessage(new Error("failed with Bearer abc.def-123 token"));
    expect(msg).toContain("Bearer [REDACTED]");
    expect(msg).not.toContain("abc.def-123");
  });

  it("truncates very long messages", () => {
    const long = "x".repeat(1000);
    expect(safeErrorMessage(long, 100).length).toBeLessThanOrEqual(120);
  });
});
