-- Additive only: old reservations retain version 1; no seeds or customer writes.
ALTER TABLE reservation ADD COLUMN pricing_version integer NOT NULL DEFAULT 1,
 ADD COLUMN terms_version text, ADD COLUMN price_snapshot jsonb,
 ADD COLUMN credit_paid_cents integer NOT NULL DEFAULT 0 CHECK (credit_paid_cents >= 0);
ALTER TABLE booking_order ADD COLUMN credit_cents integer NOT NULL DEFAULT 0 CHECK (credit_cents >= 0 AND credit_cents <= total_cents);
ALTER TABLE participant_addition ADD COLUMN credit_cents integer NOT NULL DEFAULT 0 CHECK (credit_cents >= 0 AND credit_cents <= amount_cents);
CREATE TABLE credit_account (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid UNIQUE REFERENCES profiles(id) ON DELETE RESTRICT,
 guest_email text UNIQUE, guest_name text,
 balance_cents integer NOT NULL DEFAULT 0, reserved_cents integer NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT credit_account_balance_check CHECK (balance_cents >= reserved_cents AND reserved_cents >= 0),
 CONSTRAINT credit_account_owner_check CHECK ((user_id IS NOT NULL)::int + (guest_email IS NOT NULL)::int = 1)
);
CREATE TABLE credit_entry (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 account_id uuid NOT NULL REFERENCES credit_account(id) ON DELETE RESTRICT,
 amount_cents integer NOT NULL CHECK(amount_cents <> 0), reason text NOT NULL,
 operation_key text UNIQUE NOT NULL,
 reservation_id uuid REFERENCES reservation(id) ON DELETE RESTRICT,
 actor_id uuid REFERENCES profiles(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX credit_entry_account_created_idx ON credit_entry(account_id, created_at);
CREATE TABLE credit_hold (
 operation_key text PRIMARY KEY,
 account_id uuid NOT NULL REFERENCES credit_account(id) ON DELETE RESTRICT,
 amount_cents integer NOT NULL CHECK(amount_cents >= 0),
 status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','captured','released')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE reservation_change (
 id uuid PRIMARY KEY,
 reservation_id uuid NOT NULL REFERENCES reservation(id) ON DELETE RESTRICT,
 user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL CHECK(ends_at > starts_at),
 previous_starts_at timestamptz NOT NULL,
 previous_price_cents integer NOT NULL CHECK(previous_price_cents >= 0),
 new_price_cents integer NOT NULL CHECK(new_price_cents >= 0),
 credit_cents integer NOT NULL DEFAULT 0 CHECK(credit_cents >= 0),
 cash_cents integer NOT NULL DEFAULT 0 CHECK(cash_cents >= 0),
 status text NOT NULL CHECK(status IN ('awaiting_payment','applying','completed','cancelled','review_needed','refund_pending','refunded')),
 block_id uuid REFERENCES blocked_slot(id) ON DELETE RESTRICT,
 expires_at timestamptz NOT NULL, quote jsonb NOT NULL, error text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reservation_change_status_idx ON reservation_change(status, updated_at);
CREATE UNIQUE INDEX reservation_change_active_uidx ON reservation_change(reservation_id)
 WHERE status IN ('awaiting_payment','applying','review_needed','refund_pending');
ALTER TABLE payment ADD COLUMN reservation_change_id uuid REFERENCES reservation_change(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX payment_reservation_change_uidx ON payment(reservation_change_id);
-- Historical money movements are corrected by compensating entries, never edited.
CREATE FUNCTION credit_entry_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'Credit history is immutable; append a correction'; END $$;
CREATE TRIGGER credit_entry_immutable BEFORE UPDATE OR DELETE ON credit_entry
 FOR EACH ROW EXECUTE FUNCTION credit_entry_immutable();
REVOKE ALL ON FUNCTION credit_entry_immutable() FROM PUBLIC;
ALTER TABLE credit_account ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_hold ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_change ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON credit_account, credit_entry, credit_hold, reservation_change FROM anon, authenticated;
GRANT ALL ON credit_account, credit_entry, credit_hold, reservation_change TO service_role;
