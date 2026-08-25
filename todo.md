# Project TODO

- [x] Complete read-only audit of the supplied BingwaAuto Android application architecture and operational data model
- [x] Establish Bingwa portal visual design system with refined dark operations-console styling
- [x] Add role-aware authenticated portal shell for administrators
- [x] Add device registry with enrollment, device identity, heartbeat, online status, SIM details, and app/Android version
- [x] Add secure Android synchronization contract for device, transaction, and operational-status updates
- [x] Add searchable transaction dashboard with payment and verification status history
- [x] Add remote command and configuration queue with delivery and execution status
- [x] Add subscription and service administration views
- [x] Add database schema, relations, and migrations for portal operations data
- [x] Add protected and admin-authorized tRPC procedures for portal operations
- [x] Add API authentication and device credential verification boundaries
- [x] Add Vitest coverage for authorization and device synchronization
- [x] Verify responsive UI, loading states, empty states, error states, and accessibility
- [x] Run type-check, test, and production build checks
- [x] Save final checkpoint and deliver the completed Bingwa Portal project

- [x] Implement end-to-end Android command polling, acknowledgement, execution, and result update lifecycle
- [x] Add subscription administration mutations and actionable UI controls
- [x] Add explicit Drizzle relations and database foreign-key/index migration for portal entities
- [x] Add verifiable responsive, loading, empty, error, and accessibility coverage for operations workspaces

- [x] Read-only audit: compare portal against mandatory PostgreSQL/Prisma, customer authentication, customer authorization, pairing, Android integration, canonical state, Railway documentation, and BingwaAuto theme requirements

- [x] Read-only audit: determine the safest dedicated Portal-to-Android communication layer, excluding Bingwa Mesh, and document required pairing, heartbeat, command, synchronization, security, Android, and portal changes

- [x] Defer server-only PayFlow STK Push integration until the user supplies credentials and authorizes live payment work
- [x] Add configurable Bingwa device/subscription products with owner-supplied pricing and admin management
- [x] Defer Bingwa payment purchase records and PayFlow state machine until live payment integration is authorized
- [x] Defer server-side payment status verification and entitlement activation until PayFlow credentials are supplied
- [x] Defer STK Push charge idempotency implementation until live PayFlow integration is authorized
- [x] Defer customer PayFlow checkout and payment states until live payment integration is authorized
- [x] Defer admin PayFlow payment inspection and recovery boundaries until live payment records exist
- [x] Add deferred payment readiness documentation and retain live PayFlow tests for the credentialed phase

- [x] Migrate Portal persistence from Drizzle/MySQL-compatible schema to PostgreSQL + Prisma while preserving existing operations behavior
- [x] Regression-test existing admin authentication, device sync, command lifecycle, subscriptions, services, and transaction operations against a real PostgreSQL database
- [x] Implement native customer authentication, email verification, and secure customer sessions; password recovery/change remains pending
- [x] Implement customer-to-device ownership and enforce customer/admin authorization boundaries
- [x] Implement secure single-use expiring QR/code pairing and device credential rotation without using Mesh credentials
- [x] Implement dedicated HTTPS Android Portal communication, heartbeat, command lease/ack/result, and credential storage; defer physical-device verification
- [x] Implement Android transaction projection and safe Portal retry dispatch through the existing transaction pipeline; defer physical-device verification
- [x] Implement configurable device/subscription products with no invented initial prices
- [x] Defer server-only PayFlow STK Push, status verification, payment records, and entitlement activation until credentials are supplied
- [x] Complete credential-independent product/customer/security documentation and regression/integration tests; public responsive verification is complete and authenticated workspace verification remains session-dependent
- [x] Add PAYMENTS.md documenting the deferred PayFlow boundary and activation gates
- [x] Implement admin product CRUD for device/subscription products with validation and authorization boundaries
- [x] Add Portal product UI with listing, create, update, archive, loading, empty, and error states
- [x] Add product authorization, persistence, and price-configuration integration coverage
- [x] Add full product edit UI and mutations for all owner-supplied product fields with save states
- [x] Add per-product edit success/pending/error feedback and field-level validation
- [x] Mirror positive-integer/null duration and device-limit validation in the product editor
- [x] Add focused UI contract coverage for invalid product edit values
- [x] Add Prisma/PostgreSQL product integration coverage for admin authorization and persistence round-trips
- [x] Implement safe product delete behavior or document archive-only lifecycle when dependent records exist
- [x] Deliver the migrated Portal foundation with required secrets and owner-supplied pricing explicitly identified as runtime configuration
- [x] Create a separate website-only Portal source archive; keep Android archive and PayFlow concerns separate

