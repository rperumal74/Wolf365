/* Local-only demo seed for screenshots. NOT used in deployment. */
const { PrismaClient } = require("@prisma/client");
const crypto = require("node:crypto");

const prisma = new PrismaClient();

// Replicate the app's AES-256-GCM secret format (v1:iv:tag:ct).
function encryptJson(value) {
  const key = Buffer.from(process.env.WOLF365_ENCRYPTION_KEY, "base64");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
}

const now = new Date();
const ago = (h) => new Date(now.getTime() - h * 3600_000);
const addr = (l1, c, r, p) => ({ Line1: l1, City: c, CountrySubDivisionCode: r, PostalCode: p });

async function main() {
  // --- User + session (so screenshots are authenticated) ------------------
  const user = await prisma.user.create({
    data: { email: "rperumal@wolfstrata.com", name: "Rajan Perumal", role: "OWNER" },
  });
  const sessionToken = crypto.randomBytes(32).toString("hex");
  await prisma.session.create({
    data: { sessionToken, userId: user.id, expires: new Date(now.getTime() + 7 * 864e5) },
  });

  // --- Connectors ----------------------------------------------------------
  const qboConn = await prisma.connector.create({
    data: {
      type: "QUICKBOOKS_ONLINE", enabled: true, health: "HEALTHY",
      config: { environment: "production" },
      secretsEnc: encryptJson({
        clientId: "ABxQ4...redacted", clientSecret: "redacted",
        realmId: "4620816365091790000", refreshToken: "redacted",
        accessToken: "redacted", accessTokenExpiresAt: now.getTime() + 3600_000,
      }),
      lastSuccessfulSyncAt: ago(2), lastSyncDurationMs: 4120,
      lastRecordsImported: 18, lastRecordsUpdated: 64, lastRecordsSkipped: 0,
    },
  });
  const tdConn = await prisma.connector.create({
    data: {
      type: "TD_SYNNEX_STELLR", enabled: true, health: "HEALTHY",
      config: {
        environment: "production", region: "ca",
        apiBaseUrl: "https://api.stellr.tdsynnex.ca", tokenUrl: "https://api.stellr.tdsynnex.ca/oauth/token",
        customersPath: "/v1/customers", subscriptionsPath: "/v1/subscriptions",
      },
      secretsEnc: encryptJson({ clientId: "stellr-client-id", clientSecret: "redacted" }),
      lastSuccessfulSyncAt: ago(2), lastSyncDurationMs: 6890,
      lastRecordsImported: 12, lastRecordsUpdated: 31, lastRecordsSkipped: 2,
    },
  });
  await prisma.connector.create({ data: { type: "HUDU", enabled: false, health: "UNCONFIGURED" } });
  await prisma.connector.create({
    data: { type: "SUPEROPS", enabled: true, health: "DEGRADED",
      config: { subdomain: "wolfstrata", dataCenter: "us" },
      secretsEnc: encryptJson({ apiToken: "redacted" }),
      lastSuccessfulSyncAt: ago(26), lastFailedSyncAt: ago(1),
      lastError: "SuperOps GraphQL error (HTTP 429): rate limited" },
  });

  // --- Pricing -------------------------------------------------------------
  await prisma.priceRule.create({ data: { scope: "GLOBAL_MARKUP", markupPct: 20, active: true, notes: "Default MSP markup" } });

  // --- Helper to build a fully-linked client ------------------------------
  async function makeClient(opts) {
    const client = await prisma.client.create({ data: { name: opts.name, active: opts.active ?? true } });
    if (opts.qbo) await prisma.qboCustomer.create({ data: { clientId: client.id, ...opts.qbo, lastSyncedAt: ago(2) } });
    if (opts.td) {
      const td = await prisma.tdSynnexCustomer.create({ data: { clientId: client.id, ...opts.td.customer, lastSyncedAt: ago(2) } });
      for (const s of opts.td.subs ?? []) await prisma.tdSynnexSubscription.create({ data: { customerId: td.id, ...s, lastSyncedAt: ago(2) } });
      return { client, tdId: td.id };
    }
    return { client };
  }

  // Acme — clean, fully linked, with subscriptions
  const acme = await makeClient({
    name: "Acme Technologies",
    qbo: { qboId: "58", realmId: "4620816365091790000", displayName: "Acme Technologies Inc", companyName: "Acme Technologies Inc", billingEmail: "ap@acmetech.com", billingAddress: addr("120 King St W", "Toronto", "ON", "M5H 1A1"), taxable: true, taxStatus: "Taxable", currency: "CAD", paymentTerms: "Net 30", active: true },
    td: { customer: { stellrId: "C-100482", name: "Acme Technologies", domain: "acmetech.com", microsoftTenantId: "9f3c1d8a-...", serviceAddress: addr("120 King St W", "Toronto", "ON", "M5H 1A1"), active: true },
      subs: [
        { stellrSubscriptionId: "S-9001", productSku: "CFQ7TTC0LDPB", productName: "Microsoft 365 Business Premium", quantity: 42, unitCost: 20, currency: "CAD", commitmentTerm: "annual", billingFrequency: "monthly", startDate: ago(24 * 200), renewalDate: new Date(now.getTime() + 165 * 864e5), reducible: false, status: "active" },
        { stellrSubscriptionId: "S-9002", productSku: "CFQ7TTC0LH16", productName: "Exchange Online (Plan 1)", quantity: 11, unitCost: 4.8, currency: "CAD", commitmentTerm: "annual", billingFrequency: "monthly", startDate: ago(24 * 90), renewalDate: new Date(now.getTime() + 275 * 864e5), reducible: false, status: "active" },
        { stellrSubscriptionId: "S-9003", productSku: "CFQ7TTC0LF8R", productName: "Microsoft Defender for Office 365 (Plan 1)", quantity: 42, unitCost: 2.5, currency: "CAD", commitmentTerm: "monthly", billingFrequency: "monthly", startDate: ago(24 * 30), renewalDate: new Date(now.getTime() + 5 * 864e5), reducible: true, status: "active" },
      ] },
  });

  // Globex — discrepancies (name mismatch, currency mismatch, missing email)
  await makeClient({
    name: "Globex Corporation",
    qbo: { qboId: "61", realmId: "4620816365091790000", displayName: "Globex Corp", companyName: "Globex Corp", billingEmail: null, billingAddress: addr("500 Bay St", "Toronto", "ON", "M5G 2C2"), taxable: true, currency: "USD", paymentTerms: "Net 15", active: true },
    td: { customer: { stellrId: "C-100488", name: "Globex Worldwide Inc", domain: "globex.com", serviceAddress: addr("88 Queen St", "Ottawa", "ON", "K1P 1A4"), active: true }, subs: [] },
  });

  // Initech — QBO only
  await makeClient({ name: "Initech LLC", qbo: { qboId: "73", realmId: "4620816365091790000", displayName: "Initech LLC", companyName: "Initech LLC", billingEmail: "billing@initech.com", billingAddress: addr("1 Tech Way", "Austin", "TX", "78701"), taxable: false, currency: "USD", paymentTerms: "Net 30", active: true } });

  // Unlinked pair for a client-match proposal
  const umbQbo = await prisma.qboCustomer.create({ data: { qboId: "90", realmId: "4620816365091790000", displayName: "Umbrella Corp", companyName: "Umbrella Corp", billingEmail: "ap@umbrella.com", currency: "USD", active: true, lastSyncedAt: ago(2) } });
  const umbTd = await prisma.tdSynnexCustomer.create({ data: { stellrId: "C-100501", name: "Umbrella Corporation", domain: "umbrella.com", active: true, lastSyncedAt: ago(2) } });
  await prisma.clientMatchProposal.create({ data: { qboCustomerId: umbQbo.id, tdSynnexCustomerId: umbTd.id, confidence: 0.82, method: "AI_ASSISTED", status: "PROPOSED" } });

  // --- QBO items + SKU mappings -------------------------------------------
  await prisma.qboItem.createMany({ data: [
    { qboId: "201", realmId: "4620816365091790000", name: "M365 Business Premium", type: "Service", unitPrice: 24, active: true },
    { qboId: "202", realmId: "4620816365091790000", name: "Exchange Online P1", type: "Service", unitPrice: 6, active: true },
  ] });
  await prisma.productMapping.createMany({ data: [
    { tdSynnexSku: "CFQ7TTC0LDPB", qboItemId: "201", qboItemName: "M365 Business Premium", status: "CONFIRMED", method: "DETERMINISTIC", confidence: 1, reviewedAt: ago(3) },
    { tdSynnexSku: "CFQ7TTC0LH16", qboItemId: "202", qboItemName: "Exchange Online P1", status: "PROPOSED", method: "AI_ASSISTED", confidence: 0.72 },
  ] });

  // --- Billing run (Acme, reviewed) ---------------------------------------
  const run = await prisma.billingRun.create({
    data: {
      status: "REVIEWED", version: 1,
      periodStart: new Date(Date.UTC(2026, 0, 1)), periodEnd: new Date(Date.UTC(2026, 1, 1)), invoiceDate: new Date(Date.UTC(2026, 0, 1)),
      clientId: acme.client.id, createdById: user.id,
      lines: { create: [
        { description: "Microsoft 365 Business Premium", quantity: 42, unitPrice: 24, prorationFactor: 1, proratedDays: 31, periodDays: 31, discount: 0, adjustment: 0, estimatedCost: 840, taxStatus: "Taxable", subtotal: 1008, total: 1008, qboItemId: "201", tdSynnexSubscriptionId: "S-9001" },
        { description: "Exchange Online (Plan 1)", quantity: 11, unitPrice: 6, prorationFactor: 1, proratedDays: 31, periodDays: 31, discount: 0, adjustment: 0, estimatedCost: 52.8, taxStatus: "Taxable", subtotal: 66, total: 66, qboItemId: "202", tdSynnexSubscriptionId: "S-9002" },
        { description: "Microsoft Defender for Office 365 (Plan 1)", quantity: 42, unitPrice: 3, prorationFactor: 0.516129, proratedDays: 16, periodDays: 31, discount: 0, adjustment: 0, estimatedCost: 54.19, taxStatus: "Taxable", subtotal: 65.03, total: 65.03, qboItemId: null, tdSynnexSubscriptionId: "S-9003" },
      ] },
    },
  });

  // --- Exceptions ----------------------------------------------------------
  await prisma.exception.createMany({ data: [
    { type: "MISSING_BILLING_EMAIL", severity: "warning", clientId: (await prisma.client.findFirst({ where: { name: "Globex Corporation" } })).id, message: "QuickBooks customer has no billing email; invoices may not deliver." },
    { type: "CURRENCY_MISMATCH", severity: "error", clientId: (await prisma.client.findFirst({ where: { name: "Globex Corporation" } })).id, message: "Currency mismatch: QBO USD vs TD SYNNEX CAD." },
    { type: "UNMAPPED_SKU", severity: "warning", clientId: acme.client.id, message: "SKU CFQ7TTC0LF8R is not mapped to a QuickBooks item." },
  ] });

  // --- Sync runs + audit + debug logs -------------------------------------
  await prisma.syncRun.createMany({ data: [
    { connectorId: qboConn.id, type: "QUICKBOOKS_ONLINE", status: "SUCCESS", trigger: "manual", startedAt: ago(2), finishedAt: ago(2), durationMs: 4120, recordsImported: 18, recordsUpdated: 64 },
    { connectorId: tdConn.id, type: "TD_SYNNEX_STELLR", status: "SUCCESS", trigger: "cron", startedAt: ago(2), finishedAt: ago(2), durationMs: 6890, recordsImported: 12, recordsUpdated: 31, recordsSkipped: 2 },
  ] });
  await prisma.auditLog.createMany({ data: [
    { action: "LOGIN", actorId: user.id, actorEmail: user.email, metadata: { source: "database" }, createdAt: ago(3) },
    { action: "CONNECTOR_CONFIG_CHANGED", actorId: user.id, actorEmail: user.email, target: "connector:QUICKBOOKS_ONLINE", createdAt: ago(2.6) },
    { action: "SYNC_RUN", actorId: user.id, actorEmail: user.email, target: "connector:TD_SYNNEX_STELLR", metadata: { imported: 12, updated: 31, skipped: 2 }, createdAt: ago(2) },
    { action: "BILLING_RUN_CREATED", actorId: user.id, actorEmail: user.email, target: `billingRun:${run.id}`, metadata: { lines: 3 }, createdAt: ago(1) },
  ] });
  await prisma.debugLog.createMany({ data: [
    { type: "QUICKBOOKS_ONLINE", connectorId: qboConn.id, environment: "production", action: "test_connection", endpoint: "/v3/company/4620816365091790000/companyinfo/4620816365091790000", httpMethod: "GET", httpStatus: 200, durationMs: 312, correlationId: "tid-8841", authStatus: "ok", outcome: "success", createdAt: ago(2.7) },
    { type: "QUICKBOOKS_ONLINE", connectorId: qboConn.id, environment: "production", action: "sync_customers", endpoint: "/v3/company/4620816365091790000/query", httpMethod: "GET", httpStatus: 200, durationMs: 980, recordsReturned: 82, outcome: "success", createdAt: ago(2) },
    { type: "TD_SYNNEX_STELLR", connectorId: tdConn.id, environment: "production", action: "oauth_token", endpoint: "/oauth/token", httpMethod: "POST", httpStatus: 200, durationMs: 240, authStatus: "ok", outcome: "success", createdAt: ago(2) },
    { type: "SUPEROPS", environment: "us", action: "sync_clients", endpoint: "/msp", httpMethod: "POST", httpStatus: 429, durationMs: 110, rateLimited: true, retryAttempts: 2, outcome: "failure", message: "SuperOps GraphQL error (HTTP 429)", createdAt: ago(1) },
  ] });

  console.log("SEED_SESSION_TOKEN=" + sessionToken);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
