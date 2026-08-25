# Bingwa Portal — Administrator Setup

The Bingwa Portal is the administrative control plane. BingwaAuto Android devices remain the execution plane for payments, USSD, SMS verification, Accessibility, retries, and device automation. Mesh is a separate transport and is not used by Portal synchronization.

## 1. Runtime and Railway requirements

Run the portal with Node.js 22 or later and PostgreSQL 14 or later. The only production ORM is Prisma, and the only production database provider is PostgreSQL. The application binds to the platform-provided `PORT` value.

For Railway, create one web service and attach a PostgreSQL service. Production Portal: `https://portal.bingwasokoni.top`. Configure `APP_URL` to that exact origin in Railway Variables, then configure:

```text
Build:  pnpm install --frozen-lockfile && pnpm prisma generate && pnpm build
Start: pnpm prisma migrate deploy && pnpm start
Health: GET /healthz
```

Use a private network/database connection where available. Require `sslmode=require` in `DATABASE_URL`; use `connect_timeout` and `pool_timeout` query parameters appropriate to the Railway/PostgreSQL plan. Do not place database credentials in source control, archives, frontend variables, screenshots, or Android resources.

## 2. Required environment variables

Use the deployment secret manager. `.env.example` is a placeholder template only; never copy production values into it.

| Variable | Scope | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Server | PostgreSQL/Prisma connection string with TLS and bounded connection settings |
| `JWT_SECRET` | Server | Manus/session signing secret |
| `CUSTOMER_SESSION_SECRET` | Server | Native customer session secret |
| `APP_URL` | Server | Canonical HTTPS origin used in customer links; production is `https://portal.bingwasokoni.top` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | Server | Email verification and password recovery |
| `PAYFLOW_BASE_URL` | Server only, deferred | PayFlow API base URL; no live integration is enabled yet |
| `PAYFLOW_API_KEY` | Server only, deferred | PayFlow authentication key |
| `PAYFLOW_API_SECRET` | Server only, deferred | PayFlow authentication secret |
| `PAYFLOW_PAYMENT_ACCOUNT_ID` | Server only, deferred | PayFlow payment account identifier |
| `VITE_*` variables | Browser | Only non-secret browser configuration; never use for PayFlow or database credentials |

## 3. Database bootstrap

The authoritative schema is `prisma/schema.prisma`. Apply migrations with Prisma:

```bash
pnpm install --frozen-lockfile
pnpm prisma generate
pnpm prisma migrate deploy
```

The schema includes customers, customer sessions, email verification tokens, devices, rotated device credentials, pairing tokens, transactions, commands, products, subscriptions, payments, entitlements, audit logs, and synchronization events. PostgreSQL foreign keys and unique constraints protect ownership and payment relationships.

## 4. First administrator login

Complete Manus OAuth using the project owner account. The existing user upsert path promotes the configured owner identity to `admin`; other users default to `user`. Administrator procedures are protected by the server-side admin guard and do not require a customer subscription.

## 5. Customer authentication and recovery

Customers use native email/password registration, email verification, login, logout, and password recovery. Passwords are stored as scrypt hashes. Reset and verification tokens must be single-use, expiring, hashed at rest, and sent only through the configured SMTP server. Never log token values.

## 6. Device ownership and pairing

Customer pairing uses a single-use expiring code. The server stores only hashed pairing material, atomically consumes the code, associates the device with the customer, and rotates device credentials. Every customer-facing device query and mutation must scope the record to the authenticated customer. Administrators use separate server-side authorization.

## 7. Android synchronization

Android calls the dedicated HTTPS `deviceSync` procedures using the rotated device credential. The Portal accepts device metadata, heartbeat state, and bounded transaction projections. Android remains authoritative for transaction execution, retry, USSD, SMS verification, Accessibility fallback, and canonical finalization. The Portal does not execute USSD or SMS and does not couple to Mesh.

## 8. Remote command lifecycle

Administrators enqueue commands in `QUEUED` status. Android polls with device credentials, receives only commands for that device, and reports `ACKNOWLEDGED`, `EXECUTING`, `SUCCEEDED`, `FAILED`, or `EXPIRED`. State transitions are validated server-side and command identity is device-scoped. A Portal command must delegate to the existing Android execution owner; it must not create a second payment executor.

## 9. Products and payments

Products are database-configurable and administrator-managed. The browser may select a product, but the server must load the authoritative amount and currency from PostgreSQL. PayFlow is reserved for the website/backend only. No PayFlow call, credential, or payment implementation is enabled in this foundation milestone. Android must never receive PayFlow credentials.

When PayFlow is implemented, only server-verified completed status may activate one entitlement. Pending, failed, cancelled, malformed, or timed-out statuses must not activate an entitlement. Payment records remain separate from subscriptions and entitlement grants, with idempotency enforced by database constraints and a transactionally guarded activation flow.

## 10. Health and operational checks

The deployment health endpoint must return a lightweight process-health response without exposing secrets. PostgreSQL readiness should be checked through a bounded server-side query or deployment health check, not from the browser. Before enabling production traffic, verify:

1. `DATABASE_URL` connects over TLS and Prisma migrations apply successfully.
2. `/healthz` responds without database credentials or internal stack traces.
3. Unauthorized users receive forbidden responses for administrator procedures.
4. Unknown device credentials cannot heartbeat, poll, or report commands.
5. A matching device heartbeat updates its live dashboard state.
6. A command is delivered only to its owning device and cannot regress after a terminal state.
7. Android transaction projections are duplicate-safe and preserve execution identity.
8. Customer device queries cannot cross ownership boundaries.
9. Password reset and email verification tokens cannot be reused or disclosed.
10. Responsive layouts remain usable on supported administrator viewports.

The repository checks are:

```bash
pnpm check
pnpm test
pnpm build
```

## 11. Security rules

Keep the Portal behind HTTPS, restrict administrator access, use a secret manager, rotate credentials after any exposure, and never archive `.env`, `.project-config.json`, build output containing server configuration, or logs with tokens. Review Prisma migrations before deployment. Do not apply destructive database changes without a backup and rollback plan.
