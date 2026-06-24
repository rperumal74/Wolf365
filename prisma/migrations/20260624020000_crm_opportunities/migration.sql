-- CRM: sales pipeline for prospective agreements. Adds the SALES role, CRM
-- audit actions, the CRM enums, and the CrmOpportunity table. Idempotent.

-- New role + audit actions on existing enums.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SALES';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'OPPORTUNITY_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'OPPORTUNITY_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'OPPORTUNITY_DELETED';

-- New CRM enums.
DO $$ BEGIN
  CREATE TYPE "CrmLine" AS ENUM ('MANAGED_SERVICES', 'MANAGED_NOC', 'M365');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CrmStage" AS ENUM ('PROSPECTING', 'QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CrmForecastCategory" AS ENUM ('PIPELINE', 'BEST_CASE', 'COMMIT', 'CLOSED', 'OMITTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CrmBillingFrequency" AS ENUM ('MONTHLY', 'YEARLY');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CrmOpportunityType" AS ENUM ('NEW_BUSINESS', 'RENEWAL', 'UPSELL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CrmOpportunity table.
CREATE TABLE IF NOT EXISTS "CrmOpportunity" (
    "id" TEXT NOT NULL,
    "line" "CrmLine" NOT NULL,
    "name" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "clientId" TEXT,
    "ownerId" TEXT NOT NULL,
    "amount" DECIMAL(18,2),
    "marginAmount" DECIMAL(18,2),
    "marginPercentage" DECIMAL(6,2),
    "termYears" INTEGER NOT NULL DEFAULT 1,
    "billingFrequency" "CrmBillingFrequency" NOT NULL DEFAULT 'MONTHLY',
    "stage" "CrmStage" NOT NULL DEFAULT 'PROSPECTING',
    "probability" INTEGER NOT NULL DEFAULT 10,
    "forecastCategory" "CrmForecastCategory" NOT NULL DEFAULT 'PIPELINE',
    "closeDate" TIMESTAMP(3) NOT NULL,
    "estimatedInvoiceDate" TIMESTAMP(3),
    "cashInDate" TIMESTAMP(3),
    "lockbox" BOOLEAN NOT NULL DEFAULT false,
    "type" "CrmOpportunityType",
    "leadSource" TEXT,
    "nextStep" TEXT,
    "description" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CrmOpportunity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CrmOpportunity_line_stage_idx" ON "CrmOpportunity"("line", "stage");
CREATE INDEX IF NOT EXISTS "CrmOpportunity_ownerId_idx" ON "CrmOpportunity"("ownerId");
CREATE INDEX IF NOT EXISTS "CrmOpportunity_closeDate_idx" ON "CrmOpportunity"("closeDate");
CREATE INDEX IF NOT EXISTS "CrmOpportunity_clientId_idx" ON "CrmOpportunity"("clientId");

DO $$ BEGIN
  ALTER TABLE "CrmOpportunity" ADD CONSTRAINT "CrmOpportunity_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CrmOpportunity" ADD CONSTRAINT "CrmOpportunity_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CrmOpportunity" ADD CONSTRAINT "CrmOpportunity_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
