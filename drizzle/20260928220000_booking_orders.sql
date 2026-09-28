-- Multi-slot checkout (docs/MULTI_SLOT_ORDER_PLAN_2026_09_28.md, §3).
-- Additive only: every new column is nullable, existing reservations, payments,
-- documents and voucher claims keep working without an order. Apply before
-- deploying code that writes orders. All statements run in one transaction.

CREATE TYPE public.booking_order_status AS ENUM ('pending', 'confirmed', 'cancelled');

CREATE TABLE public.booking_order (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status public.booking_order_status NOT NULL DEFAULT 'pending',
  total_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'czk',
  contact_name text,
  contact_email text,
  contact_phone text,
  confirmation_token_hash text,
  voucher_id uuid REFERENCES public.voucher(id) ON DELETE RESTRICT,
  rules_accepted_at timestamptz,
  terms_accepted_at timestamptz,
  created_by_admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_order_total_not_negative CHECK (total_cents >= 0)
);

CREATE INDEX booking_order_user_created_id_idx
  ON public.booking_order (user_id, created_at DESC, id DESC);
CREATE INDEX booking_order_status_created_idx
  ON public.booking_order (status, created_at);
CREATE INDEX booking_order_voucher_idx ON public.booking_order (voucher_id);
CREATE INDEX booking_order_created_by_admin_idx
  ON public.booking_order (created_by_admin_id);

-- Contact data and token hashes: server connection only, like reservation.
ALTER TABLE public.booking_order ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.booking_order FROM anon, authenticated;

ALTER TABLE public.reservation
  ADD COLUMN order_id uuid REFERENCES public.booking_order(id) ON DELETE SET NULL;
CREATE INDEX reservation_order_idx ON public.reservation (order_id);

-- One active Comgate payment per order, next to the per-reservation rule.
ALTER TABLE public.payment
  ADD COLUMN order_id uuid REFERENCES public.booking_order(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX payment_active_order_uidx ON public.payment (order_id)
  WHERE provider = 'comgate' AND status IN ('pending', 'processing', 'succeeded');
CREATE INDEX payment_order_idx ON public.payment (order_id);

-- One document per order; invoice_reservation_uidx stays for older documents.
-- RESTRICT: an issued tax document must never lose the order it was for.
ALTER TABLE public.invoice
  ADD COLUMN order_id uuid REFERENCES public.booking_order(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX invoice_order_uidx ON public.invoice (order_id);

-- One voucher claim per order; voucher_redemption_reservation_uidx stays.
ALTER TABLE public.voucher_redemption
  ADD COLUMN order_id uuid REFERENCES public.booking_order(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX voucher_redemption_order_uidx
  ON public.voucher_redemption (order_id);
