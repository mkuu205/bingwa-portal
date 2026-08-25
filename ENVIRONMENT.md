# Bingwa Portal environment and Railway deployment

The Portal is designed to build and run its unit tests without production credentials. Database-backed integration suites activate only when `DATABASE_URL` begins with `postgres://` or `postgresql://`; otherwise they are skipped safely. PayFlow is disabled in this foundation phase and no provider endpoint is contacted.

## Required production variables

| Variable | Required in production | Purpose |
|---|---:|---|
| `DATABASE_URL` | Yes | PostgreSQL connection URL with `sslmode=require`, `connection_limit`, `pool_timeout`, and `connect_timeout` parameters |
| `JWT_SECRET` | Yes | Session/signing secret |
| `APP_URL` | Yes | Canonical HTTPS Portal origin used for all backend-generated customer-facing links and production origin checks |

Production Portal: `https://portal.bingwasokoni.top`

`APP_URL` must be an HTTPS origin without a path, query string, or fragment. It is the only server-side source for customer login/registration redirects, email verification links, password-reset links, device-pairing links, applicable OAuth redirects, API origin checks, and production cookie policy. The Railway temporary hostname and localhost are development-only values and must never be used for production customer-facing links.

## Optional development variables

SMTP variables are optional until customer email delivery is configured. PayFlow variables are intentionally optional and must remain unset while payments are disabled. Never commit real values; provide them through the deployment secret manager.

## Railway

The repository includes `railway.toml`. Production Portal: `https://portal.bingwasokoni.top`. Set `APP_URL` to that exact origin in Railway Variables. Run `pnpm db:deploy` as an explicit migration operation after a pooled TLS PostgreSQL `DATABASE_URL` is configured, then start the web process with `pnpm start`. The process-only `/healthz` endpoint is available independently of database readiness; `/readyz` reports PostgreSQL readiness. The service must reject an invalid production database URL when database-backed operation is configured. Development and test execution must not fail solely because these production-only values are absent.

## PayFlow gate

Adding `PAYFLOW_BASE_URL`, `PAYFLOW_API_KEY`, `PAYFLOW_API_SECRET`, and `PAYFLOW_PAYMENT_ACCOUNT_ID` does not by itself enable payment behavior in this phase. A later implementation must add an explicit server-side feature flag, provider contract tests, payment records, status verification, idempotency, and exactly-once entitlement activation before enabling checkout.
