-- Admin-managed reservation vouchers and public newsletter consent records.
-- All business access stays server-side; browser Data API roles receive no
-- privileges and RLS is enabled as defense in depth.

DO $$ BEGIN
  CREATE TYPE public.voucher_kind AS ENUM ('percentage', 'fixed_amount');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.voucher_redemption_status AS ENUM ('reserved', 'redeemed', 'released');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.newsletter_subscription_status AS ENUM ('subscribed', 'unsubscribed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.voucher (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  kind public.voucher_kind NOT NULL,
  value integer NOT NULL,
  max_redemptions integer,
  is_active boolean NOT NULL DEFAULT true,
  valid_from timestamp with time zone,
  valid_until timestamp with time zone,
  created_by_admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT voucher_value_check CHECK (
    (kind = 'percentage' AND value BETWEEN 1 AND 100)
    OR (kind = 'fixed_amount' AND value > 0)
  ),
  CONSTRAINT voucher_max_redemptions_check CHECK (
    max_redemptions IS NULL OR max_redemptions > 0
  ),
  CONSTRAINT voucher_validity_check CHECK (
    valid_from IS NULL OR valid_until IS NULL OR valid_until > valid_from
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS voucher_code_normalized_uidx
  ON public.voucher (upper(code));
CREATE INDEX IF NOT EXISTS voucher_active_validity_idx
  ON public.voucher (is_active, valid_from, valid_until);

CREATE TABLE IF NOT EXISTS public.voucher_redemption (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid NOT NULL REFERENCES public.voucher(id) ON DELETE RESTRICT,
  reservation_id uuid NOT NULL REFERENCES public.reservation(id) ON DELETE CASCADE,
  status public.voucher_redemption_status NOT NULL DEFAULT 'reserved',
  original_price_cents integer NOT NULL,
  discount_cents integer NOT NULL,
  final_price_cents integer NOT NULL,
  reserved_until timestamp with time zone NOT NULL,
  redeemed_at timestamp with time zone,
  released_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT voucher_redemption_amounts_check CHECK (
    original_price_cents >= 0
    AND discount_cents >= 0
    AND final_price_cents >= 0
    AND original_price_cents - discount_cents = final_price_cents
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS voucher_redemption_reservation_uidx
  ON public.voucher_redemption (reservation_id);
CREATE INDEX IF NOT EXISTS voucher_redemption_voucher_status_idx
  ON public.voucher_redemption (voucher_id, status);
CREATE INDEX IF NOT EXISTS voucher_redemption_reserved_until_idx
  ON public.voucher_redemption (reserved_until);

CREATE TABLE IF NOT EXISTS public.newsletter_subscriber (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  status public.newsletter_subscription_status NOT NULL DEFAULT 'subscribed',
  source text NOT NULL DEFAULT 'homepage',
  consented_at timestamp with time zone NOT NULL DEFAULT now(),
  unsubscribed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscriber_email_normalized_uidx
  ON public.newsletter_subscriber (email);
CREATE INDEX IF NOT EXISTS newsletter_subscriber_status_created_idx
  ON public.newsletter_subscriber (status, created_at);

ALTER TABLE public.voucher ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_redemption ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscriber ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.voucher FROM anon, authenticated;
REVOKE ALL ON public.voucher_redemption FROM anon, authenticated;
REVOKE ALL ON public.newsletter_subscriber FROM anon, authenticated;
