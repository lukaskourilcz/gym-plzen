-- Same explicit ID allowlist as convert-legacy-blocks.sql. Replay is harmless.
-- A live/unconfirmed authorization keeps its original reservation and DB link.
DO $finalize$
DECLARE
  ids uuid[] := string_to_array(current_setting('gym.legacy_conversion_ids',true),',')::uuid[];
  candidate uuid;
  r public.reservation%ROWTYPE;
  batch public.block_application%ROWTYPE;
  original jsonb;
BEGIN
  IF coalesce(cardinality(ids),0) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Explicit audited IDs required'; END IF;
  FOR candidate IN SELECT DISTINCT unnest(ids) ORDER BY 1 LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('reservation:' || candidate::text,0));
  END LOOP;
  PERFORM pg_advisory_xact_lock(hashtextextended('booking-schedule',0));
  FOR candidate IN SELECT DISTINCT unnest(ids) ORDER BY 1 LOOP
    SELECT * INTO batch FROM public.block_application WHERE snapshot->>'source'='legacy_reservation' AND snapshot->'legacy'->>'reservationId'=candidate::text;
    IF NOT FOUND THEN RAISE EXCEPTION 'Reservation has no archived conversion: %',candidate; END IF;
    SELECT * INTO r FROM public.reservation WHERE id=candidate FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;
    original := batch.snapshot->'legacy'->'reservation';
    IF r.status<>'cancelled' OR r.cancel_reason IS DISTINCT FROM 'Převedeno na blokovaný termín'
      OR (to_jsonb(r)-ARRAY['status','cancelled_at','cancel_reason','access_revocation_pending','updated_at']) IS DISTINCT FROM (original-ARRAY['status','cancelled_at','cancel_reason','access_revocation_pending','updated_at'])
      OR EXISTS(SELECT 1 FROM public.payment WHERE reservation_id=r.id)
      OR EXISTS(SELECT 1 FROM public.invoice WHERE reservation_id=r.id)
      OR EXISTS(SELECT 1 FROM public.participant_addition WHERE reservation_id=r.id)
      OR EXISTS(SELECT 1 FROM public.voucher_redemption WHERE reservation_id=r.id)
      OR EXISTS(SELECT 1 FROM public.reservation_reschedule WHERE reservation_id=r.id)
      OR EXISTS(SELECT 1 FROM public.entry_log WHERE reservation_id=r.id)
      OR EXISTS(SELECT 1 FROM public.message_delivery WHERE reservation_id=r.id AND (kind<>'operator_notice' OR status NOT IN ('sent','delivered','read')))
    THEN RAISE EXCEPTION 'Converted reservation has changed; review required: %',candidate; END IF;
    IF EXISTS(SELECT 1 FROM public.access_code WHERE reservation_id=r.id AND status NOT IN ('revoked','expired')) THEN CONTINUE; END IF;
    IF original->>'status'='confirmed' AND batch.cancelled_at IS NULL AND NOT EXISTS(SELECT 1 FROM public.blocked_slot WHERE application_id=batch.id AND starts_at=r.starts_at AND ends_at=r.ends_at) THEN
      RAISE EXCEPTION 'Replacement block is missing: %',candidate;
    END IF;
    DELETE FROM public.reservation WHERE id=r.id;
    INSERT INTO public.activity_log(actor_type,action,summary,context)
    VALUES('system','blocked_slot.legacy_finalized','Původní prázdná rezervace odstraněna po ověření odebrání kódů; audit je zachován v blokaci.',jsonb_build_object('reservationId',r.id,'applicationId',batch.id));
  END LOOP;
END $finalize$;
