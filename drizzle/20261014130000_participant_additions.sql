-- Additive migration. No reservation UPDATE and no notification triggers.
ALTER TABLE public.reservation
  ADD COLUMN extra_people integer NOT NULL DEFAULT 0,
  ADD COLUMN additional_people_paid_cents integer NOT NULL DEFAULT 0,
  ADD CONSTRAINT reservation_extra_people_check CHECK (extra_people BETWEEN 0 AND 2),
  ADD CONSTRAINT reservation_additional_people_paid_check CHECK (additional_people_paid_cents >= 0);

CREATE TABLE public.participant_addition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES public.reservation(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  from_count integer NOT NULL,
  to_count integer NOT NULL,
  amount_cents integer NOT NULL,
  pricing_mode text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT participant_addition_counts_check CHECK (from_count >= 0 AND to_count <= 2 AND to_count > from_count),
  CONSTRAINT participant_addition_amount_check CHECK (amount_cents >= 0),
  CONSTRAINT participant_addition_status_check CHECK (status IN ('pending', 'confirmed', 'failed', 'review_needed')),
  CONSTRAINT participant_addition_mode_check CHECK (pricing_mode IN ('flat', 'per_person'))
);
CREATE INDEX participant_addition_user_idx ON public.participant_addition(user_id);
CREATE INDEX participant_addition_reservation_idx ON public.participant_addition(reservation_id);
CREATE UNIQUE INDEX participant_addition_pending_uidx ON public.participant_addition(reservation_id) WHERE status = 'pending';
ALTER TABLE public.participant_addition ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.participant_addition FROM anon, authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON public.participant_addition TO service_role;
  END IF;
END $$;

ALTER TABLE public.payment ADD COLUMN participant_addition_id uuid REFERENCES public.participant_addition(id) ON DELETE RESTRICT;
ALTER TABLE public.payment ADD CONSTRAINT payment_participant_binding_check CHECK (participant_addition_id IS NULL OR (reservation_id IS NULL AND order_id IS NULL AND membership_id IS NULL));
CREATE UNIQUE INDEX payment_participant_addition_uidx ON public.payment(participant_addition_id);
-- Supplemental payments have no reservation_id/order_id, so they cannot enter
-- the original reservation confirmation, cancellation or delivery pipeline.
