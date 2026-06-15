import type { ExceptionType } from "@prisma/client";

/**
 * Discrepancy detection between a client's QuickBooks Online record and its
 * TD SYNNEX StreamOne Stellr record.
 *
 * Kept pure and decoupled from Prisma (operates on plain snapshots) so it is
 * fully unit-testable and reusable by both the client profile view and any
 * batch reconciliation job. Each finding maps to an ExceptionType so callers
 * can persist them to the exception queue verbatim.
 */

export interface QboSnapshot {
  displayName?: string | null;
  companyName?: string | null;
  billingEmail?: string | null;
  billingAddress?: AddressLike | null;
  currency?: string | null;
  taxable?: boolean | null;
  active?: boolean | null;
}

export interface TdSnapshot {
  name?: string | null;
  domain?: string | null;
  serviceAddress?: AddressLike | null;
  currency?: string | null;
  active?: boolean | null;
}

/** Loose address shape — accepts QBO BillAddr-style or simple objects. */
export interface AddressLike {
  Line1?: string | null;
  line1?: string | null;
  City?: string | null;
  city?: string | null;
  PostalCode?: string | null;
  postalCode?: string | null;
  CountrySubDivisionCode?: string | null;
  region?: string | null;
}

export type DiscrepancySeverity = "info" | "warning" | "error";

export interface Discrepancy {
  type: ExceptionType;
  severity: DiscrepancySeverity;
  message: string;
}

export interface DetectInput {
  qbo?: QboSnapshot | null;
  td?: TdSnapshot | null;
}

export function detectDiscrepancies(input: DetectInput): Discrepancy[] {
  const { qbo, td } = input;
  const out: Discrepancy[] = [];

  // Presence checks come first — most other comparisons need both sides.
  if (qbo && !td) {
    out.push({
      type: "CLIENT_ONLY_IN_QBO",
      severity: "warning",
      message: "Customer exists in QuickBooks but has no linked TD SYNNEX record.",
    });
  }
  if (td && !qbo) {
    out.push({
      type: "CLIENT_ONLY_IN_TDSYNNEX",
      severity: "warning",
      message: "Customer exists in TD SYNNEX but has no linked QuickBooks record.",
    });
  }

  if (qbo && !hasEmail(qbo.billingEmail)) {
    out.push({
      type: "MISSING_BILLING_EMAIL",
      severity: "warning",
      message: "QuickBooks customer has no billing email; invoices may not deliver.",
    });
  }

  if (qbo && qbo.taxable == null) {
    out.push({
      type: "TAX_MISMATCH",
      severity: "info",
      message: "QuickBooks tax status is not set; verify taxability before billing.",
    });
  }

  // Cross-source comparisons require both records.
  if (qbo && td) {
    const qboName = normalizeName(qbo.companyName ?? qbo.displayName);
    const tdName = normalizeName(td.name);
    if (qboName && tdName && qboName !== tdName) {
      out.push({
        type: "NAME_MISMATCH",
        severity: "warning",
        message: `Name mismatch: QBO "${qbo.companyName ?? qbo.displayName}" vs TD SYNNEX "${td.name}".`,
      });
    }

    const qboAddr = normalizeAddress(qbo.billingAddress);
    const tdAddr = normalizeAddress(td.serviceAddress);
    if (qboAddr && tdAddr && qboAddr !== tdAddr) {
      out.push({
        type: "ADDRESS_MISMATCH",
        severity: "info",
        message: "Billing/service address differs between QuickBooks and TD SYNNEX.",
      });
    }

    if (qbo.active != null && td.active != null && qbo.active !== td.active) {
      out.push({
        type: "ACTIVE_STATUS_MISMATCH",
        severity: "warning",
        message: `Active status mismatch: QBO ${qbo.active ? "active" : "inactive"}, TD SYNNEX ${td.active ? "active" : "inactive"}.`,
      });
    }

    if (
      qbo.currency &&
      td.currency &&
      qbo.currency.toUpperCase() !== td.currency.toUpperCase()
    ) {
      out.push({
        type: "CURRENCY_MISMATCH",
        severity: "error",
        message: `Currency mismatch: QBO ${qbo.currency} vs TD SYNNEX ${td.currency}.`,
      });
    }
  }

  return out;
}

const COMPANY_SUFFIXES = /\b(inc|incorporated|llc|l\.l\.c|ltd|limited|corp|corporation|co|company|gmbh|plc)\b/g;

/** Normalize a company name for comparison: lowercase, drop punctuation and
 * common legal suffixes, collapse whitespace. */
export function normalizeName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[.,&]/g, " ")
    .replace(COMPANY_SUFFIXES, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAddress(addr: AddressLike | null | undefined): string {
  if (!addr) return "";
  const parts = [
    addr.Line1 ?? addr.line1,
    addr.City ?? addr.city,
    addr.CountrySubDivisionCode ?? addr.region,
    addr.PostalCode ?? addr.postalCode,
  ].filter(Boolean);
  return parts
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && /\S+@\S+\.\S+/.test(email);
}
