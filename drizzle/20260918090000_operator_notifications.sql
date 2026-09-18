-- Informational e-mails to the operator (a booking arrived, a time moved).
-- They are ordinary message deliveries, so they appear in the administration
-- next to the customer's mail; the dedupe key is what keeps a retried
-- fulfillment run from sending the same notice twice.
ALTER TYPE public.message_kind ADD VALUE IF NOT EXISTS 'operator_notice';

ALTER TABLE public.message_delivery
  ADD COLUMN IF NOT EXISTS dedupe_key text;

-- Null keys stay distinct, so only messages that carry one are constrained.
CREATE UNIQUE INDEX IF NOT EXISTS message_delivery_dedupe_uidx
  ON public.message_delivery (dedupe_key);
