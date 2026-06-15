import { Role } from "@prisma/client";

/**
 * Role-based access control.
 *
 * Roles are hierarchical by capability, not strictly linear, so we model
 * permissions explicitly rather than as a single rank. Every sensitive server
 * action must call {@link assertCan} (or check {@link can}) — RBAC is enforced
 * server-side only; the UI merely hides what the user cannot do.
 */
export type Permission =
  | "connectors:read"
  | "connectors:configure"
  | "connectors:sync"
  | "debuglogs:read"
  | "sso:configure"
  | "users:manage"
  | "clients:read"
  | "mappings:read"
  | "mappings:propose"
  | "mappings:approve"
  | "billing:read"
  | "billing:edit"
  | "billing:approve"
  | "billing:push"
  | "reports:read"
  | "reports:export"
  | "audit:read";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: [
    "connectors:read",
    "connectors:configure",
    "connectors:sync",
    "debuglogs:read",
    "sso:configure",
    "users:manage",
    "clients:read",
    "mappings:read",
    "mappings:propose",
    "mappings:approve",
    "billing:read",
    "billing:edit",
    "billing:approve",
    "billing:push",
    "reports:read",
    "reports:export",
    "audit:read",
  ],
  ACCOUNTING_MANAGER: [
    "connectors:read",
    "connectors:sync",
    "clients:read",
    "mappings:read",
    "mappings:propose",
    "mappings:approve",
    "billing:read",
    "billing:edit",
    "billing:approve",
    "billing:push",
    "reports:read",
    "reports:export",
    "audit:read",
  ],
  ACCOUNTING_USER: [
    "connectors:read",
    "clients:read",
    "mappings:read",
    "mappings:propose",
    "billing:read",
    "billing:edit",
    "reports:read",
    "reports:export",
  ],
  AUDITOR: [
    "connectors:read",
    "clients:read",
    "mappings:read",
    "billing:read",
    "reports:read",
    "audit:read",
  ],
};

export function can(role: Role | undefined | null, perm: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(perm);
}

/** Throws a typed error if the role lacks the permission. */
export function assertCan(
  role: Role | undefined | null,
  perm: Permission,
): void {
  if (!can(role, perm)) {
    throw new ForbiddenError(perm);
  }
}

export class ForbiddenError extends Error {
  constructor(public readonly permission: Permission) {
    super(`Forbidden: missing permission "${permission}"`);
    this.name = "ForbiddenError";
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner / Admin",
  ACCOUNTING_MANAGER: "Accounting Manager",
  ACCOUNTING_USER: "Accounting User",
  AUDITOR: "Read-only / Auditor",
};
