# Wolf365

Secure Microsoft 365 billing reconciliation and invoicing staging app for MSPs.

Wolf365 syncs Microsoft 365 licensing/customer data from **TD SYNNEX StreamOne
Stellr** and customer/product/accounting data from **QuickBooks Online**, lets
accounting users review and modify pending billing (prorations, discounts,
adjustments), then pushes approved invoices back to QuickBooks Online.

> **Status: foundation.** This repository currently contains a complete,
> non-faked foundation. The connector framework performs **real** API calls,
> nothing is stubbed, and unverified API details fail visibly rather than
> pretending to work. See [Implemented vs. pending](#implemented-vs-pending).

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

## Implemented vs. pending

**Implemented (this foundation):**
- Project scaffold, security headers, env validation, instrumentation
- Full Prisma data model + initial migration
- AES-256-GCM encryption (unit-tested) and redaction (unit-tested)
- RBAC with 4 roles; server-side enforcement
- Auth.js Entra SSO with domain allowlist + group->role mapping
- Connector framework: typed defs, retrying HTTP client, debug logging,
  test/sync lifecycle, health + sync-run tracking
- Connectors: QBO (OAuth + customer sync), TD SYNNEX (auth + test), Hudu,
  SuperOps
- App shell (tall left nav, lower-left account/status panel, main area)
- Admin: connectors UI (configure/test/sync/enable), Security & SSO, audit log,
  debug logs
- Honest list pages: clients, billing, mappings, exceptions, reports
- Vercel Cron: scheduled syncs + debug-log retention purge

**Pending (next milestones):**
- QBO OAuth "Connect QuickBooks" callback route + item sync + invoice push
- TD SYNNEX customer/subscription field mapping against verified response schema
- Client profile with side-by-side QBO/TD SYNNEX comparison + discrepancy flags
- AI-assisted client mapping + SKU mapping dashboards
- Billing run generation, proration/adjustment engine, pre-push report, push
- Report computations + CSV/Excel export

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
