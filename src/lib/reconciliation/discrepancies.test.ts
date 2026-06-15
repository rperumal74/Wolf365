import { describe, it, expect } from "vitest";
import {
  detectDiscrepancies,
  normalizeName,
  type Discrepancy,
} from "@/lib/reconciliation/discrepancies";

const types = (d: Discrepancy[]) => d.map((x) => x.type);

describe("normalizeName", () => {
  it("strips legal suffixes and punctuation", () => {
    expect(normalizeName("Acme, Inc.")).toBe("acme");
    expect(normalizeName("Acme LLC")).toBe("acme");
    expect(normalizeName("ACME  Corporation")).toBe("acme");
  });
});

describe("detectDiscrepancies", () => {
  it("flags a clean matched pair with no warnings", () => {
    const d = detectDiscrepancies({
      qbo: {
        companyName: "Acme Inc",
        billingEmail: "ap@acme.com",
        taxable: true,
        active: true,
        currency: "USD",
      },
      td: { name: "Acme", active: true, currency: "USD" },
    });
    expect(d).toHaveLength(0);
  });

  it("detects QBO-only and TD-only presence", () => {
    expect(types(detectDiscrepancies({ qbo: { taxable: true, billingEmail: "a@b.com" } }))).toContain(
      "CLIENT_ONLY_IN_QBO",
    );
    expect(types(detectDiscrepancies({ td: { name: "X" } }))).toContain(
      "CLIENT_ONLY_IN_TDSYNNEX",
    );
  });

  it("detects missing billing email and unknown tax status", () => {
    const t = types(detectDiscrepancies({ qbo: { companyName: "Acme", active: true }, td: { name: "Acme", active: true } }));
    expect(t).toContain("MISSING_BILLING_EMAIL");
    expect(t).toContain("TAX_MISMATCH");
  });

  it("detects name, active-status and currency mismatches", () => {
    const t = types(
      detectDiscrepancies({
        qbo: {
          companyName: "Acme Holdings",
          billingEmail: "a@b.com",
          taxable: true,
          active: true,
          currency: "USD",
        },
        td: { name: "Globex", active: false, currency: "CAD" },
      }),
    );
    expect(t).toContain("NAME_MISMATCH");
    expect(t).toContain("ACTIVE_STATUS_MISMATCH");
    expect(t).toContain("CURRENCY_MISMATCH");
  });

  it("does not flag name mismatch for suffix-only differences", () => {
    const t = types(
      detectDiscrepancies({
        qbo: { companyName: "Acme, Inc.", billingEmail: "a@b.com", taxable: false, active: true },
        td: { name: "Acme LLC", active: true },
      }),
    );
    expect(t).not.toContain("NAME_MISMATCH");
  });
});
