-- Record the two consents every visitor now ticks before paying: the house
-- rules and the terms of business. Stored as timestamps rather than booleans so
-- the gym can show when the agreement was given, not merely that it was.
--
-- Nullable on purpose: rows created before this column existed, and admin
-- walk-in bookings entered on the visitor's behalf, have no consent of their own
-- to record.

ALTER TABLE public.reservation
  ADD COLUMN IF NOT EXISTS rules_accepted_at timestamp with time zone;
ALTER TABLE public.reservation
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamp with time zone;
