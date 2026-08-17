-- Customer self-service rescheduling according to VOP article 8:
-- one free change, made no later than 24 hours before the original slot.
-- The service enforces the time rule; a unique audit row enforces the
-- one-change maximum and retains the complete before/after history.

CREATE INDEX IF NOT EXISTS reservation_confirmed_user_starts_idx
  ON public.reservation (user_id, starts_at)
  WHERE status = 'confirmed';

CREATE TABLE IF NOT EXISTS public.reservation_reschedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL
    REFERENCES public.reservation(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  previous_starts_at timestamp with time zone NOT NULL,
  previous_ends_at timestamp with time zone NOT NULL,
  new_starts_at timestamp with time zone NOT NULL,
  new_ends_at timestamp with time zone NOT NULL,
  changed_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS reservation_reschedule_reservation_uidx
  ON public.reservation_reschedule (reservation_id);

-- All business-data access goes through authenticated server services. Keep
-- the audit table unavailable through the browser-facing Data API.
ALTER TABLE public.reservation_reschedule ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reservation_reschedule FROM anon, authenticated;
