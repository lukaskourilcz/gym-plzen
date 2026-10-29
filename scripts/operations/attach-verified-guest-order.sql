-- Explicitly approved one-off repair, never a migration or an automatic matcher.
-- In ONE transaction set navi.repair.{order_id,user_id,old_email,new_email,slot_ids}
-- with set_config(..., ..., true). slot_ids is a PostgreSQL UUID array literal.
-- Identity must also have been independently verified with the operator.
-- Refuses completed/near-term work, existing codes, invoices, credits or moves.
DO $repair$
DECLARE
  order_key uuid := current_setting('navi.repair.order_id')::uuid;
  member_key uuid := current_setting('navi.repair.user_id')::uuid;
  old_email text := current_setting('navi.repair.old_email');
  new_email text := current_setting('navi.repair.new_email');
  slot_keys uuid[] := current_setting('navi.repair.slot_ids')::uuid[];
  slot_key uuid;
  purchased public.booking_order%ROWTYPE;
  member public.profiles%ROWTYPE;
  snapshot jsonb;
  original jsonb;
  phase integer;
  affected integer;
BEGIN
  PERFORM set_config('lock_timeout','5s',true);
  PERFORM set_config('statement_timeout','20s',true);
  IF cardinality(slot_keys) <> 5 OR old_email = new_email THEN
    RAISE EXCEPTION 'Repair requires five explicitly verified slots and a corrected email';
  END IF;
  -- Same advisory locks/order as fulfillment: reservations before order announcement.
  FOR slot_key IN SELECT id FROM unnest(slot_keys) id ORDER BY id LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('reservation:' || slot_key,0));
  END LOOP;
  PERFORM pg_advisory_xact_lock(hashtextextended('order:' || order_key,0));
  PERFORM pg_advisory_xact_lock(hashtextextended('order-fulfillment:' || order_key,0));
  PERFORM pg_advisory_xact_lock(hashtextextended('confirmation:order-confirmation/' || order_key,0));
  SELECT * INTO STRICT purchased FROM public.booking_order WHERE id=order_key FOR UPDATE;
  SELECT * INTO STRICT member FROM public.profiles WHERE id=member_key FOR UPDATE;
  PERFORM 1 FROM public.reservation WHERE order_id=order_key ORDER BY id FOR UPDATE;
  IF purchased.user_id IS NOT NULL OR purchased.status <> 'confirmed'
    OR purchased.contact_email IS DISTINCT FROM old_email OR purchased.credit_cents <> 0
    OR member.role <> 'member' OR member.email IS DISTINCT FROM new_email
    OR nullif(trim(member.full_name),'') IS NULL
    OR lower(trim(member.full_name)) IS DISTINCT FROM lower(trim(purchased.contact_name))
    OR length(regexp_replace(coalesce(member.phone,''),'[^0-9]','','g')) < 9
    OR regexp_replace(member.phone,'[^0-9]','','g') IS DISTINCT FROM regexp_replace(purchased.contact_phone,'[^0-9]','','g')
    OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id=member_key AND email=new_email AND email_confirmed_at IS NOT NULL)
  THEN RAISE EXCEPTION 'Guest ownership or verified identity does not match'; END IF;
  IF (SELECT array_agg(id ORDER BY id) FROM public.reservation WHERE order_id=order_key)
    IS DISTINCT FROM (SELECT array_agg(id ORDER BY id) FROM unnest(slot_keys) id)
    OR EXISTS (SELECT 1 FROM public.reservation WHERE order_id=order_key AND
      (user_id IS NOT NULL OR status <> 'confirmed' OR contact_email IS DISTINCT FROM old_email
      OR starts_at <= now() + interval '24 hours' OR reschedule_starts_at IS NOT NULL
      OR access_revocation_pending OR loyalty_reward IS NOT NULL OR credit_paid_cents <> 0))
    OR EXISTS (SELECT 1 FROM public.access_code WHERE reservation_id=ANY(slot_keys))
    OR EXISTS (SELECT 1 FROM public.invoice WHERE order_id=order_key OR reservation_id=ANY(slot_keys))
    OR (SELECT count(*) FROM public.reservation_pipeline WHERE reservation_id=ANY(slot_keys)
      AND ((step='payment' AND status='succeeded') OR (step IN ('code_created','code_delivered') AND status='pending' AND attempts=0))) <> 15
    OR NOT EXISTS (SELECT 1 FROM public.message_delivery WHERE dedupe_key='order-confirmation/' || order_key
      AND reservation_id=ANY(slot_keys) AND recipient=old_email AND status IN ('sent','delivered','read'))
  THEN RAISE EXCEPTION 'Order contents or fulfillment state changed; investigate again'; END IF;

  FOR phase IN 0..1 LOOP
    -- Compare every reservation/order field except the three permitted fields.
    -- Other rows are compared in full (including encrypted codes, never output).
    SELECT jsonb_build_object(
      'order',(SELECT to_jsonb(o)-ARRAY['user_id','contact_email','updated_at'] FROM public.booking_order o WHERE id=order_key),
      'slots',(SELECT jsonb_agg(to_jsonb(r)-ARRAY['user_id','contact_email','updated_at'] ORDER BY id) FROM public.reservation r WHERE order_id=order_key),
      'profile',(SELECT to_jsonb(p) FROM public.profiles p WHERE id=member_key),
      'codes',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM public.access_code c WHERE reservation_id=ANY(slot_keys)),
      'pipeline',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.reservation_pipeline p WHERE reservation_id=ANY(slot_keys)),
      'messages',(SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM public.message_delivery m WHERE reservation_id=ANY(slot_keys)),
      'payments',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.payment p WHERE order_id=order_key OR reservation_id=ANY(slot_keys)),
      'invoices',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM public.invoice i WHERE order_id=order_key OR reservation_id=ANY(slot_keys))
    ) INTO snapshot;
    IF phase=0 THEN
      original := snapshot;
      UPDATE public.booking_order SET user_id=member_key,contact_email=new_email,updated_at=now() WHERE id=order_key;
      UPDATE public.reservation SET user_id=member_key,contact_email=new_email,updated_at=now() WHERE order_id=order_key;
      GET DIAGNOSTICS affected = ROW_COUNT;
      IF affected <> 5 THEN RAISE EXCEPTION 'Unexpected updated reservation count'; END IF;
    ELSIF snapshot IS DISTINCT FROM original THEN
      RAISE EXCEPTION 'Protected booking, financial or delivery data changed; rolling back';
    END IF;
  END LOOP;
  INSERT INTO public.activity_log (actor_type,actor_label,action,member_id,summary,context)
    VALUES ('system','Jednorázová oprava schválená provozovatelem','guest_order_attached',member_key,
      'Pět ověřených rezervací přiřazeno k účtu; opravena kontaktní adresa. Bez odesílání a změny termínů, cen či kódů.',
      jsonb_build_object('orderId',order_key,'reservationIds',to_jsonb(slot_keys),'previousEmail',old_email,'correctedEmail',new_email));
END $repair$;
