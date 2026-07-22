-- Custom SQL migration file, put your code below! --

-- Database-level guard against double-booking the single-occupancy gym.
-- The availability service also checks overlaps, but this exclusion constraint
-- makes it physically impossible for two *active* (pending/confirmed)
-- reservations to overlap in time; the second insert fails at the database.
-- Requires btree_gist (bundled with Postgres / available on Supabase).

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "reservation"
  ADD CONSTRAINT "reservation_no_overlap"
  EXCLUDE USING gist (tstzrange("starts_at", "ends_at") WITH &&)
  WHERE ("status" IN ('pending', 'confirmed'));