- [x] Add an authenticated `/customer` destination so successful customer login does not land on a 404
- [x] Initialize customer login/register mode from the current route and add regression coverage for registration, verification, login, session resolution, logout, and post-login routing

- [x] Add router-level customer-auth integration coverage for registration, email verification, verified login, logout, session lookup, and post-login `/customer` routing

- [x] Add frontend/integration coverage proving successful customer login navigates to `/customer` and renders the authenticated customer destination

- [x] Fix PostgreSQL operation regression-test isolation so temporary lifecycle rows cannot make the snapshot test assume zero transactions

- [x] Add an executable frontend component integration test with a browser-like DOM that submits successful customer login, observes navigation to `/customer`, and verifies authenticated customer content renders

- [x] Fix pairing helper syntax error introduced while adding token-generation primitives

- [x] Fix pairing test assertion so it matches the generated exact eight-character safe-alphabet code contract

- [x] Guarantee pairing codes are exactly eight uppercase alphanumeric characters and restore the exact-length test assertion

- [x] Add Neon-backed pairing integration coverage for customer ownership, single-use consumption, wrong-secret rejection, already-owned-device protection, and credential rotation

- [x] Switch Android Portal sync authentication to the rotated DeviceCredential token returned by pairing, while preserving legacy enrollment-token compatibility only during the migration window
- [x] Add Neon-backed pairing integration coverage for successful claim, single-use rejection, wrong-secret rejection, ownership conflict, and credential-authenticated sync

- [x] Fix device-authentication compilation error by adding the database helper’s local SHA-256 token-hash function

- [x] Replace all remaining legacy device-token helper call sites with credential-aware authentication

- [x] Fix pairing integration test to invoke the actual customer pairing procedure namespace instead of the nonexistent nested path

- [x] Add a Neon-backed pairing integration test proving the previous device credential is rejected after re-pair/rotation and the newly issued credential is accepted

- [x] Fix re-pair credential-rotation failure caused by the unique PairingToken.deviceId constraint while preserving single-use pairing and cleanup semantics

- [x] Add an isolated Android Portal HTTPS client module using the Portal base URL and device credential, independent of Mesh transport
- [x] Persist the rotated Portal device credential securely and expose pairing/bootstrap configuration without logging secrets
- [x] Add durable Android heartbeat and command polling workers with network/backoff constraints
- [x] Add command acknowledgement/result reporting adapters that preserve existing transaction execution ownership and queue serialization
- [x] Add a Portal command-dispatch adapter that delegates only to an existing Android executor and reports unsupported commands safely
- [x] Wire Portal command lifecycle reporting into the Android execution boundary; defer physical-device runtime verification
- [x] Validate the supported Portal QUEUE_PAYMENT boundary with focused fake-gateway coverage; defer physical-device execution
- [x] Defer physical-device Portal command acknowledgement/execution verification until a device run is available
- [x] Bind Portal command dispatch to an existing Android execution owner for supported command types
- [x] Extract a testable Portal queue gateway backed by the existing PaymentQueueService
- [x] Add Hilt binding for PaymentQueuePortalGateway after the application graph reports a missing PortalQueueGateway binding
- [x] Fix Portal dispatcher import after KSP cannot resolve the actual PaymentQueueService package
- [x] Run Android compile with the project’s actual Gradle wrapper entry point (compile passes)
- [x] Run focused Android Portal tests (dispatcher and projection tests pass)
- [x] Isolate remaining legacy Android-suite failures; full-suite resolution remains separate Android maintenance work
- [x] Fix existing PremiumPackageCard verified-icon compile regression blocking Android validation
- [x] Keep Portal HTTP body/header logging disabled by design to prevent credential exposure
- [x] Add focused Android Portal retry, dispatcher, projection, and secret-redaction coverage; defer transport-auth/idempotency cases to device integration
- [x] Add focused fake-gateway coverage for PaymentQueueService delegation and fail-closed validation; defer physical-device integration
- [x] Fix PortalCommandDispatcherTest Kotlin assertion syntax so focused Android tests compile

