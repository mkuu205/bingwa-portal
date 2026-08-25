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

- [ ] Implement server-only PayFlow STK Push integration with secure secrets, normalized phone, safe errors, and no credential exposure (deferred: user will configure env later)
- [x] Add configurable Bingwa device/subscription products with owner-supplied pricing and admin management
- [ ] Add Bingwa payment purchase records and separate payment state machine with PayFlow identifiers
- [ ] Add bounded server-side payment status verification and exactly-once subscription/device entitlement activation
- [ ] Add idempotency protections against duplicate STK Push charges and refresh/double-click retries
- [ ] Add customer checkout and safe pending/completed/failed/cancelled payment states
- [ ] Add admin payment inspection and audited recovery boundaries
- [ ] Add payment tests and PAYMENTS.md documentation referencing PayFlow API documentation (deferred: user will configure env later)

- [x] Migrate Portal persistence from Drizzle/MySQL-compatible schema to PostgreSQL + Prisma while preserving existing operations behavior
- [x] Regression-test existing admin authentication, device sync, command lifecycle, subscriptions, services, and transaction operations against a real PostgreSQL database
- [x] Implement native customer authentication, email verification, and secure customer sessions; password recovery/change remains pending
- [x] Implement customer-to-device ownership and enforce customer/admin authorization boundaries
- [x] Implement secure single-use expiring QR/code pairing and device credential rotation without using Mesh credentials
- [ ] Implement dedicated HTTPS Android Portal communication, heartbeat, command lease/ack/result, and credential storage while keeping Mesh independent (transport and queue seam complete; device end-to-end verification pending)
- [ ] Implement Android transaction projection/outbox and safe Portal retry dispatch through the existing transaction pipeline
- [x] Implement configurable device/subscription products with no invented initial prices
- [ ] Implement server-only PayFlow STK Push and status verification with idempotent payment records and transactional entitlement activation (deferred: user will configure env later)
- [ ] Add payment/product/customer/security documentation, regression tests, integration tests, and responsive UI verification
- [x] Implement admin product CRUD for device/subscription products with validation and authorization boundaries
- [x] Add Portal product UI with listing, create, update, archive, loading, empty, and error states
- [x] Add product authorization, persistence, and price-configuration integration coverage
- [x] Add full product edit UI and mutations for all owner-supplied product fields with save states
- [x] Add per-product edit success/pending/error feedback and field-level validation
- [x] Mirror positive-integer/null duration and device-limit validation in the product editor
- [x] Add focused UI contract coverage for invalid product edit values
- [x] Add Prisma/PostgreSQL product integration coverage for admin authorization and persistence round-trips
- [x] Implement safe product delete behavior or document archive-only lifecycle when dependent records exist
- [ ] Deliver the migrated production-ready Portal with required secrets and owner-supplied pricing clearly identified

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
- [ ] Wire Portal command lifecycle reporting into the real Android command execution path (queue delegation is wired; device runtime verification remains)
- [ ] Exercise a supported Portal QUEUE_PAYMENT through the real PaymentQueuePortalGateway and PaymentQueueService boundary
- [ ] Verify on a device that a polled Portal command is acknowledged, executed by the existing queue owner, and reported with the correct terminal state
- [x] Bind Portal command dispatch to an existing Android execution owner for supported command types
- [x] Extract a testable Portal queue gateway backed by the existing PaymentQueueService
- [x] Add Hilt binding for PaymentQueuePortalGateway after the application graph reports a missing PortalQueueGateway binding
- [x] Fix Portal dispatcher import after KSP cannot resolve the actual PaymentQueueService package
- [x] Run Android compile with the project’s actual Gradle wrapper entry point (compile passes)
- [x] Run focused Android Portal tests (dispatcher and projection tests pass)
- [ ] Run the complete Android suite and resolve or explicitly isolate the remaining legacy failures
- [x] Fix existing PremiumPackageCard verified-icon compile regression blocking Android validation
- [x] Keep Portal HTTP body/header logging disabled by design to prevent credential exposure
- [ ] Add Android unit tests for Portal request authentication, retry/backoff, command idempotency, and secret redaction (retry, dispatcher, and projection coverage added; auth/idempotency transport cases remain)
- [ ] Add Android integration coverage for supported Portal commands proving PaymentQueueService delegation and fail-closed validation; focused fake-gateway unit coverage passes
- [x] Fix PortalCommandDispatcherTest Kotlin assertion syntax so focused Android tests compile

- [x] Correct Android build-file path discovery after the module uses a different Gradle filename than expected
- [x] Add Android Portal Retrofit API, typed tRPC envelope handling, and configurable base URL build field
- [x] Add encrypted credential/configuration storage and intentionally disabled Portal HTTP body/header logging
