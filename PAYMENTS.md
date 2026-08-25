# Bingwa Portal payments

## Current status

Live PayFlow integration is intentionally **deferred**. The Portal currently provides configurable device and subscription products, but it does not initiate STK Push requests, poll PayFlow status, or activate entitlements from payment responses.

## Approved architecture

When payment implementation is authorized, all PayFlow calls must remain in the server runtime. The browser and Android client must never receive `PAYFLOW_API_KEY`, `PAYFLOW_API_SECRET`, or other provider credentials. The browser may submit only a product identifier and normalized customer phone number; the server must load the product price from PostgreSQL and ignore any browser-supplied amount or payment status.

Bingwa payment records must be stored separately from subscriptions and device entitlements. A payment may activate an entitlement only after the server independently verifies a completed PayFlow status, inside a database transaction protected by an idempotency key. Pending, failed, cancelled, or ambiguous provider states must not activate an entitlement.

## Required environment configuration

Configure these server-only variables through the deployment secret manager after the PayFlow contract and credentials are verified:

| Variable | Purpose |
|---|---|
| `PAYFLOW_BASE_URL` | PayFlow API v2 base URL |
| `PAYFLOW_API_KEY` | Server-side provider authentication key |
| `PAYFLOW_API_SECRET` | Server-side provider authentication secret |
| `PAYFLOW_PAYMENT_ACCOUNT_ID` | Provider payment account identifier |

No real values belong in source control, archives, frontend bundles, tests, or documentation.

## Required provider flows

The eventual implementation must use the documented server-side `POST /api/v2/stkpush.php` request and `POST /api/v2/status.php` verification request. It must normalize and validate phone numbers, use bounded polling with explicit timeout handling, persist provider identifiers, and record all state changes in the audit log. Provider responses must be treated as untrusted input and mapped to the Portal payment state machine through allow-listed statuses.

## Verification gates before activation

Before enabling live payments, configure and validate the PostgreSQL environment, confirm the PayFlow request and response contract against the provider documentation, add server-only credential tests, add duplicate-request/idempotency tests, add pending/failed/cancelled non-activation tests, and run a controlled sandbox payment. Do not enable payment UI or entitlement activation until those tests pass.
