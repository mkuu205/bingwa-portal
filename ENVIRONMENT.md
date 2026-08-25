# Bingwa Portal environment and Railway deployment

The Portal is designed to build and run its unit tests without production credentials. Database-backed integration suites activate only when `DATABASE_URL` begins with `postgres://` or `postgresql://`; otherwise they are skipped safely. PayFlow is disabled in this foundation phase and no provider endpoint is contacted.

## Required production variables

| Variable | Required in production | Purpose |
|---|---:|---|
| `DATABASE_URL` | Yes | PostgreSQL connection URL with `sslmode=require`, `connection_limit`, `pool_timeout`, and `connect_timeout` parameters |
| `JWT_SECRET` | Yes | Session/signing secret |
| `APP_BASE_URL` | Yes | Canonical HTTPS Portal URL |

## Optional development variables

SMTP variables are optional until customer email delivery is configured. PayFlow variables are intentionally optional and must remain unset while payments are disabled. Never commit real values; provide them through the deployment secret manager.

## Railway

The repository includes `railway.toml`. Railway should run the Prisma migration command before starting the server, provide a pooled TLS PostgreSQL `DATABASE_URL`, and expose `/healthz` for health checks. The service must terminate startup in production when the database URL is not PostgreSQL/TLS/pool configured. Development and test execution must not fail solely because these production-only values are absent.

## PayFlow gate

Adding `PAYFLOW_BASE_URL`, `PAYFLOW_API_KEY`, `PAYFLOW_API_SECRET`, and `PAYFLOW_PAYMENT_ACCOUNT_ID` does not by itself enable payment behavior in this phase. A later implementation must add an explicit server-side feature flag, provider contract tests, payment records, status verification, idempotency, and exactly-once entitlement activation before enabling checkout.
