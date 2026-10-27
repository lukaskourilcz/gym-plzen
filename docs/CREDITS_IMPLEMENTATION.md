# Customer credits and priced rescheduling

Approved 27 October 2026. Work is isolated from production; no production
migration, seed, booking, device or customer communication is authorized here.

## Invariants

- Existing bookings use legacy unchanged-price rescheduling. New bookings carry
  an explicit pricing/terms version; migration never reprices existing rows.
- One customer change, initiated at least 24 hours before the original start.
- Original reservation/PIN survives awaiting payment. Target and wallet holds
  are durable, separate from the existing access-code reschedule intent.
- Money is integer halere. Ledger is immutable, admin corrections append entries.
  Reserved credits cannot be spent twice; available balance cannot be negative.
- Final financial allocation and successful move commit together. External
  payment/device work is durable and reconciled, never assumed atomic with SQL.
- Credit is tender, not discount. Each item keeps cash/credit allocation, original
  discount and loyalty snapshots. A free reward never creates nominal credit.
- Guest wallet ownership requires verified identity, never a client-supplied email.
- No expiry or transfers. Customer cancellation retains today's no-refund rule;
  operator cancellation returns eligible remaining funding without double credit.

## Delivery slices

1. Pure pricing rules, additive private schema and versioned purchase snapshots.
2. Wallet ledger, holds, customer/guest identities, administration and profiles.
3. Checkout/participant tender, funding allocation and payment reconciliation.
4. Durable priced rescheduling, recovery/refunds, customer confirmation UX.
5. Terms, editable notices/emails, documents, preview parity and navigation.
6. Local isolated unit/integration/SQL/browser verification, review PR.

Every slice receives focused commits and tests. Production rollout remains a
separate approval after review. Test runners accept loopback test databases only
and deny external provider networking. No real environment files are copied.
