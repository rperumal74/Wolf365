# Local development & verification (Mac)

These workflows run on your machine, where the database, connector credentials,
and RAM are available — things the cloud build environment can't reach. None of
this runs in CI; the default `npm test` and `npm run build` are unaffected.

> Local dev uses **npm/npx** (corepack hit EPERM on this setup). The committed
> lockfile is pnpm; don't switch it.

---

## 1. MRR diagnostic (read-only)

Confirms how each TD SYNNEX subscription's billing frequency is turned into a
monthly figure, so you can verify the dashboard MRR line by line.

```bash
# Uses the project .env (production Neon DATABASE_URL). Read-only — never writes.
npx tsx scripts/diagnose-mrr.ts
```

What to look at in the output:
- The **billing frequency → divisor** table: any value showing `(treated as
  MONTHLY)` that is actually annual means that string needs adding to
  `billingPeriodMonths()` in `src/lib/billing/recurring.ts` — send me the value.
- **MRR (period-normalized)** is what the dashboard should show. If
  **MRR if NOT normalized** equals your old dashboard number, annual prices
  weren't being divided (the bug we fixed).

---

## 2. Integration tests (local Postgres)

Real database tests for the money paths (MRR normalization, CRM forecast). They
refuse to run unless `DATABASE_URL` points at localhost.

```bash
# One-time: install the test runner deps locally (NOT committed — pnpm updates
# your local lockfile; that's fine on your machine).
docker compose up -d                      # starts Postgres on localhost:5433

export DATABASE_URL="postgresql://wolf365:wolf365@localhost:5433/wolf365_test"
export DIRECT_URL="$DATABASE_URL"
npx prisma migrate deploy                 # apply schema to the test DB

npm run test:integration                  # runs tests/**/*.itest.ts
```

Add more integration tests as `tests/<name>.itest.ts` — they're excluded from
the default unit run automatically.

To stop/reset the DB:

```bash
docker compose down            # stop
docker compose down -v         # stop AND wipe the test data volume
```

---

## 3. End-to-end smoke tests (Playwright)

```bash
# One-time install (local only):
npm i -D @playwright/test
npx playwright install chromium

npm run test:e2e               # builds + starts the app, runs e2e/*.spec.ts
```

The included specs are unauthenticated (app boots, sign-in renders, protected
routes redirect, access-denied message). To test authenticated pages (dashboard
MRR, CRM forecast grid, creating an opportunity), add a Playwright global-setup
that seeds a test user and injects a database session cookie, then navigate to
the protected routes. Ask and I'll wire that up.

To capture screenshots for review:

```bash
npx playwright test -c e2e/playwright.config.ts --update-snapshots   # or
# add `await page.screenshot({ path: 'shot.png', fullPage: true })` in a spec
```

---

## 4. Run the app locally against sandbox connectors

```bash
# .env should hold your Neon DATABASE_URL, Entra SSO, and connector creds.
npm install
npm run db:generate
npm run dev                    # http://localhost:3000
```

- Use **sandbox** environments for QuickBooks/TD SYNNEX while testing so you
  never touch production data.
- Salesforce calls go **direct** (they bypass the static-IP proxy), so they work
  the same locally as in production.
- The QuickBooks production static-IP proxy only matters in production; locally
  you can leave `QUOTAGUARDSTATIC_URL` unset.

---

## Verification gate (before pushing)

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

`npm test` is unit-only (no DB). Run `npm run test:integration` and
`npm run test:e2e` separately when you have the local DB / browsers up.
