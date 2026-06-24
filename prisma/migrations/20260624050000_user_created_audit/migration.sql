-- Invite-only SSO: admins pre-create users. Audit action for that. Idempotent.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'USER_CREATED';
