-- Manual invoice sends participate in the existing delivery ledger and archive.
ALTER TYPE public.message_kind ADD VALUE IF NOT EXISTS 'payment_document';
