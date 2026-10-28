# Newly requested reservation changes and credit history

Issues: #279 (history), #280 (historical reservation repricing).

## Release boundary

This change requires **no database migration, seed, backfill or production data
update**. Deploying or viewing a quote must not rewrite any reservation, payment,
access code, pipeline or delivery. No customer message is sent by deployment.
Automatic preview deployment is disabled for `codex/credit-history-pagination`.
Merge and production deployment require a separate release instruction for this PR.

Do not retrospectively invoice or otherwise alter a previously completed move.
Do not exercise checkout, cancellation, payment reconciliation or code provisioning
on a real customer as a release check. Verification uses isolated loopback test
databases and provider replacements with outbound-network blocking.

## New move requests

Every newly confirmed move requires a server-side price quote and a financial
intent, irrespective of purchase `pricing_version`. A 199 CZK purchase moved to
a 239 CZK slot requires 40 CZK, paid with available credit and/or verified Comgate
payment. A cheaper move credits the actual difference exactly once. A loyalty
reward remains free and never creates credit from a nominal slot price.

The customer sees the old/new prices, funding and current change rules before
confirming. Old forms missing the current change-terms identifier are rejected.
Original purchase consent remains unchanged. Change consent is recorded on the
financial intent under `2026-10-28-credits-v2`. Both the pre-credit terms and
`2026-10-27-credits-v1` remain available as historical documents.

Unpaid/cancelled surcharge attempts retain the original reservation and PIN.
Existing payment verification, duplicate protection, two-window access checks and
failure recovery still govern successful moves. Only a successful, explicitly
requested move writes its reconstructed purchase evidence, preserving the
original cash/credit amount for later operator-refund accounting.

Old bookings without a saved snapshot can use their recorded paid amount as the
comparison price. The new slot uses the current tariff. Separately purchased
companions are carried without charging their already-paid amount again.
Historical membership-covered prices, original companion tariffs, manual zero
prices and voucher rules that cannot be reconstructed unambiguously require
operator review. They must never be guessed from mutable current settings or
silently bypass the price-settlement flow. The original booking remains valid.

## History

The customer history tab reads 20 movements plus one lookahead row per page,
scoped to the customer's credit account. Ordering uses creation time and ID.
The page is preserved in the URL; records beyond the old 50-row cutoff are
reachable. The interactive customer preview has the same pagination locally.
Administrator wallet history retains its existing 50-row limit.

## Verification

- Legacy 199 → 239 CZK: original reservations, PIN rows and pipelines are equal
  before quote, after quote and while the surcharge is unpaid; no messages.
- Verified payment moves once; another customer's reservation and PIN stay equal.
- Cancelled payment, cheaper moves, loyalty reward, missing evidence and direct
  attempts to bypass financial confirmation.
- Original accepted terms and both archived documents stay unchanged.
- Twenty-row history across more than 50 entries, tied timestamps, private
  ownership, reload, next/previous navigation and mobile layout.
