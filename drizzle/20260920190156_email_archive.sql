-- Server-only short-lived email bodies. No public API grants, no client policies.
CREATE TABLE public.email_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_message_id text NOT NULL UNIQUE,
  sender text NOT NULL,
  recipient text NOT NULL,
  subject text NOT NULL,
  html text NOT NULL,
  body_text text,
  attachment_names jsonb NOT NULL DEFAULT '[]'::jsonb,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_archive_sent_at_idx ON public.email_archive (sent_at);
ALTER TABLE public.email_archive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_archive FROM anon, authenticated;
COMMENT ON TABLE public.email_archive IS 'Exact sent email bodies; server-only; purged after 30 days. Delivery dedupe records are retained separately.';
