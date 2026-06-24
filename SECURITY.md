# Wolf365 — Security Overview

How Wolf365 meets the security requirements for an Intuit QuickBooks Online
production app (and general OWASP best practices). Useful for Intuit's app
review / security questionnaire.

## Transport security
- **HTTPS/TLS only.** Hosted on Vercel, which terminates TLS 1.2/1.3 and
  redirects HTTP→HTTPS. `Strict-Transport-Security` (HSTS) is sent on every
  response (`next.config.ts`).
- **OAuth redirect URIs are HTTPS** (`/api/connectors/quickbooks/callback`).
- Outbound API calls can be pinned to a **static egress IP** via a proxy
  (`OUTBOUND_PROXY_URL`/`QUOTAGUARDSTATIC_URL`) for IP allowlisting.

## OAuth token handling (QuickBooks)
- **Tokens are encrypted at rest** with AES‑256‑GCM (`src/lib/crypto.ts`) before
  storage in Neon Postgres; only stored in `*Enc` columns. Layered on top of
  Neon's encryption at rest.
- **Never stored client-side** and never returned to the browser — secret view
  models expose only "is set" booleans (`src/lib/connectors/service.ts`).
- **Access tokens refreshed** on demand; **refresh-token rotation** honored
  (latest token persisted) (`src/connectors/quickbooks/oauth.ts`).
- **CSRF protection** on the OAuth flow via a random `state` in an HTTP‑only
  cookie, validated with a constant-time compare on callback.
- **Token revocation on disconnect** — `/api/connectors/quickbooks/disconnect`
  calls Intuit's `/v2/oauth2/tokens/revoke` and clears stored tokens.
- **Least privilege scope** — only `com.intuit.quickbooks.accounting`.

## Authentication & access control
- **SSO via Microsoft Entra ID** (Auth.js v5); MFA/lockout enforced by Entra.
- **Database-backed sessions**: HTTP‑only, `Secure` (production), `SameSite`
  signed cookies; 8‑hour expiry.
- **RBAC enforced server-side** on every sensitive action (`src/lib/rbac.ts`,
  `requirePermission`). The UI only hides what a role cannot do.

## Application security (OWASP)
- **Input validation** with Zod on server actions/forms.
- **Injection**: Prisma parameterized queries throughout; no raw SQL with user
  input.
- **CSRF**: Next.js server actions are same-origin; OAuth uses `state`.
- **Security headers** (`next.config.ts`): `Content-Security-Policy`,
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, `Permissions-Policy`, HSTS, `poweredByHeader` disabled.
- **Rate limiting** on sensitive endpoints (OAuth connect/callback/disconnect,
  cron, API probe) via a DB-backed fixed-window limiter (`src/lib/rate-limit.ts`).
- **Error handling**: production hides stack traces; connector errors are
  redacted before display/logging.

## Secrets & logging
- **No secrets in logs.** The connector debug logger and `src/lib/redact.ts`
  strip secrets, tokens, auth codes, headers, and query strings; bearer tokens
  are scrubbed from error messages.
- App secrets (`WOLF365_ENCRYPTION_KEY`, `AUTH_SECRET`, OAuth client secrets)
  live only in environment variables / encrypted columns — never in code.
- **Audit log** (append-only) records logins, connector/SSO changes, syncs,
  mappings, billing edits, approvals, QBO pushes, and exports.
- **Debug-log retention** purge (default 30 days) via Vercel Cron.

## Dependency & operational hygiene
- `pnpm audit` is clean (no known vulnerabilities); dependencies patched
  (e.g. next-auth ≥ beta.30, postcss ≥ 8.5.10).
- Schema changes ship as migrations auto-applied via GitHub Actions.
- Environment is validated at startup (`src/env.ts`); the app fails fast on
  misconfiguration rather than running insecurely.

## Data handling
- Only the QBO/TD SYNNEX data required for reconciliation and invoicing is
  stored. Disconnecting QuickBooks revokes the token and clears the connection.
- Customer-sensitive fields are not written to debug logs.

## Reporting
Security issues: contact the repository owner (rperumal@wolfstrata.com).
