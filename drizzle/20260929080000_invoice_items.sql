-- One line per slot on the payment document of a multi-slot order
-- (docs/MULTI_SLOT_ORDER_PLAN_2026_09_28.md). Additive and nullable: existing
-- single-slot documents keep their description only. Apply before deploying.
ALTER TABLE public.invoice ADD COLUMN items jsonb;
