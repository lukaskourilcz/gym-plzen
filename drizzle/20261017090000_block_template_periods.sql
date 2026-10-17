-- Existing templates remain unconfigured until the administrator selects a period.
-- No applications, blocks, reservations, codes or messages are modified.
ALTER TABLE public.block_template
  ADD COLUMN valid_from date,
  ADD COLUMN valid_to date,
  ADD CONSTRAINT block_template_period_check CHECK (
    (valid_from IS NULL AND valid_to IS NULL) OR
    (valid_from IS NOT NULL AND valid_to IS NOT NULL AND valid_to >= valid_from AND valid_to - valid_from <= 365)
  );
