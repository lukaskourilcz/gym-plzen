-- Reusable booking-time price periods. The public application reads these
-- through its server-side database connection; browser roles receive no
-- direct access.

CREATE TABLE public.pricing_period (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price_cents integer NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_by_admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pricing_period_price_positive CHECK (price_cents > 0),
  CONSTRAINT pricing_period_valid_range CHECK (ends_at > starts_at),
  CONSTRAINT pricing_period_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT pricing_period_no_overlap EXCLUDE USING gist (
    tstzrange(starts_at, ends_at, '[)') WITH &&
  )
);

CREATE INDEX pricing_period_starts_at_idx
  ON public.pricing_period (starts_at);
CREATE INDEX pricing_period_created_by_admin_idx
  ON public.pricing_period (created_by_admin_id);

ALTER TABLE public.pricing_period ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pricing_period FROM anon, authenticated;

-- Preserve a complete legacy one-off promotion when upgrading. Invalid or
-- partial legacy settings are ignored instead of aborting the migration.
DO $$
DECLARE
  legacy_price integer;
  legacy_start timestamptz;
  legacy_end timestamptz;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.pricing_period) THEN
    BEGIN
      SELECT (value #>> '{}')::integer INTO legacy_price
      FROM public.site_setting WHERE key = 'pricing.promo.price_cents';
      SELECT (value #>> '{}')::timestamptz INTO legacy_start
      FROM public.site_setting WHERE key = 'pricing.promo.starts_at';
      SELECT (value #>> '{}')::timestamptz INTO legacy_end
      FROM public.site_setting WHERE key = 'pricing.promo.ends_at';

      IF legacy_price > 0 AND legacy_end > legacy_start THEN
        INSERT INTO public.pricing_period (name, price_cents, starts_at, ends_at)
        VALUES (
          'Převedená časově omezená akce',
          legacy_price,
          legacy_start,
          legacy_end + interval '1 millisecond'
        );
      END IF;
    EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow THEN
      NULL;
    END;
  END IF;
END
$$;
