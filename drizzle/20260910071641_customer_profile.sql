-- Additive profile fields. Existing names, reservations, invoices and preferences stay intact.
ALTER TABLE public.profiles ADD COLUMN first_name text;
ALTER TABLE public.profiles ADD COLUMN last_name text;
ALTER TABLE public.profiles ADD COLUMN avatar_source text NOT NULL DEFAULT 'google';
ALTER TABLE public.profiles ADD CONSTRAINT profiles_avatar_source_check CHECK (avatar_source IN ('initials', 'google'));
ALTER TABLE public.profiles ALTER COLUMN notify_by_whatsapp SET DEFAULT false;
-- The server uses these indexes for owner-scoped, stable order pagination.
CREATE INDEX reservation_user_created_id_idx ON public.reservation (user_id, created_at DESC, id DESC);
CREATE INDEX payment_reservation_created_id_idx ON public.payment (reservation_id, created_at DESC, id DESC);
