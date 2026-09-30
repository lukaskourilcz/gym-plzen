-- Drizzle custom migration. Apply atomically before deploying the new code.
ALTER TABLE public.reservation
 ADD COLUMN reschedule_starts_at timestamptz,
 ADD COLUMN reschedule_ends_at timestamptz,
 ADD CONSTRAINT reservation_reschedule_window_valid CHECK (
   (reschedule_starts_at IS NULL AND reschedule_ends_at IS NULL)
   OR (reschedule_starts_at IS NOT NULL AND reschedule_ends_at IS NOT NULL
       AND reschedule_ends_at > reschedule_starts_at)
 );

-- A durable Nuki intent may survive a crashed request. Keep both the original
-- and proposed training windows unavailable until the device is reconciled.
ALTER TABLE public.reservation DROP CONSTRAINT reservation_no_overlap;
ALTER TABLE public.reservation ADD CONSTRAINT reservation_no_overlap
 EXCLUDE USING gist ((CASE WHEN reschedule_starts_at IS NULL
   THEN tstzmultirange(tstzrange(starts_at,ends_at,'[)'))
   ELSE tstzmultirange(tstzrange(starts_at,ends_at,'[)'),
                      tstzrange(reschedule_starts_at,reschedule_ends_at,'[)'))
 END) WITH &&)
 WHERE (status IN ('pending','confirmed') OR access_revocation_pending);
