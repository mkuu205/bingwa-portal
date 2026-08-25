# Android Portal contract validation

The supplied Portal-sync Android archive was inspected at source level. The Portal transport is isolated under `app/src/main/java/com/bingwasokoni/automation/portal/` and uses typed Retrofit models and a dedicated repository/worker path. Portal classes do not import Mesh transports, credentials, or Mesh domain types.

`PortalCommandDispatcher` accepts only `QUEUE_PAYMENT`, validates phone number, positive amount, package name, USSD code, and transaction ID, then delegates through `PortalQueueGateway`. `PaymentQueuePortalGateway` adapts that interface directly to the existing `PaymentQueueService.queuePayment(...)`; the Portal layer does not execute USSD, SMS, Accessibility, or transaction finalization logic. Operation and execution identifiers are retained in the queued payment payload.

The supplied focused tests cover transaction projection mapping, malformed-command rejection before queue access, successful queue delegation with identity fields, unsupported command rejection, and retry decisions for network/server versus client/terminal failures. The archive lacks an executable Gradle wrapper in the inspected copy, so those Android tests were source-validated but could not be executed from this environment. No physical-device verification was attempted or required for this foundation phase.

The Portal-side contract has matching device authentication, heartbeat, transaction projection, command polling, acknowledgement/result reporting, and unique projection-key upsert behavior. The web project does not call PayFlow endpoints, and no PayFlow credentials are placed in Android code or the frontend.

Remaining Android runtime items are intentionally pending: execute a real `QUEUE_PAYMENT` through the device queue, confirm command terminal reporting on-device, and run the complete Android suite. These require an executable Android build environment and/or device runtime, but do not justify modifying the existing transaction, USSD, SMS, queue-ownership, Mesh, or canonical-finalization engines.

## Additional focused evidence

The supplied Android source now includes `PortalBoundarySecurityTest`, which directly verifies that `PaymentQueuePortalGateway.enqueue()` delegates a supported `QUEUE_PAYMENT` payload to `PaymentQueueService`, and that `PortalRepository` converts thrown failures to a type-only `PortalResult.NetworkFailure` without exposing credential or response content in the result.

The new test class could not execute in the current sandbox because the archive lacks an executable `gradlew` script and the checked-in Gradle wrapper cannot locate an Android SDK (`ANDROID_HOME`/`sdk.dir` is unavailable). Run `:app:testDebugUnitTest --tests com.bingwasokoni.automation.portal.PortalBoundarySecurityTest` on a machine with a configured Android SDK before merging the test into the Android source of record.

## Full-suite status record

The Android full-suite task is `:app:testDebugUnitTest`. In this sandbox, execution stops during Gradle configuration because `ANDROID_HOME`/`sdk.dir` is not configured; the archive also lacks the executable `gradlew` script and only contains the wrapper JAR. Therefore no new full-suite result is claimed here. The inherited project report records 12 legacy Android unit failures in encoder/validator areas; that count is preserved as historical information and was not independently rerun in this environment. The Portal foundation does not modify those tests or the existing payment engine.

The Android Portal repository’s `execute` method logs only operation name, HTTP status, and exception class; it does not log request bodies, response bodies, device tokens, pairing secrets, or authorization values. The temporary audit test checks the result boundary but is not claimed as executed or as a substitute for device-side transport logging validation.

## Pairing persistence test execution status

The added `PortalPairingPersistenceTest` covers accepted credential persistence, rejection of incomplete responses, and isolated Portal credential clearing. The requested `testDebugUnitTest` task was attempted and could not start because this sandbox has no Android SDK configured: `SDK location not found; define ANDROID_HOME or sdk.dir in local.properties`. The test source is included in the Android archive, but execution remains pending an Android SDK/CI or developer machine.
