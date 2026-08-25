# Android Portal contract validation

The supplied Portal-sync Android archive was inspected at source level. The Portal transport is isolated under `app/src/main/java/com/bingwasokoni/automation/portal/` and uses typed Retrofit models and a dedicated repository/worker path. Portal classes do not import Mesh transports, credentials, or Mesh domain types.

`PortalCommandDispatcher` accepts only `QUEUE_PAYMENT`, validates phone number, positive amount, package name, USSD code, and transaction ID, then delegates through `PortalQueueGateway`. `PaymentQueuePortalGateway` adapts that interface directly to the existing `PaymentQueueService.queuePayment(...)`; the Portal layer does not execute USSD, SMS, Accessibility, or transaction finalization logic. Operation and execution identifiers are retained in the queued payment payload.

The supplied focused tests cover transaction projection mapping, malformed-command rejection before queue access, successful queue delegation with identity fields, unsupported command rejection, and retry decisions for network/server versus client/terminal failures. The archive lacks an executable Gradle wrapper in the inspected copy, so those Android tests were source-validated but could not be executed from this environment. No physical-device verification was attempted or required for this foundation phase.

The Portal-side contract has matching device authentication, heartbeat, transaction projection, command polling, acknowledgement/result reporting, and unique projection-key upsert behavior. The web project does not call PayFlow endpoints, and no PayFlow credentials are placed in Android code or the frontend.

Remaining Android runtime items are intentionally pending: execute a real `QUEUE_PAYMENT` through the device queue, confirm command terminal reporting on-device, and run the complete Android suite. These require an executable Android build environment and/or device runtime, but do not justify modifying the existing transaction, USSD, SMS, queue-ownership, Mesh, or canonical-finalization engines.
