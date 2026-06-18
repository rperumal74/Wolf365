-- SuperOps billing pipeline: imported invoices + lines.
CREATE TABLE "SuperOpsInvoice" (
    "id" TEXT NOT NULL,
    "superOpsId" TEXT NOT NULL,
    "clientId" TEXT,
    "superOpsClientName" TEXT,
    "invoiceNumber" TEXT,
    "status" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "currency" TEXT,
    "subtotal" DECIMAL(18,4),
    "tax" DECIMAL(18,4),
    "total" DECIMAL(18,4),
    "raw" JSONB,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "qboInvoiceId" TEXT,
    "pushedAt" TIMESTAMP(3),
    "pushError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SuperOpsInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SuperOpsInvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "qboItemId" TEXT,
    "raw" JSONB,
    CONSTRAINT "SuperOpsInvoiceLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SuperOpsInvoice_superOpsId_key" ON "SuperOpsInvoice"("superOpsId");
CREATE INDEX "SuperOpsInvoice_reviewStatus_idx" ON "SuperOpsInvoice"("reviewStatus");
CREATE INDEX "SuperOpsInvoice_clientId_idx" ON "SuperOpsInvoice"("clientId");
CREATE INDEX "SuperOpsInvoiceLine_invoiceId_idx" ON "SuperOpsInvoiceLine"("invoiceId");

ALTER TABLE "SuperOpsInvoice" ADD CONSTRAINT "SuperOpsInvoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SuperOpsInvoiceLine" ADD CONSTRAINT "SuperOpsInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SuperOpsInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
