# Bingwa Portal — Administrator Setup

This document describes the first-deployment bootstrap for the Bingwa Portal control plane. The portal is the **administrative control layer**; BingwaAuto Android devices remain the execution layer for payments, USSD, SMS verification, and device automation.

## 1. Runtime requirements

Run the portal with Node.js 22 or later and a MySQL-compatible PostgreSQL-equivalent service supported by the project template. The application reads `DATABASE_URL` from the deployment environment and does not use a checked-in `.env` file.

For a Railway deployment, create a web service from this project and attach the database service. Set the application start command to `pnpm start`; the build command is `pnpm install --frozen-lockfile && pnpm build`. The server binds to the platform-provided `PORT` value.

## 2. Required environment variables

The Manus-managed OAuth and runtime variables are injected by the project environment. Do not replace them with hardcoded values or commit credentials. Confirm that the deployment has the following classes of configuration available:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | MySQL/TiDB-compatible portal database connection string |
| `JWT_SECRET` | Session cookie signing secret |
| `VITE_APP_ID` | Manus OAuth application identifier |
| `OAUTH_SERVER_URL` | OAuth callback and user profile backend |
| `VITE_OAUTH_PORTAL_URL` | Browser login portal URL |
| `OWNER_OPEN_ID` / `OWNER_NAME` | Initial project owner identity and automatic owner promotion |
| `BUILT_IN_FORGE_API_URL` / `BUILT_IN_FORGE_API_KEY` | Server-side Manus runtime services |
| `VITE_FRONTEND_FORGE_API_URL` / `VITE_FRONTEND_FORGE_API_KEY` | Client-side Manus runtime services |

Use the project’s managed secret/settings interface for secret changes. Never copy production credentials into source control, screenshots, or Android APK resources.

## 3. Database bootstrap

The TypeScript schema is in `drizzle/schema.ts`. The checked-in migrations include the portal tables and the additive operational indexes. Run the project migration workflow against the target database before the first login:

```bash
pnpm install --frozen-lockfile
pnpm drizzle-kit migrate
```

The schema includes devices, transactions, commands, subscriptions, services, users, and synchronization events. Foreign keys connect transactions, commands, subscriptions, and sync events to their owning devices; command records additionally reference the requesting administrator.

## 4. First administrator login

Open the deployed portal and complete Manus OAuth using the project owner account. The owner identity is promoted to the `admin` role by the existing user upsert path. Additional users default to `user` and cannot call administrator procedures until their role is promoted through the database administration workflow.

Admin-only operations include the operations snapshot, transaction search, device enrollment, remote command enqueueing, service status updates, and subscription updates. The browser shell should remain inaccessible to unauthorised users even when they know the application URL.

## 5. Device enrollment contract

An administrator registers a device from the Devices workspace. The portal returns a one-time enrollment token; store it securely on the intended Android device and do not expose it in logs or screenshots. The server stores only a SHA-256 token hash.

Authenticated Android synchronization procedures accept:

```text
deviceId: string
enrollmentToken: string
```

The Android client should send the token over TLS and persist it only in protected device storage. Invalid device credentials return `accepted: false` and do not write device, transaction, or sync-event data.

## 6. Heartbeat and transaction synchronization

The Android device calls the `deviceSync.heartbeat` procedure with the current device metadata, optional operational status, and up to 100 transaction records. A successful heartbeat updates online status, heartbeat/sync timestamps, SIM configuration, app version, Android version, and device identity. Transactions are associated with the enrolled device through the server-side device record, not a client-supplied owner identifier.

The portal dashboard treats `PENDING`, `PROCESSING`, and `WAITING` as open payments and treats `FAILED` as failed payments. Completed records remain visible in the transaction workspace for audit history.

## 7. Remote command lifecycle

Remote commands are created by an authenticated administrator and begin in `QUEUED` status. The Android device polls `deviceSync.pollCommands` using its device credentials. The server verifies the credentials, returns eligible commands in request order, and atomically marks each queued command as `DELIVERED`.

The Android executor reports progress with `deviceSync.reportCommand`:

```text
ACKNOWLEDGED → EXECUTING → SUCCEEDED
                         ↘ FAILED
                         ↘ EXPIRED
```

Failure and expiry may also be reported from `DELIVERED` or `ACKNOWLEDGED` when execution cannot begin. Terminal states cannot regress to an active state. Each report is scoped to both the authenticated device and command ID; a command belonging to another device is rejected.

The Android implementation must execute the command locally, then report a concise `resultMessage`. The portal does not perform USSD, SMS, accessibility, payment, or device-side transaction work itself.

## 8. Operational checks before enabling production traffic

Verify the following in a staging deployment:

1. An unauthorised browser user receives a forbidden response for operations procedures.
2. An unknown device token cannot submit a heartbeat or poll commands.
3. A registered device becomes online after a heartbeat.
4. A queued command becomes delivered only when the matching device polls.
5. Command acknowledgements and terminal results are visible in the Command Center.
6. A terminal command cannot be changed back to `EXECUTING` or another terminal state.
7. A transaction synchronized from Android appears with its package name, payment method, verification state, issue, receipt, and execution identity.
8. Mobile and desktop layouts remain usable at the target administrator viewport sizes.

The repository’s automated checks are:

```bash
pnpm check
pnpm test
pnpm build
```

## 9. Security and operating rules

Keep the portal behind HTTPS and restrict administrator access to trusted operators. Rotate enrollment tokens by re-enrolling devices when a token may have been exposed. Do not use the portal as a substitute for Android-side safeguards: ownership checks, execution identity, duplicate protection, retry policy, canonical finalization, SMS verification requirements, and Accessibility fallback remain Android responsibilities.

Before publishing a new portal version, save a project checkpoint and review the migration SQL. Do not apply destructive database changes without an explicit backup and migration plan.