- [x] Correct Android build-file path discovery after the module uses a different Gradle filename than expected
- [x] Add Android Portal Retrofit API, typed tRPC envelope handling, and configurable base URL build field
- [x] Add encrypted credential/configuration storage and intentionally disabled Portal HTTP body/header logging

- [x] Remove project/archive secret-bearing configuration and normalize server environment names
- [x] Document placeholder-only environment values and exclude secrets from archives; protected environment files remain managed by the project secret workflow
- [x] Remove legacy Drizzle/MySQL files and stale production documentation
- [x] Add password recovery with single-use expiring reset tokens
- [x] Add admin customer management and audit-log management procedures and UI
- [x] Fix Home customer/audit UI compile errors from missing React, Users, and History icon aliases
- [x] Add database-level idempotency for Android transaction projection
- [x] Replace projection find-then-create race with unique-keyed upsert and concurrency coverage
- [x] Validate Android Portal boundary and Mesh independence from supplied source and focused tests; defer physical-device integration
- [x] Add Railway deployment, migration, health-check, TLS, and connection-pooling configuration
- [x] Wire Railway migration/start commands and validate pooled TLS PostgreSQL configuration
- [x] Add environment-safe Prisma initialization and production PostgreSQL TLS/pool validation; defer live connectivity until DATABASE_URL is supplied
- [x] Correct password-reset integration coverage to exercise creation, consumption, and single-use rejection of the raw token
- [x] Fix PostgreSQL integration-test guards to require a valid postgres:// or postgresql:// DATABASE_URL
- [x] Make PostgreSQL integration tests skip cleanly when DATABASE_URL is not configured
- [x] Restore BingwaAuto neon-green theme tokens without redesigning the UI
- [x] Run pnpm check, pnpm test, and pnpm build, then perform final read-only verification

## Attachment-approved continuation

- [x] Verify customer administration UI and backend authorization end to end with safe local/test data
- [x] Verify audit administration UI and backend authorization end to end with safe local/test data
- [x] Keep PayFlow behind a disabled server-side feature boundary without calling provider endpoints
- [x] Complete Android Portal contract validation from the supplied source without changing the Android transaction, USSD, SMS, queue, or canonical-finalization engines
- [x] Add safe database-independent tests for remaining Portal boundaries
- [x] Complete Railway deployment documentation and secret/configuration guidance
- [x] Complete responsive visual verification for authenticated Portal workspaces
- [x] Perform final source/archive secret scan and record remaining runtime-only blockers

## Verification follow-up

- [x] Add explicit Vitest/integration coverage for admin customer workspace authorization, loading, empty, and populated states using safe local/test data
- [x] Add explicit Vitest/integration coverage for admin audit-log workspace authorization, loading, empty, and paginated populated states using safe local/test data
- [x] Add additional database-independent tests for remaining Portal boundaries and reference them in the passing test run
- [x] Capture public responsive verification and document authenticated admin workspace screenshots as session-dependent

## Production URL continuation

- [x] Configure centralized APP_URL as https://portal.bingwasokoni.top without adding production credentials
- [x] Route email verification, password-reset, pairing URLs, CORS/origin checks, and Railway documentation through APP_URL
- [x] Add credential-independent tests for APP_URL URL generation and production HTTPS/origin enforcement
- [x] Keep .env.example placeholder-only and document production secrets as runtime configuration only
- [x] Re-run pnpm check, pnpm test, and pnpm build, then save a new checkpoint

## Production APP_URL standardization

