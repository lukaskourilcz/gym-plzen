# Nuki + Resend — production launch, 20 September 2026

- Nuki Web account: info@navigym.cz, lock NAVI Private Gym (22819692303).
- Physical keypad tested by the operator. API creation, synchronization, time bounds and deletion independently verified on 20 September.
- Dedicated API token permits reading devices/logs and managing authorizations. No remote lock operation or account management permission.
- NUKI_API_TOKEN and NUKI_SMARTLOCK_ID configured on Vercel. Lock ID is production-only, so preview deployments cannot provision codes.
- Access-code delivery uses Resend email only; WhatsApp and SMS are not called by reservation fulfillment. Zernio is not required.

## Fulfillment

Confirmation/payment emails are immediate. The enabled lock workflow waits until 60 minutes before the reservation before it creates a six-digit PIN containing only digits 1–9. Validity begins 15 minutes before the reservation and ends after its configured shower grace period. The PIN is emailed after Nuki confirms the matching authorization, time limits and completed synchronization.

Nuki's asynchronous PUT returns HTTP 204 without an authorization ID. The adapter reads the authorization list to resolve it, with bounded polling. Unknown outcomes are reconciled by the watchdog without another PUT. PINs remain hashed in the database; email retries recover the original PIN from Nuki by hash, authorization ID and exact validity window. Resend uses an idempotency key based on the access-code record (provider deduplication window: 24 hours).

Cancellation verifies that Nuki has removed the authorization before marking it revoked. A pending or failed operation leaves an actionable pipeline failure; it must never cause an unverified code to be sent.

The watchdog checks due reservations every minute. Bookings confirmed inside the one-hour window are fulfilled immediately. Future PIN steps do not consume retry batches, and the fulfillment entry point independently enforces the time boundary. Emails sent before this correction cannot be recalled.

## Checks

- Unit suite: asynchronous create, lost response, pending/error states, wrong lock/window/hash/ID, duplicate matches, PIN alphabet, unchanged-PIN recovery.
- Integration database tests require a local DATABASE_URL; they do not run against production automatically.
- Live checks must never unlock the door. Temporary probe authorizations must be deleted and deletion verified.
