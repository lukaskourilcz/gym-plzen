-- The record of important actions for the administration: reservations
-- confirmed, cancelled or moved, payments settled, administrators' changes.
-- Written by the services that perform the action, never updated. Browser
-- Data API roles receive no privileges; RLS is enabled as defence in depth.
CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  actor_type text NOT NULL CHECK (actor_type IN ('customer', 'admin', 'system')),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_label text,
  action text NOT NULL,
  member_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reservation_id uuid REFERENCES public.reservation(id) ON DELETE SET NULL,
  summary text NOT NULL,
  context jsonb
);

CREATE INDEX IF NOT EXISTS activity_log_occurred_idx
  ON public.activity_log (occurred_at);
CREATE INDEX IF NOT EXISTS activity_log_member_idx
  ON public.activity_log (member_id);
CREATE INDEX IF NOT EXISTS activity_log_reservation_idx
  ON public.activity_log (reservation_id);
CREATE INDEX IF NOT EXISTS activity_log_actor_idx
  ON public.activity_log (actor_id);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.activity_log FROM anon, authenticated;
