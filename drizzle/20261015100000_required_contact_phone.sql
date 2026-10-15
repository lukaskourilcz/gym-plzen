-- Preserve every existing contact and reservation. Only future Auth users opt in.
ALTER TABLE public.profiles ADD COLUMN phone_required boolean NOT NULL DEFAULT false;
INSERT INTO public.site_setting (key, value)
VALUES ('registration.phone_required_from', to_jsonb(now()))
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, phone_required)
  VALUES (
    NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name',
    CASE WHEN NEW.raw_user_meta_data->>'phone' ~ '^\+[1-9][0-9]{7,14}$'
      THEN NEW.raw_user_meta_data->>'phone' ELSE NULL END,
    true
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
