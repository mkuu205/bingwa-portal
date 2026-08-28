# Bingwa Portal Operational Repair Diagnostic

## Device connection

The heartbeat endpoint authenticates the device and unconditionally writes `status = online`, `lastHeartbeatAt = now`, and `lastSyncAt = now`. The database does not continuously recompute stale state, and several reads trust the persisted enum instead of deriving online status from a recent authenticated heartbeat. The Android sync worker is periodic, while Portal commands use short expirations, so a background phone can appear disconnected or miss commands between syncs. The repair must use a shared freshness threshold for reads and keep the persisted heartbeat as the source of truth.

## Transaction synchronization

The server-side heartbeat projection and deduplication path exists and is covered by a lifecycle integration test. The customer dashboard currently fetches only a small projected subset of transaction fields and limits history to 50 rows. The Home empty state and Transactions empty state still use subscription state to decide whether to show transaction-history messaging, which incorrectly hides operational history when a subscription is absent or expired. Counts also collapse processing, scheduled, skipped, and cancelled semantics into a small four-count object.

## Command execution

The Portal creates authenticated, customer-owned commands and Android polls them through `pollCommands`. The server lifecycle correctly requires delivery/acknowledgement/execution transitions and normalizes Android `COMPLETED` to `SUCCEEDED`. The current installed Android contract must still be upgraded to execute the newer plan-sync, airtime, automation, USSD, and token operations; inserting a PostgreSQL command alone is not execution. Command status UI must therefore poll and display the command lifecycle rather than showing queued as completed.

## USSD

The Portal can queue a command, but actual telephony execution remains Android-only. The old Android dispatcher does not support the Portal manual USSD command, and the Android worker's periodic polling means the command cannot execute immediately unless the updated dispatcher and sync path are installed. The correct repair is an Android-side adapter to the existing USSD service plus result reporting; the Portal must never dial USSD.

## Data Plans

The Portal accepts and upserts device plans, but plans only appear when Android includes `dataPlans` in an authenticated heartbeat. The updated Android source now supplies the local plan inventory and can request an immediate post-command heartbeat. The Portal must display enabled and disabled plans separately and must not label an online phone offline merely because the plan table is empty.

## Authentication

Customer authentication is native, email-normalized, scrypt-backed, session-cookie based, and independent of OAuth. No evidence in the current router requires Manus OAuth for customer login. Authentication should remain unchanged while customer ownership checks continue to scope every device, transaction, plan, and command query.

## Subscription versus operations

The main logic defect is UI-level subscription gating of operational history. Subscription controls entitlement and pairing allowance; device transactions, synchronized plans, telemetry, and commands are separate operational records. Subscription CTAs must only gate subscription-dependent operations and must never replace or suppress existing transaction history.
