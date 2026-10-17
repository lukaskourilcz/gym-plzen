-- Explicit maintenance operation, NEVER part of migrations or deployment.
-- Run in a transaction with SET LOCAL gym.legacy_conversion_ids = 'uuid,uuid'.
-- Only audited, truly empty admin reservations are accepted. No provider or
-- notification functions are called. The normal watchdog removes old codes.
DO $conversion$
DECLARE
  ids uuid[] := string_to_array(current_setting('gym.legacy_conversion_ids', true), ',')::uuid[];
  candidate uuid;
  r public.reservation%ROWTYPE;
  batch_id uuid;
  slot_window jsonb;
  date_key text;
  live_codes boolean;
BEGIN
  IF coalesce(cardinality(ids),0) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Provide 1–100 explicitly audited reservation IDs';
  END IF;
  FOR candidate IN SELECT DISTINCT unnest(ids) ORDER BY 1 LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('reservation:' || candidate::text,0));
  END LOOP;
  PERFORM pg_advisory_xact_lock(hashtextextended('booking-schedule',0));
  FOR candidate IN SELECT DISTINCT unnest(ids) ORDER BY 1 LOOP
    IF EXISTS(SELECT 1 FROM public.block_application WHERE snapshot->>'source'='legacy_reservation' AND snapshot->'legacy'->>'reservationId'=candidate::text) THEN
      CONTINUE;
    END IF;
    SELECT * INTO r FROM public.reservation WHERE id=candidate FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Audited reservation no longer exists: %',candidate; END IF;
    IF r.created_by_admin_id IS NULL OR r.user_id IS NOT NULL OR r.order_id IS NOT NULL
      OR coalesce(nullif(btrim(r.contact_email),''),nullif(btrim(r.contact_phone),'')) IS NOT NULL
      OR (nullif(btrim(r.contact_name),'') IS NOT NULL AND btrim(r.contact_name) NOT IN ('Zákazník bez jména','Zákazník beze jména'))
      OR r.status NOT IN ('confirmed','cancelled') OR coalesce(r.price_cents,0) <> 0
      OR r.extra_people <> 0 OR r.additional_people_paid_cents <> 0 OR r.loyalty_reward IS NOT NULL
      OR r.rules_accepted_at IS NOT NULL OR r.terms_accepted_at IS NOT NULL
      OR r.reschedule_starts_at IS NOT NULL OR r.reschedule_ends_at IS NOT NULL
      OR EXISTS(SELECT 1 FROM public.payment WHERE reservation_id=r.id)
      OR EXISTS(SELECT 1 FROM public.invoice WHERE reservation_id=r.id)
      OR EXISTS(SELECT 1 FROM public.participant_addition WHERE reservation_id=r.id)
      OR EXISTS(SELECT 1 FROM public.voucher_redemption WHERE reservation_id=r.id)
      OR EXISTS(SELECT 1 FROM public.reservation_reschedule WHERE reservation_id=r.id)
      OR EXISTS(SELECT 1 FROM public.entry_log WHERE reservation_id=r.id)
      OR EXISTS(SELECT 1 FROM public.message_delivery WHERE reservation_id=r.id AND (kind<>'operator_notice' OR status NOT IN ('sent','delivered','read')))
    THEN RAISE EXCEPTION 'Reservation is not an empty administrative block: %',r.id;
    END IF;
    batch_id := gen_random_uuid();
    date_key := to_char(r.starts_at AT TIME ZONE 'Europe/Prague','YYYY-MM-DD');
    slot_window := jsonb_build_object('dateKey',date_key,'startISO',to_char(r.starts_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'endISO',to_char(r.ends_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'label',to_char(r.starts_at AT TIME ZONE 'Europe/Prague','HH24:MI') || '–' || to_char(r.ends_at AT TIME ZONE 'Europe/Prague','HH24:MI'));
    INSERT INTO public.block_application(id,request,snapshot,fingerprint,cancelled_at)
    VALUES(batch_id,jsonb_build_object('templateIds','[]'::jsonb,'target',jsonb_build_object('mode','dates','dates',jsonb_build_array(date_key))),
      jsonb_build_object('source','legacy_reservation','templates','[]'::jsonb,'windows',CASE WHEN r.status='confirmed' THEN jsonb_build_array(slot_window) ELSE '[]'::jsonb END,
      'legacy',jsonb_build_object('version',1,'reservationId',r.id,'reservation',to_jsonb(r),
        'codes',coalesce((SELECT jsonb_agg(to_jsonb(a)-ARRAY['encrypted_pin','code_hash','code_last2']) FROM public.access_code a WHERE a.reservation_id=r.id),'[]'::jsonb),
        'pipeline',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM public.reservation_pipeline p WHERE p.reservation_id=r.id),'[]'::jsonb),
        'messageIds',coalesce((SELECT jsonb_agg(id) FROM public.message_delivery WHERE reservation_id=r.id),'[]'::jsonb))),
      md5(to_jsonb(r)::text),CASE WHEN r.status='cancelled' THEN now() ELSE NULL END);
    IF r.status='confirmed' THEN
      INSERT INTO public.blocked_slot(application_id,starts_at,ends_at,reason,note,created_by_admin_id)
      VALUES(batch_id,r.starts_at,r.ends_at,'other','Převedená původní blokace bez zákazníka',r.created_by_admin_id);
    END IF;
    SELECT EXISTS(SELECT 1 FROM public.access_code WHERE reservation_id=r.id AND status NOT IN ('revoked','expired')) INTO live_codes;
    UPDATE public.reservation SET status='cancelled',cancelled_at=coalesce(cancelled_at,now()),cancel_reason='Převedeno na blokovaný termín',access_revocation_pending=live_codes,updated_at=now() WHERE id=r.id;
    UPDATE public.reservation_pipeline SET status='failed',next_retry_at=NULL,last_error='Převedeno na blokovaný termín',updated_at=now() WHERE reservation_id=r.id AND status<>'succeeded';
    UPDATE public.system_alert SET resolved_at=now() WHERE resolved_at IS NULL AND (context->>'reservationId'=r.id::text OR dedupe_key LIKE 'reservation:' || r.id::text || ':%');
    INSERT INTO public.activity_log(actor_type,action,summary,context)
    VALUES('system','blocked_slot.legacy_converted','Prázdná administrátorská rezervace převedena na blokaci bez zákaznických zpráv.',jsonb_build_object('reservationId',r.id,'applicationId',batch_id,'originalStatus',r.status));
  END LOOP;
END $conversion$;
