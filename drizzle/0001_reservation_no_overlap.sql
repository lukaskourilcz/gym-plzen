-- Custom SQL migration file, put your code below! --

-- Database-level guard against double-booking the single-occupancy gym.
--
-- Even though the availability service checks for overlaps before inserting,
-- two concurrent bookings could still race. This exclusion constraint makes it
-- physically impossible for two *active* (pending/confirmed) reservations to
-- overlap in time — the second insert fails at the database.
--
-- Requires the btree_gist extension (bundled with Postgres / available on
-- Supabase). tstzrange models the [start, end) interval; `&&` is "overlaps".

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "reservation"
  ADD CONSTRAINT "reservation_no_overlap"
  EXCLUDE USING gist (tstzrange("starts_at", "ends_at") WITH &&)
  WHERE ("status" IN ('pending', 'confirmed'));
