-- Audit-only additive index. No business rows, access codes, or messages change.
CREATE INDEX reservation_change_block_idx
  ON public.reservation_change (block_id)
  WHERE block_id IS NOT NULL;
