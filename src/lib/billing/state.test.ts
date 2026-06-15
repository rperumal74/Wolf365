import { describe, it, expect } from "vitest";
import { canTransition, assertTransition, isTerminal } from "@/lib/billing/state";

describe("billing run state machine", () => {
  it("allows the happy path DRAFT -> REVIEWED -> APPROVED -> PUSHED", () => {
    expect(canTransition("DRAFT", "REVIEWED")).toBe(true);
    expect(canTransition("REVIEWED", "APPROVED")).toBe(true);
    expect(canTransition("APPROVED", "PUSHED")).toBe(true);
  });

  it("forbids skipping review/approval", () => {
    expect(canTransition("DRAFT", "PUSHED")).toBe(false);
    expect(canTransition("DRAFT", "APPROVED")).toBe(false);
    expect(canTransition("REVIEWED", "PUSHED")).toBe(false);
  });

  it("allows retrying a partial failure", () => {
    expect(canTransition("PARTIALLY_FAILED", "APPROVED")).toBe(true);
    expect(canTransition("PARTIALLY_FAILED", "PUSHED")).toBe(true);
  });

  it("treats PUSHED and CANCELLED as terminal", () => {
    expect(isTerminal("PUSHED")).toBe(true);
    expect(isTerminal("CANCELLED")).toBe(true);
    expect(canTransition("PUSHED", "APPROVED")).toBe(false);
  });

  it("assertTransition throws on illegal moves", () => {
    expect(() => assertTransition("DRAFT", "PUSHED")).toThrow();
    expect(() => assertTransition("DRAFT", "REVIEWED")).not.toThrow();
  });
});
