# Credit wallet release and operating guide

For the subsequent change-request pricing policy and twenty-row customer history,
see [the 28 October follow-up](CREDIT_RESCHEDULING_2026_10_28.md). The deployment
authorization and migrations below describe the original credit release only.

## Deployment boundary

The feature is implemented on `codex/customer-credits`. The initial implementation
was local-only; the subsequent user request explicitly authorizes auditing,
fixing, merging PR #274, production migration and deployment. All destructive or
provider-effect verification still uses disposable loopback databases and local
replacements. Never exercise a real customer workflow as a release test.
Automatic Vercel preview deployment remains disabled for this branch.

1. Review the PR, local screenshots and green application checks.
2. The approved terms version is `2026-10-27-credits-v1`; the previous document remains at
   `/obchodni-podminky?version=legacy`. Update the publication date if needed.
3. With the deployment approval already granted, apply
   `drizzle/20261027090000_customer_credits.sql` through the existing migration
   process, followed by `drizzle/20261027180000_credit_audit_indexes.sql`,
   BEFORE deploying code that reads wallets. No seeds/settings are run.
4. Verify old reservation, access-code, payment and message fields read-only
   before/after; additive columns must not be mistaken for changed old data.
5. Deploy the reviewed commit and verify private routes, public calendar and
   default-zero wallets by reading only. Never place a test production booking.

The migration creates empty, private RLS tables. It gives existing reservations
pricing version 1, zero credit funding, and no price/terms snapshot. It does not
change dates, existing prices, contacts, PINs, payment states or delivery states.
New public orders explicitly store version 2, the accepted terms identifier,
original per-item prices/discounts and original cash/credit allocation.

## Customer and administrator behavior

- Profile shows available credit when positive; the dedicated history tab pages
  movements twenty at a time. Administrator wallet history shows the last 50.
- Checkout, reschedule difference and additional companions accept credit; any
  remainder uses Comgate. Full-credit purchases do not open a gateway and are
  still purchases for loyalty purposes. Rewards never mint nominal-price credit.
- The account includes private downloadable settlement statements for moves.
  Original invoices retain their original lines and tender snapshots.
- Credits administration filters/paginates customers (20/page). Add/remove/set
  operations append entries with operator and reason; no historical entry can be
  edited or deleted. The dialog checks a concurrently changed balance.
- Guest credit is assigned to a stable private account. Only an Auth-verified,
  confirmed email can transfer it to an account, with paired audit entries.
  Reservations are not reassigned by matching an unverified booking email.
- Customer cancellation forfeits cash/credit under the unchanged cancellation
  policy. Operator cancellation returns only remaining credit funding once;
  cash refund alerts identify original/companion/reschedule payment components.

## Failure recovery

A payment-stage target is an ordinary blocked slot, not a reservation; it cannot
generate a PIN, participate in loyalty or queue a customer message. The original
reservation/code pipeline remains unchanged until payment is verified. The
existing two-window access-code intent is used only during the actual paid move.
All writers keep the schedule exclusion/lock safeguards.

Gateway amount/currency/reference/environment are verified server-side. Unknown
creation does not get retried or released merely by a timer. Definitive cancelled
payments release credit and target holds. A stale quoted wallet amount requires
customer confirmation again rather than increasing the charge silently.

The watchdog resumes committed `applying` moves and handles failed moves:
prove target PINs absent, restore due original access, release unused credit,
and request the cash topup back. It never assumes a queued refund is completed.
Comgate `refId` is not unique, so refund intent is persisted before POST; lost
responses/crashes are NOT automatically POSTed again.

Under **Kredity → Změny vyžadující ověření**, an administrator can retry safe
recovery or confirm a refund actually verified in Comgate, with its reference.
For `submitting`, `unknown` or `rejected`, inspect Comgate before any manual retry.
Confirmation records the administrator and changes only the supplemental payment.
Completed financial moves and credit ledger rows are immutable.

No change/cancellation confirmation is emitted for an unsuccessful move; normal
successful new customer operations use the existing deduplicated delivery paths.
SMS/WhatsApp code templates and normal preparation/delivery timing are unchanged.

## Local verification

Use Node 22, an empty UTF-8 PostgreSQL 17 database on loopback with `test` in its
name, and an explicit `TEST_DATABASE_URL`. Do not copy any application env file.
Run `test:db:setup`, lint, typecheck, unit, integration, SQL and local browser suites.
Use a SEPARATE migrated test database for browser runs. Test runners deliberately
fail on remote DB URLs/provider requests, never fall back to application secrets.
The migration test bootstraps the previous schema, seeds fictional historical
records, applies only the new migration, and compares original fields bytewise.

Do not drop the financial tables or roll back the migration once wallets or
pending payments exist. A rollback must first stop new financial operations and
retain reconciliation/refund handling for every already-started operation. A
committed paid intent also expires: a delayed worker never grants a second visit
after the original entry could have been used.
