# Bingwa Portal API Contract

## Android device authentication

Android devices authenticate device-sync mutations with the current rotated `DeviceCredential` token in the request body. The legacy `enrollmentToken` field remains accepted only for migration compatibility. Credentials are verified server-side by hash; neither credential form is exposed to browser code.

## tRPC procedures

All procedures are POST requests under `/api/trpc` and use the standard tRPC JSON envelope `{ "json": input }`.

| Procedure | Purpose |
|---|---|
| `deviceSync.pairDevice` | Consumes an unexpired pairing code and secret exactly once, claims the device for the customer, rotates active credentials, and returns the new device token once. |
| `deviceSync.heartbeat` | Updates device health/SIM metadata and upserts recent Android transaction projections. |
| `deviceSync.pollCommands` | Returns bounded queued commands and advances them to `DELIVERED`. |
| `deviceSync.reportCommand` | Accepts `ACKNOWLEDGED`, `EXECUTING`, `SUCCEEDED`, `FAILED`, or `EXPIRED` reports subject to the server command state machine. |

The Android client accepts either a normal single-call tRPC response object or a one-element response array. HTTP error bodies are not forwarded into application logs.

## Pairing

The customer generates a single-use, expiring pairing code. The Android app supplies the normalized code, a generated pairing secret, and a device snapshot. On success, the server returns `deviceId` and a rotated opaque `deviceToken`. Android stores these values using encrypted preferences. A device already owned by another customer is rejected, and re-pairing revokes prior active credentials before issuing the new token.

## Heartbeat projections

Heartbeat transactions are projections of the Android Room database. Android remains authoritative for USSD, SMS, Accessibility, payment execution, retries, and local accounting. The server updates an existing device-scoped record when `androidTransactionId` matches; otherwise it creates a projection. Repeated heartbeats therefore do not intentionally create duplicates for the same device transaction.

Projection fields include the Android transaction identifier, `executionId`, `operationId`, customer/phone/package data, amount, payment method, lifecycle status, verification data, receipt, issue, and execution timestamp. The Portal must not infer payment completion from a browser request or a projection alone.

## Command lifecycle

Command polling and reporting are separate from Mesh. The Portal queues commands for a specific enrolled device. Android acknowledges receipt, and the eventual execution adapter must report `EXECUTING` followed by `SUCCEEDED`, `FAILED`, or `EXPIRED`. The Android Portal worker does not execute USSD, SMS, Accessibility, payment, or Mesh work directly.

## Production requirements

Use HTTPS only. Do not put PayFlow credentials in Android payloads, browser bundles, or device logs. Product prices must be configured by an authorized administrator and supplied by the owner; no initial prices are inferred by this contract. PayFlow implementation remains deferred until the environment contains verified server-only credentials.
