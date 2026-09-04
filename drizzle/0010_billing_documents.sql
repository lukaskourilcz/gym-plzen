-- Payment documents ("doklad o zaplacení", a tax document when the operator is
-- a VAT payer) issued for paid reservations, plus the gapless per-year counter
-- behind their numbers.
--
-- Both parties are frozen on the row: a document records what was true when it
-- was issued, so a later change of address or account name must not rewrite
-- history. The PDF itself is rendered on demand from these columns, so there is
-- no blob to keep in sync.
--
-- As everywhere else, all access is server-side: browser Data API roles get no
-- privileges and RLS is enabled as defense in depth. These rows carry customer
-- names, e-mail addresses and amounts.

CREATE TABLE IF NOT EXISTS public.document_counter (
  key text PRIMARY KEY,
  value integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT document_counter_value_check CHECK (value >= 0)
);

CREATE TABLE IF NOT EXISTS public.invoice (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL,
  year integer NOT NULL,
  reservation_id uuid NOT NULL REFERENCES public.reservation(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  issued_at timestamp with time zone NOT NULL DEFAULT now(),
  supplied_at timestamp with time zone NOT NULL,
  total_cents integer NOT NULL,
  base_cents integer NOT NULL,
  vat_cents integer NOT NULL,
  vat_rate_percent integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'czk',
  description text NOT NULL,
  customer_name text,
  customer_email text,
  supplier jsonb NOT NULL,
  sent_at timestamp with time zone,
  sent_to text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT invoice_amounts_check CHECK (
    total_cents >= 0
    AND base_cents >= 0
    AND vat_cents >= 0
    AND base_cents + vat_cents = total_cents
  ),
  CONSTRAINT invoice_vat_rate_check CHECK (
    vat_rate_percent BETWEEN 0 AND 100
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS invoice_number_uidx
  ON public.invoice (number);
-- One document per reservation: re-running fulfillment must never issue a
-- second number for a payment that already has one.
CREATE UNIQUE INDEX IF NOT EXISTS invoice_reservation_uidx
  ON public.invoice (reservation_id);
CREATE INDEX IF NOT EXISTS invoice_issued_at_idx
  ON public.invoice (issued_at);
CREATE INDEX IF NOT EXISTS invoice_user_idx
  ON public.invoice (user_id);

ALTER TABLE public.document_counter ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.document_counter FROM anon, authenticated;
REVOKE ALL ON public.invoice FROM anon, authenticated;
