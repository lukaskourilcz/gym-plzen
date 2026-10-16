-- Additive, server-only evidence. No reservation/code/message writes and no blocks activated.
CREATE TABLE public.block_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  slots jsonb NOT NULL CHECK (jsonb_typeof(slots) = 'array'),
  created_by_admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.block_application (
  id uuid PRIMARY KEY,
  request jsonb NOT NULL,
  snapshot jsonb NOT NULL,
  fingerprint text NOT NULL,
  created_by_admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz
);
CREATE INDEX block_application_created_idx ON public.block_application(created_at);
ALTER TABLE public.block_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.block_application ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.block_template, public.block_application FROM anon, authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON public.block_template, public.block_application TO service_role;
  END IF;
END $$;
ALTER TABLE public.blocked_slot ADD COLUMN application_id uuid REFERENCES public.block_application(id) ON DELETE RESTRICT;
CREATE INDEX blocked_slot_application_idx ON public.blocked_slot(application_id);
CREATE UNIQUE INDEX blocked_slot_application_window_uidx ON public.blocked_slot(application_id, starts_at, ends_at);

-- Suggestions only; independent of the current grid. Admin must preview/apply explicitly.
INSERT INTO public.block_template (id, name, slots) VALUES
 ('b10c0000-0000-4000-8000-000000000001', 'Všední večery — 22:30–23:45', '[{"dayOfWeek":1,"startMinute":1350,"endMinute":1425},{"dayOfWeek":2,"startMinute":1350,"endMinute":1425},{"dayOfWeek":3,"startMinute":1350,"endMinute":1425},{"dayOfWeek":4,"startMinute":1350,"endMinute":1425},{"dayOfWeek":5,"startMinute":1350,"endMinute":1425}]'),
 ('b10c0000-0000-4000-8000-000000000002', 'Víkendová rána — 05:00–06:15', '[{"dayOfWeek":0,"startMinute":300,"endMinute":375},{"dayOfWeek":6,"startMinute":300,"endMinute":375}]'),
 ('b10c0000-0000-4000-8000-000000000003', 'Víkendové večery — 22:30–23:45', '[{"dayOfWeek":0,"startMinute":1350,"endMinute":1425},{"dayOfWeek":6,"startMinute":1350,"endMinute":1425}]');
