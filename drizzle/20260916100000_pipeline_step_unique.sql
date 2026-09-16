-- One row per (reservation, step). `initPipeline` relied on ON CONFLICT DO
-- NOTHING, but nothing could conflict, so repeated initialisation duplicated
-- steps. Keep the newest row of each duplicate group, then enforce uniqueness.
DELETE FROM public.reservation_pipeline AS p
USING public.reservation_pipeline AS newer
WHERE p.reservation_id = newer.reservation_id
  AND p.step = newer.step
  AND (p.created_at, p.id) < (newer.created_at, newer.id);
CREATE UNIQUE INDEX reservation_pipeline_step_uidx
  ON public.reservation_pipeline (reservation_id, step);
