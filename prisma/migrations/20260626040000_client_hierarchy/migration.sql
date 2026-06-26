-- Manual client hierarchy: a subsidiary points at its parent client. Idempotent.
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "parentClientId" TEXT;

CREATE INDEX IF NOT EXISTS "Client_parentClientId_idx" ON "Client" ("parentClientId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Client_parentClientId_fkey'
  ) THEN
    ALTER TABLE "Client"
      ADD CONSTRAINT "Client_parentClientId_fkey"
      FOREIGN KEY ("parentClientId") REFERENCES "Client"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