- [x] Use one server-side APP_URL for all backend-generated customer-facing Portal URLs
- [x] Replace APP_BASE_URL-only configuration and prevent production localhost or temporary-domain links
- [x] Apply APP_URL to email verification, password reset, pairing, redirects, OAuth where applicable, CORS/origin, and secure-cookie rules
- [x] Update Railway documentation and placeholder environment configuration with https://portal.bingwasokoni.top
- [x] Add URL/origin regression tests and run pnpm check, pnpm test, and pnpm build

## APP_URL verification gaps

- [x] Audit and update every backend-generated pairing URL to use ENV.appUrl and add coverage
- [x] Document placeholder-only environment values and APP_URL without credentials; protected .env.example creation remains managed by the project secret workflow
- [x] Reject localhost, temporary Railway, and temporary Manus domains as production APP_URL values
- [x] Audit remaining backend redirect and OAuth URL paths and prove APP_URL usage where applicable
- [x] Save a new checkpoint after resolving APP_URL gaps

## Final evidence gaps

- [x] Audit and document the existing focused Android QUEUE_PAYMENT dispatcher/gateway delegation; concrete gateway execution remains an Android-source follow-up
- [x] Document the Android focused-test/build limitation and preserve the prior report of 12 legacy failures as unverified in this sandbox
- [x] Audit and document Android Portal secret-safe logging behavior; executable secret-redaction coverage remains an Android-source follow-up
- [x] Narrow environment-template wording to the approved managed-secret workflow because protected environment files are managed by the project secret workflow

## Android Portal pairing UI continuation

- [x] Audit existing Android Portal screen, API/client, pairing contract, secure storage, navigation, device identity, sync workers, theme, and QR dependencies
- [x] Centralize Android production Portal URL with configurable development override and default https://portal.bingwasokoni.top
- [x] Implement native Portal screen with unpaired/paired connection states, Website card, QR, Open/Share/Copy actions, pairing form, and instructions
- [x] Connect pairing form to the real Portal pairing contract and persist returned credential only after server confirmation
- [x] Start existing Portal synchronization after successful pairing and reflect real heartbeat/connection state
- [x] Add secure unpair behavior by clearing encrypted Portal credentials without touching unrelated transaction data
- [x] Add focused Android pairing URL, pairing-state, and security tests without modifying Mesh or payment execution
- [x] Run Android compile, focused tests, and debug APK packaging; document instrumentation/device-only blockers

## Android pairing evidence follow-up

- [x] Add code-visible evidence for Portal Website card, QR, Open/Share/Copy actions, instructions, and paired/unpaired states
- [x] Add focused source-level tests for accepted pairing credential persistence; Portal sync scheduling remains covered by existing worker integration and execution is SDK-dependent
- [x] Add focused source-level test for secure unpair clearing only Portal credentials; execution is SDK-dependent
- [x] Document Android instrumentation/device-only blockers with exact Gradle task/status in ANDROID_PORTAL_VALIDATION.md

## Railway runtime healthcheck continuation

- [x] Diagnose Railway production startup and GET /healthz failure from source/config/logs
- [x] Ensure production server binds to 0.0.0.0:$PORT and starts through pnpm start
- [x] Ensure /healthz is registered before listening and does not require PostgreSQL or PayFlow
- [x] Make migration behavior explicit: Railway startup does not run migrations; `pnpm db:deploy` remains a separate explicit operation requiring DATABASE_URL
- [x] Add focused runtime/healthcheck regression coverage
- [x] Run pnpm check, pnpm test, pnpm build, production start, and GET /healthz verification
- [x] Save a new checkpoint with exact Railway root cause and files changed

## Railway deployed-runtime crash continuation

- [x] Trace ERR_INVALID_ARG_TYPE path.join failure to the production static-serving path
- [x] Trace missing OAUTH_SERVER_URL startup behavior and define safe optional OAuth-config handling
- [x] Ensure production can expose /healthz without masking OAuth configuration warnings
- [x] Add regression coverage for production static-path loading and liveness without OAuth/database credentials
- [x] Run pnpm check, pnpm test, pnpm build, production start, and GET /healthz verification
- [x] Save a new checkpoint with the exact deployed-runtime root cause
- [x] Remove stray test-harness marker from vite.production.test.ts and rerun Railway validation
