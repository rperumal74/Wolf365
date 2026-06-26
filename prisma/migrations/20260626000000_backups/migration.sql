-- Backups feature: records of platform backups (Neon branch snapshots and
-- sanitized logical exports). Idempotent so a re-run can't wedge the chain.

-- New audit actions. ADD VALUE IF NOT EXISTS is safe here because the new
-- values are not referenced within this same migration.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BACKUP_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BACKUP_DELETED';

CREATE TABLE IF NOT EXISTS "Backup" (
  "id"           TEXT NOT NULL,
  "kind"         TEXT NOT NULL,
  "trigger"      TEXT NOT NULL,
  "status"       TEXT NOT NULL DEFAULT 'PENDING',
  "neonBranchId" TEXT,
  "branchName"   TEXT,
  "sizeBytes"    BIGINT,
  "error"        TEXT,
  "expiresAt"    TIMESTAMP(3),
  "createdById"  TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt"   TIMESTAMP(3),
  CONSTRAINT "Backup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Backup_createdAt_idx" ON "Backup" ("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Backup_createdById_fkey'
  ) THEN
    ALTER TABLE "Backup"
      ADD CONSTRAINT "Backup_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
