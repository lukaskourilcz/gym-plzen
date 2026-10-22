-- Additive only: no customer, booking, code, payment, message or existing content data changes.
-- No connection, media, settings or test fixtures are inserted by this migration.
CREATE TABLE public.instagram_connection (
  id text PRIMARY KEY DEFAULT 'main' CHECK (id = 'main'),
  account_id text NOT NULL,
  oauth_user_id text NOT NULL,
  username text NOT NULL,
  token_ciphertext text NOT NULL,
  expires_at timestamptz NOT NULL,
  token_refreshed_at timestamptz NOT NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  connected_by_admin_id text,
  last_synced_at timestamptz,
  last_attempt_at timestamptz,
  last_problem text,
  lease_id text,
  lease_until timestamptz
);
CREATE TABLE public.instagram_media (
  id text PRIMARY KEY,
  connection_id text NOT NULL REFERENCES public.instagram_connection(id) ON DELETE CASCADE,
  permalink text NOT NULL,
  caption text NOT NULL DEFAULT '',
  kind text NOT NULL CHECK (kind IN ('IMAGE','VIDEO','CAROUSEL_ALBUM')),
  image_url text NOT NULL,
  published_at timestamptz NOT NULL,
  hidden boolean NOT NULL DEFAULT false
);
ALTER TABLE public.instagram_connection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_media ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.instagram_connection, public.instagram_media FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.instagram_connection, public.instagram_media TO service_role;
