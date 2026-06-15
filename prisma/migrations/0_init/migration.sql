-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ACCOUNTING_MANAGER', 'ACCOUNTING_USER', 'AUDITOR');

-- CreateEnum
CREATE TYPE "ConnectorType" AS ENUM ('TD_SYNNEX_STELLR', 'QUICKBOOKS_ONLINE', 'HUDU', 'SUPEROPS');

-- CreateEnum
CREATE TYPE "ConnectorHealth" AS ENUM ('UNCONFIGURED', 'HEALTHY', 'DEGRADED', 'ERROR');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN', 'CONNECTOR_CONFIG_CHANGED', 'CONNECTOR_ENABLED', 'CONNECTOR_DISABLED', 'SYNC_RUN', 'MAPPING_CHANGED', 'BILLING_RUN_CREATED', 'BILLING_LINE_EDITED', 'BILLING_RUN_APPROVED', 'QBO_INVOICE_PUSHED', 'EXPORT', 'SSO_SETTINGS_CHANGED', 'USER_ROLE_CHANGED');

-- CreateEnum
CREATE TYPE "MappingStatus" AS ENUM ('PROPOSED', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MappingMethod" AS ENUM ('DETERMINISTIC', 'AI_ASSISTED', 'MANUAL');

-- CreateEnum
CREATE TYPE "PriceRuleScope" AS ENUM ('GLOBAL_MARKUP', 'SKU', 'CUSTOMER', 'CUSTOMER_SKU');

-- CreateEnum
CREATE TYPE "BillingRunStatus" AS ENUM ('DRAFT', 'REVIEWED', 'APPROVED', 'PUSHED', 'PARTIALLY_FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExceptionType" AS ENUM ('UNMAPPED_CLIENT', 'UNMAPPED_SKU', 'MISSING_QBO_CUSTOMER', 'MISSING_PRICE', 'INACTIVE_CLIENT', 'TAX_MISMATCH', 'CURRENCY_MISMATCH', 'CONNECTOR_FAILURE', 'NAME_MISMATCH', 'ADDRESS_MISMATCH', 'MISSING_BILLING_EMAIL', 'CLIENT_ONLY_IN_QBO', 'CLIENT_ONLY_IN_TDSYNNEX', 'ACTIVE_STATUS_MISMATCH', 'POSSIBLE_DUPLICATE');

-- CreateEnum
CREATE TYPE "ExceptionStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "emailVerified" TIMESTAMP(3),
    "role" "Role" NOT NULL DEFAULT 'AUDITOR',
    "entraOid" TEXT,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "SsoSettings" (
    "id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecretEnc" TEXT NOT NULL,
    "allowedDomains" TEXT[],
    "groupRoleMappings" JSONB NOT NULL DEFAULT '{}',
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsoSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Connector" (
    "id" TEXT NOT NULL,
    "type" "ConnectorType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL DEFAULT '{}',
    "secretsEnc" TEXT,
    "health" "ConnectorHealth" NOT NULL DEFAULT 'UNCONFIGURED',
    "lastSuccessfulSyncAt" TIMESTAMP(3),
    "lastFailedSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastSyncDurationMs" INTEGER,
    "lastRecordsImported" INTEGER,
    "lastRecordsUpdated" INTEGER,
    "lastRecordsSkipped" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Connector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "type" "ConnectorType" NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "trigger" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "recordsImported" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "recordsSkipped" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "summary" JSONB,
    "startedById" TEXT,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebugLog" (
    "id" TEXT NOT NULL,
    "connectorId" TEXT,
    "type" "ConnectorType" NOT NULL,
    "environment" TEXT,
    "action" TEXT NOT NULL,
    "endpoint" TEXT,
    "httpMethod" TEXT,
    "httpStatus" INTEGER,
    "durationMs" INTEGER,
    "correlationId" TEXT,
    "recordsRequested" INTEGER,
    "recordsReturned" INTEGER,
    "recordsCreated" INTEGER,
    "recordsUpdated" INTEGER,
    "recordsSkipped" INTEGER,
    "authStatus" TEXT,
    "retryAttempts" INTEGER NOT NULL DEFAULT 0,
    "rateLimited" BOOLEAN NOT NULL DEFAULT false,
    "outcome" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebugLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "target" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QboCustomer" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "qboId" TEXT NOT NULL,
    "realmId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "companyName" TEXT,
    "billingEmail" TEXT,
    "billingAddress" JSONB,
    "taxable" BOOLEAN,
    "taxStatus" TEXT,
    "currency" TEXT,
    "paymentTerms" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "raw" JSONB,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QboCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TdSynnexCustomer" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "stellrId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "microsoftTenantId" TEXT,
    "serviceAddress" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "raw" JSONB,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TdSynnexCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TdSynnexSubscription" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "stellrSubscriptionId" TEXT NOT NULL,
    "productSku" TEXT,
    "productName" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(18,4),
    "currency" TEXT,
    "commitmentTerm" TEXT,
    "billingFrequency" TEXT,
    "startDate" TIMESTAMP(3),
    "renewalDate" TIMESTAMP(3),
    "cancellationWindowEnds" TIMESTAMP(3),
    "reducible" BOOLEAN,
    "status" TEXT,
    "raw" JSONB,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TdSynnexSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HuduCompany" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "huduId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "raw" JSONB,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HuduCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuperOpsClient" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "superOpsId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "raw" JSONB,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuperOpsClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMapping" (
    "id" TEXT NOT NULL,
    "tdSynnexSku" TEXT NOT NULL,
    "qboItemId" TEXT,
    "qboItemName" TEXT,
    "status" "MappingStatus" NOT NULL DEFAULT 'PROPOSED',
    "method" "MappingMethod" NOT NULL DEFAULT 'DETERMINISTIC',
    "confidence" DOUBLE PRECISION,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceRule" (
    "id" TEXT NOT NULL,
    "scope" "PriceRuleScope" NOT NULL,
    "clientId" TEXT,
    "sku" TEXT,
    "markupPct" DECIMAL(9,4),
    "fixedUnitPrice" DECIMAL(18,4),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingRun" (
    "id" TEXT NOT NULL,
    "status" "BillingRunStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "clientId" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "pushedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingLine" (
    "id" TEXT NOT NULL,
    "billingRunId" TEXT NOT NULL,
    "tdSynnexSubscriptionId" TEXT,
    "qboItemId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "prorationFactor" DECIMAL(9,6) NOT NULL DEFAULT 1,
    "proratedDays" INTEGER,
    "periodDays" INTEGER,
    "discount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "adjustment" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "estimatedCost" DECIMAL(18,4),
    "taxStatus" TEXT,
    "subtotal" DECIMAL(18,4) NOT NULL,
    "total" DECIMAL(18,4) NOT NULL,
    "notes" TEXT,
    "qboInvoiceId" TEXT,
    "pushError" TEXT,

    CONSTRAINT "BillingLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingLineEdit" (
    "id" TEXT NOT NULL,
    "billingRunId" TEXT NOT NULL,
    "billingLineId" TEXT,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "editedById" TEXT,
    "editedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingLineEdit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exception" (
    "id" TEXT NOT NULL,
    "type" "ExceptionType" NOT NULL,
    "status" "ExceptionStatus" NOT NULL DEFAULT 'OPEN',
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "clientId" TEXT,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Exception_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_entraOid_key" ON "User"("entraOid");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Connector_type_key" ON "Connector"("type");

-- CreateIndex
CREATE INDEX "SyncRun_connectorId_startedAt_idx" ON "SyncRun"("connectorId", "startedAt");

-- CreateIndex
CREATE INDEX "SyncRun_type_status_idx" ON "SyncRun"("type", "status");

-- CreateIndex
CREATE INDEX "DebugLog_type_createdAt_idx" ON "DebugLog"("type", "createdAt");

-- CreateIndex
CREATE INDEX "DebugLog_connectorId_createdAt_idx" ON "DebugLog"("connectorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "Client_name_idx" ON "Client"("name");

-- CreateIndex
CREATE UNIQUE INDEX "QboCustomer_clientId_key" ON "QboCustomer"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "QboCustomer_qboId_key" ON "QboCustomer"("qboId");

-- CreateIndex
CREATE INDEX "QboCustomer_realmId_idx" ON "QboCustomer"("realmId");

-- CreateIndex
CREATE UNIQUE INDEX "TdSynnexCustomer_clientId_key" ON "TdSynnexCustomer"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "TdSynnexCustomer_stellrId_key" ON "TdSynnexCustomer"("stellrId");

-- CreateIndex
CREATE INDEX "TdSynnexCustomer_microsoftTenantId_idx" ON "TdSynnexCustomer"("microsoftTenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TdSynnexSubscription_stellrSubscriptionId_key" ON "TdSynnexSubscription"("stellrSubscriptionId");

-- CreateIndex
CREATE INDEX "TdSynnexSubscription_customerId_idx" ON "TdSynnexSubscription"("customerId");

-- CreateIndex
CREATE INDEX "TdSynnexSubscription_productSku_idx" ON "TdSynnexSubscription"("productSku");

-- CreateIndex
CREATE UNIQUE INDEX "HuduCompany_clientId_key" ON "HuduCompany"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "HuduCompany_huduId_key" ON "HuduCompany"("huduId");

-- CreateIndex
CREATE UNIQUE INDEX "SuperOpsClient_clientId_key" ON "SuperOpsClient"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "SuperOpsClient_superOpsId_key" ON "SuperOpsClient"("superOpsId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductMapping_tdSynnexSku_key" ON "ProductMapping"("tdSynnexSku");

-- CreateIndex
CREATE INDEX "PriceRule_scope_idx" ON "PriceRule"("scope");

-- CreateIndex
CREATE INDEX "PriceRule_clientId_idx" ON "PriceRule"("clientId");

-- CreateIndex
CREATE INDEX "PriceRule_sku_idx" ON "PriceRule"("sku");

-- CreateIndex
CREATE INDEX "BillingRun_status_createdAt_idx" ON "BillingRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BillingRun_clientId_idx" ON "BillingRun"("clientId");

-- CreateIndex
CREATE INDEX "BillingLine_billingRunId_idx" ON "BillingLine"("billingRunId");

-- CreateIndex
CREATE INDEX "BillingLineEdit_billingRunId_createdAt_idx" ON "BillingLineEdit"("billingRunId", "createdAt");

-- CreateIndex
CREATE INDEX "Exception_type_status_idx" ON "Exception"("type", "status");

-- CreateIndex
CREATE INDEX "Exception_clientId_idx" ON "Exception"("clientId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "Connector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebugLog" ADD CONSTRAINT "DebugLog_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "Connector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QboCustomer" ADD CONSTRAINT "QboCustomer_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TdSynnexCustomer" ADD CONSTRAINT "TdSynnexCustomer_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TdSynnexSubscription" ADD CONSTRAINT "TdSynnexSubscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "TdSynnexCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuduCompany" ADD CONSTRAINT "HuduCompany_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuperOpsClient" ADD CONSTRAINT "SuperOpsClient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingRun" ADD CONSTRAINT "BillingRun_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingLine" ADD CONSTRAINT "BillingLine_billingRunId_fkey" FOREIGN KEY ("billingRunId") REFERENCES "BillingRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingLineEdit" ADD CONSTRAINT "BillingLineEdit_billingRunId_fkey" FOREIGN KEY ("billingRunId") REFERENCES "BillingRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingLineEdit" ADD CONSTRAINT "BillingLineEdit_billingLineId_fkey" FOREIGN KEY ("billingLineId") REFERENCES "BillingLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

