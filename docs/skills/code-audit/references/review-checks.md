# Review checks

Use these as prompts for concrete evidence, not a checklist to mark automatically.

## Identity and boundaries

Trace every action, API, webhook, cron, download and upload from input to effect. Check verified identity, fresh roles, record ownership, admin/demo separation, CSRF/origin, redirects, signature/secret comparison, replay, rate limits, body/array/file bounds and public response fields. User-editable metadata must not grant authority. Inspect RLS and GRANTs independently; private data and secrets must not enter client bundles, caches, error messages, logs or artifacts. Check HTML/URLs/files for injection, traversal, SSRF and unsafe content rendering. Validate both inbound and provider-returned identifiers.

## Domain consistency and money

Write invariants explicitly: exclusive capacity, immutable purchase terms, integer minor-unit arithmetic, per-item allocation, voucher/reward conservation, available versus reserved funds, exactly-once ledger effects and refund eligibility. Trace the whole transaction and all direct/indirect writers. Check row/operation/schedule lock ordering, stale reads, uniqueness/exclusion/FK constraints, transaction boundaries and fail-closed behavior. Test multiple parallel operations and altered retry payloads. A successful provider effect and SQL commit are not one atomic transaction.

## External effects and recovery

Inspect durable intent before provider calls, bounded timeout, provider idempotency guarantees, identity/amount/currency/environment verification, state monotonicity and terminal states. Unknown outcomes require reconciliation rather than blind retry. Inspect failure between every durable boundary, including confirmation delivery and cleanup. Check queue ordering, batch bounds, starvation, per-item isolation and observability. Recovery must preserve the valid original resource until replacement is verified, and must not double charge, refund, send or grant access. Alerts should explain cause, impact and a safe operator action without exposing credentials or PINs.

## Data and migrations

Inspect historical/default behavior, null/version handling, constraints, RLS, restrictive search_path, function execution grants, index coverage, timezone/DST/end-inclusive ranges and immutable evidence. Avoid business-data backfills unless explicitly authorized. Assess migration lock duration, backwards compatibility with old app versions, transactionality, repeat application and schema-history tracking. Rehearse preservation and permission tests. Do not drop state needed by in-flight provider work during rollback.

## Performance and availability

Trace common cold/warm requests and interactions. Count repeated queries, N+1 reads, large joins, full scans, unbounded history and payloads; compare plans on representative volumes. Inspect connection budgets, query/lock/provider timeouts, cancellation, request coalescing, caching scope/TTL/invalidation, stale response races, realtime bursts and expensive client dependencies. Authentication and financial reads must not inherit public caching. Public caches must not reveal customer data. Do not trade final server-side availability/price verification for speed. Errors should show retry/recovery rather than invented availability.

## Frontend and accessibility

Verify actual desktop/mobile flows with keyboard and assistive semantics: labels, focus/dialog handling, disabled/pending states, feedback, clear price/credit/refund totals and destructive confirmations. Check duplicate submits, lost responses, history/back navigation, reconnect, partial selection and stale server errors. Keep preview simulations isolated from real effects. Use current project components/design rules; do not redesign unrelated pages during audit.

## Maintainability and operations

Inspect dependency direction/cycles, cohesive service boundaries, duplicated financial rules, unsafe casts/non-null assumptions, swallowed errors and implicit configuration defaults. Prefer explicit types and domain errors, but do not rewrite working code for subjective style. Check configuration validation, supported runtimes, dependency advisories/lockfile reproducibility, test isolation, CI permissions, secret exposure, deploy regions, health signals, incident context and rollback/reconciliation procedures. Report coverage gaps and operational dependencies honestly.
