-- Replace the partial unique index on payment.stripe_checkout_session_id with a
-- plain unique index. ON CONFLICT (col) cannot infer a partial index without a
-- matching WHERE clause, which broke the recordPayment upsert. Postgres treats
-- NULLs as distinct by default, so a plain unique index preserves the intent of
-- allowing many NULL rows while enabling ON CONFLICT.

DROP INDEX IF EXISTS public.payment_checkout_session_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS payment_checkout_session_uidx
  ON public.payment (stripe_checkout_session_id);
