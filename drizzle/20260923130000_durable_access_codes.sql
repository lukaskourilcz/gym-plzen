-- Apply before deploying code. All statements must run in one transaction.
ALTER TABLE public.access_code
 ADD COLUMN encrypted_pin text,
 ADD COLUMN lock_id text,
 ADD COLUMN provision_state text NOT NULL DEFAULT 'submitted'
   CHECK (provision_state IN ('prepared','submitted','ready')),
 ADD COLUMN submitted_at timestamptz,
 ADD COLUMN revoke_requested_at timestamptz,
 ADD COLUMN retry_at timestamptz,
 ADD COLUMN attempts integer NOT NULL DEFAULT 0;
UPDATE public.access_code SET provision_state = 'ready' WHERE nuki_auth_id IS NOT NULL AND status IN ('scheduled','active','used');
ALTER TABLE public.reservation ADD COLUMN access_revocation_pending boolean NOT NULL DEFAULT false;
UPDATE public.reservation r SET access_revocation_pending = true
 WHERE r.status = 'cancelled' AND EXISTS (
   SELECT 1 FROM public.access_code c WHERE c.reservation_id = r.id AND c.status NOT IN ('revoked','expired')
 );
UPDATE public.access_code c SET revoke_requested_at = now(), retry_at = now()
 FROM public.reservation r WHERE c.reservation_id = r.id AND r.status = 'cancelled' AND c.status NOT IN ('revoked','expired');
-- Fail closed if historic cancelled codes overlap another booking: reconcile
-- the real device first, never silently drop that customer's reservation.
ALTER TABLE public.reservation DROP CONSTRAINT reservation_no_overlap;
ALTER TABLE public.reservation ADD CONSTRAINT reservation_no_overlap
 EXCLUDE USING gist (tstzrange(starts_at,ends_at,'[)') WITH &&)
 WHERE (status IN ('pending','confirmed') OR access_revocation_pending);
-- Captures cancellation by any writer, atomically with the status transition.
CREATE FUNCTION public.preserve_access_hold() RETURNS trigger LANGUAGE plpgsql
 SET search_path = public, pg_temp AS $$
BEGIN
 IF NEW.status = 'cancelled' AND EXISTS (
   SELECT 1 FROM public.access_code c WHERE c.reservation_id = NEW.id AND c.status NOT IN ('revoked','expired')
 ) THEN NEW.access_revocation_pending := true; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER preserve_access_hold BEFORE UPDATE ON public.reservation
 FOR EACH ROW EXECUTE FUNCTION public.preserve_access_hold();
REVOKE ALL ON FUNCTION public.preserve_access_hold() FROM PUBLIC;
CREATE INDEX access_code_revocation_retry_idx ON public.access_code (retry_at,valid_from)
 WHERE status NOT IN ('revoked','expired');
-- No new public grants: existing access_code RLS protects ciphertext too.

ALTER TABLE public.reservation_pipeline ALTER COLUMN next_retry_at TYPE timestamptz USING next_retry_at AT TIME ZONE 'UTC';

-- Repair missing durable work for confirmed bookings without duplicating steps.
INSERT INTO public.reservation_pipeline(reservation_id,step,next_retry_at)
 SELECT r.id, s::public.pipeline_step, now() FROM public.reservation r
 CROSS JOIN unnest(ARRAY['payment','code_created','code_delivered']) s
 WHERE r.status = 'confirmed' AND r.ends_at > now()
 ON CONFLICT(reservation_id,step) DO NOTHING;
