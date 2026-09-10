-- Additive change: legacy payment references are retained for audit history.
ALTER TABLE public.reservation ADD COLUMN confirmation_token_hash text;
ALTER TABLE public.reservation ADD COLUMN loyalty_reward integer;
CREATE UNIQUE INDEX reservation_loyalty_reward_uidx ON public.reservation(user_id, loyalty_reward)
 WHERE loyalty_reward IS NOT NULL AND status <> 'cancelled';
ALTER TABLE public.payment ADD COLUMN provider text NOT NULL DEFAULT 'legacy';
ALTER TABLE public.payment ADD COLUMN provider_payment_id text;
ALTER TABLE public.payment ADD COLUMN provider_merchant_id text;
ALTER TABLE public.payment ADD COLUMN provider_environment text;
ALTER TABLE public.payment ADD COLUMN gateway_url text;
ALTER TABLE public.payment ADD COLUMN last_checked_at timestamptz;
CREATE UNIQUE INDEX payment_provider_id_uidx ON public.payment(provider, provider_payment_id);
CREATE UNIQUE INDEX payment_active_reservation_uidx ON public.payment(reservation_id)
 WHERE provider = 'comgate' AND status IN ('pending', 'processing', 'succeeded');
CREATE INDEX payment_provider_check_idx ON public.payment(provider, status, last_checked_at);
-- Online payments and physical access are activated independently by the operator.
INSERT INTO public.site_setting(key, value)
VALUES ('booking.operations', '{"paymentsEnabled":false,"bookingsFrom":"","accessCodesEnabled":false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE UNIQUE INDEX access_code_one_live_uidx ON public.access_code(reservation_id) WHERE status NOT IN ('revoked', 'expired');
