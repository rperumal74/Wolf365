# Wolf365

Secure Microsoft 365 billing reconciliation and invoicing staging app for MSPs.

Wolf365 syncs Microsoft 365 licensing/customer data from **TD SYNNEX StreamOne
Stellr** and customer/product/accounting data from **QuickBooks Online**, lets
accounting users review and modify pending billing (prorations, discounts,
adjustments), then pushes approved invoices back to QuickBooks Online.

> **Status: feature-complete, deployment-ready.** End-to-end flows are
> implemented — connector configure/test/sync, QBO OAuth + invoice push,
> AI-assisted client/SKU mapping, discrepancy detection, billing-run generation
> with proration, the pre-push report, and reconciliation reports with CSV
> export. Connectors perform **real** API calls; where a live API's exact
> response schema isn't publicly verifiable (TD SYNNEX Stellr), field mapping is
> defensive across common envelopes and unverified endpoints fail visibly rather
> than being faked. See [Feature status](#feature-status).

## Tech stack

| Concern        | Choice                                                        |
| -------------- | ------------------------------------------------------------- |
| Framework      | Next.js (App Router) + TypeScript                             |
| Database       | Neon Postgres via **Prisma** ORM                              |
| Auth           | Auth.js v5 + Microsoft Entra ID SSO (admin-configurable)      |
| UI             | Tailwind CSS, lucide-react icons                              |
| Validation     | Zod                                                           |
| Encryption     | AES-256-GCM app-level encryption for connector secrets        |
| Deployment     | Vercel (env vars + Vercel Cron for scheduled syncs)           |

### Why Prisma (not Drizzle)

The data model is relational and migration-heavy (auth, connectors, billing
runs with versioned line edits, mappings). Prisma's declarative schema +
first-class migration tooling and its mature Neon support make it the cleaner,
more maintainable fit here.

## Architecture

```
src/
  env.ts                     # Zod-validated environment (fail-fast at startup)
  instrumentation.ts         # validates env on server boot
  auth.ts                    # Auth.js config: dynamic Entra provider from DB
  lib/
    crypto.ts                # AES-256-GCM encrypt/decrypt for secrets/tokens
    db.ts                    # Prisma client singleton
    rbac.ts                  # roles -> explicit permissions, server-side checks
    audit.ts                 # append-only security audit log
    redact.ts                # redaction helpers (default-deny on secrets)
    debug-log.ts             # redaction-enforcing connector debug logger
    auth/                    # SSO resolution + session/permission helpers
    connectors/service.ts    # admin view models (never returns secret values)
  connectors/
    types.ts                 # ConnectorDefinition contract
    http.ts                  # retrying fetch + per-call debug logging
    runtime.ts               # test/sync lifecycle, health + sync-run tracking
    registry.ts              # connector registry
    quickbooks/ tdsynnex/ hudu/ superops/
  app/
    (app)/                   # authenticated shell + pages
    signin/                  # Entra SSO sign-in (honest empty state if unset)
    api/auth/[...nextauth]/  # Auth.js handlers
    api/cron/                # Vercel Cron: scheduled syncs + log retention
prisma/schema.prisma         # full data model
prisma/migrations/           # initial migration SQL
```

### Security model

- **In transit:** HTTPS/TLS everywhere (Vercel-terminated); HSTS + hardened
  security headers in `next.config.ts`.
- **At rest:** Neon encryption at rest **plus** app-level AES-256-GCM
  encryption for every connector secret and OAuth token before it touches the
  database. Secrets live only in `*Enc` columns.
- **RBAC:** enforced server-side via `requirePermission` in every sensitive
  server action; the UI only hides what a user cannot do.
- **Sessions:** database-backed, HTTP-only, signed cookies; `secure` in prod.
- **Logging:** the debug logger and `redact.ts` strip secrets, tokens, auth
  codes, headers, and query strings. No secret can be persisted to logs.
- **Auditing:** logins, connector/SSO changes, syncs, mappings, billing edits,
  approvals, pushes, and exports are recorded append-only.

## Local setup

```bash
pnpm install
cp .env.example .env.local         # fill in the values
pnpm exec prisma migrate deploy    # apply schema to your Neon database
pnpm dev
```

Generate the two app-level secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### First-run admin bootstrap

SSO is admin-configurable in-app, which creates a chicken-and-egg problem on a
fresh install. To bootstrap, set `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`,
`ENTRA_CLIENT_SECRET`, and `WOLF365_BOOTSTRAP_ADMINS` (your email) in the
environment. Sign in once; you'll be granted **Owner**, then configure SSO
properly under **Security & SSO**.

## Connectors

Every connector exposes: configure screen, encrypted credential storage,
enable/disable, **Test Connection** (real call), **Sync Now** (real call),
last success/failure, last error, health, duration, and record counts — all
recorded in the audit + debug logs.

| Connector            | Auth                          | Notes |
| -------------------- | ----------------------------- | ----- |
| QuickBooks Online    | OAuth 2.0 (auth-code)         | Token refresh + rotation; CompanyInfo probe; customer sync. |
| TD SYNNEX Stellr     | OAuth 2.0 (client-credentials)| Admin supplies region base URL + token URL from the Developer Portal. |
| Hudu                 | `x-api-key`                   | Read-only company sync for mapping. |
| SuperOps             | GraphQL Bearer + subdomain    | Read-only client sync for mapping. |

> **Honesty rule in action:** the precise TD SYNNEX Stellr resource paths are
> documented in the partner-gated API reference. Rather than invent endpoints,
> the connector authenticates for real (proving credentials) and requires the
> verified base/token/resource paths from the admin; sync **fails visibly** if
> they are absent. Wiring the exact Stellr customer/subscription response field
> mapping is the next step once those verified paths are provided.

## Feature status

**Implemented:**
- Scaffold, security headers + CSP, env validation, instrumentation
- Full Prisma data model + migration (auth, connectors, clients/sources,
  mappings, pricing, versioned billing runs, exceptions, QBO items)
- AES-256-GCM encryption, redaction, RBAC, Entra SSO — all enforced server-side
- Connector framework + four connectors with real configure/test/sync:
  - **QuickBooks Online** — OAuth 2.0 connect, token refresh/rotation, customer
    + item sync, **real invoice push** (approve-gated, partial-failure handling)
  - **TD SYNNEX Stellr** — client-credentials auth, customer + subscription sync
    (defensive field mapping; unverified endpoints fail visibly)
  - **Hudu** (x-api-key) and **SuperOps** (GraphQL) — read-only sync for mapping
- AI-assisted mapping: deterministic + confidence-scored client and SKU
  proposals, mapping dashboard, confirm/reject, auto-confirm on exact matches
- Discrepancy detection + reconciliation into the exception queue
- Client profile with side-by-side QBO/TD SYNNEX boxes + live discrepancy flags
- Billing-run generation (proration/pricing engine), pre-push report with
  push-eligibility, state machine, QBO push, billing-run history
- Reports: margin, revenue leakage, overbilling risk, change explanation;
  CSV/Excel export for reports, exceptions, and billing runs
- Vercel Cron: scheduled syncs + reconciliation + debug-log retention purge
- 47 unit tests (encryption, redaction, proration, pricing, line math, state
  machine, generation, similarity, discrepancies)

**Known pragmatic limitations (by design / pending live verification):**
- TD SYNNEX Stellr response field names are mapped defensively across common
  envelopes; confirm against your region's API reference once available.
- "AI" mapping confidence is a transparent token-similarity heuristic, not an
  LLM call (deterministic, explainable, no external dependency).
- Line-item inline editing UI and bulk multi-client run selection are not yet
  surfaced (the engine and per-run model support them).

## Deployment (Vercel + Neon)

1. **Neon**: create a project; copy the **pooled** connection string to
   `DATABASE_URL` and the **direct** one to `DIRECT_URL`.
2. **Apply schema**: `pnpm exec prisma migrate deploy` (run locally against the
   Neon DB, or as a Vercel build/deploy step).
3. **Vercel**: import the repo. Set environment variables (Production +
   Preview): `DATABASE_URL`, `DIRECT_URL`, `WOLF365_ENCRYPTION_KEY`,
   `AUTH_SECRET`, `AUTH_URL` (your deployment URL), `CRON_SECRET`, and the
   first-run `ENTRA_*` + `WOLF365_BOOTSTRAP_ADMINS` values.
4. **Build**: the `build` script runs `prisma generate && next build`. The cron
   schedule in `vercel.json` calls `/api/cron` daily (authenticated by
   `CRON_SECRET`).
5. **Entra app registration**: add redirect URIs
   `https://<your-app>/api/auth/callback/microsoft-entra-id` (SSO) — sign in as
   a bootstrap admin, then finalize SSO under **Security & SSO**.
6. **QuickBooks app**: add redirect URI
   `https://<your-app>/api/connectors/quickbooks/callback`, enter the client
   id/secret in the connector, then click **Connect QuickBooks**.

## Scripts

```bash
pnpm dev          # local dev server
pnpm build        # prisma generate + next build
pnpm typecheck    # tsc --noEmit
pnpm lint         # next lint
pnpm test         # vitest
pnpm db:migrate   # prisma migrate dev
pnpm db:deploy    # prisma migrate deploy
```
