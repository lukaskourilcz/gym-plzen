-- Recent-message and archive views order the complete history by creation time.
CREATE INDEX message_delivery_created_idx ON public.message_delivery (created_at);
