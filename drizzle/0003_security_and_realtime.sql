-- Payment idempotency and privacy-safe public availability refresh.
-- Review and apply only to the dedicated NAVI Supabase project.

CREATE UNIQUE INDEX IF NOT EXISTS "payment_checkout_session_uidx"
  ON "payment" ("stripe_checkout_session_id")
  WHERE "stripe_checkout_session_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.availability_signal (
  key smallint PRIMARY KEY DEFAULT 1 CHECK (key = 1),
  version bigint NOT NULL DEFAULT 1,
  changed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.availability_signal ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.availability_signal FROM anon, authenticated;
GRANT SELECT ON public.availability_signal TO anon, authenticated;
DROP POLICY IF EXISTS "public can read availability signal" ON public.availability_signal;
CREATE POLICY "public can read availability signal"
  ON public.availability_signal FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.touch_availability_signal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.availability_signal (key, version, changed_at)
  VALUES (1, 1, now())
  ON CONFLICT (key) DO UPDATE
    SET version = public.availability_signal.version + 1,
        changed_at = EXCLUDED.changed_at;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- The trigger runs as its owner. Browser roles never need to call this
-- SECURITY DEFINER function directly.
REVOKE ALL ON FUNCTION public.touch_availability_signal() FROM PUBLIC;

-- New objects in the exposed public schema stay private until a later
-- migration grants the minimum required access explicitly.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE USAGE, SELECT ON SEQUENCES FROM anon, authenticated;

DROP TRIGGER IF EXISTS reservation_availability_signal ON public.reservation;
CREATE TRIGGER reservation_availability_signal AFTER INSERT OR UPDATE OR DELETE
ON public.reservation FOR EACH STATEMENT EXECUTE FUNCTION public.touch_availability_signal();
DROP TRIGGER IF EXISTS blocked_slot_availability_signal ON public.blocked_slot;
CREATE TRIGGER blocked_slot_availability_signal AFTER INSERT OR UPDATE OR DELETE
ON public.blocked_slot FOR EACH STATEMENT EXECUTE FUNCTION public.touch_availability_signal();
DROP TRIGGER IF EXISTS opening_hours_availability_signal ON public.opening_hours;
CREATE TRIGGER opening_hours_availability_signal AFTER INSERT OR UPDATE OR DELETE
ON public.opening_hours FOR EACH STATEMENT EXECUTE FUNCTION public.touch_availability_signal();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.availability_signal;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END
$$;

-- Browser clients use Auth and the sanitized signal only. All business data is
-- accessed through authenticated server services.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'profiles', 'reservation', 'blocked_slot', 'opening_hours', 'access_code',
    'entry_log', 'membership', 'membership_plan', 'payment', 'message_delivery',
    'marketing_campaign', 'content_block', 'media_asset', 'page', 'site_setting',
    'reservation_pipeline', 'system_alert', 'webhook_event'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', table_name);
  END LOOP;
END
$$;
