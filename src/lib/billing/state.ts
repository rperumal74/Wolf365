import type { BillingRunStatus } from "@prisma/client";

/**
 * Billing-run state machine.
 *
 * Enforces the legal lifecycle so a run can't, for example, jump from DRAFT
 * straight to PUSHED without review/approval. Approval and push are guarded
 * separately by RBAC; this only governs which transitions are structurally
 * valid.
 */
const TRANSITIONS: Record<BillingRunStatus, BillingRunStatus[]> = {
  DRAFT: ["REVIEWED", "CANCELLED"],
  REVIEWED: ["APPROVED", "DRAFT", "CANCELLED"],
  APPROVED: ["PUSHED", "PARTIALLY_FAILED", "CANCELLED"],
  // A partially failed push can be retried (back to APPROVED) or abandoned.
  PARTIALLY_FAILED: ["PUSHED", "APPROVED", "CANCELLED"],
  PUSHED: [], // terminal
  CANCELLED: [], // terminal
};

export function canTransition(
  from: BillingRunStatus,
  to: BillingRunStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(
  from: BillingRunStatus,
  to: BillingRunStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal billing run transition: ${from} -> ${to}`);
  }
}

export function isTerminal(status: BillingRunStatus): boolean {
  return TRANSITIONS[status].length === 0;
}
