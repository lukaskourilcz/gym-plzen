-- Any discrepancy aborts and rolls back the entire migration transaction.
DO $$
DECLARE item record; digest text;
BEGIN
 FOR item IN SELECT * FROM pg_temp.credits_initial_snapshot LOOP
  EXECUTE format('select md5(coalesce(jsonb_agg(to_jsonb(t)-$1 order by coalesce(to_jsonb(t)->>''id'',to_jsonb(t)->>''key''))::text,''[]'')) from public.%I t',item.table_name)
   INTO digest USING item.excluded_columns;
  IF digest IS DISTINCT FROM item.fingerprint THEN
   RAISE EXCEPTION 'Credit release modified pre-existing row fields in %',item.table_name;
  END IF;
 END LOOP;
 IF EXISTS(SELECT FROM public.reservation WHERE pricing_version<>1 OR terms_version IS NOT NULL OR price_snapshot IS NOT NULL OR credit_paid_cents<>0)
  OR EXISTS(SELECT FROM public.booking_order WHERE credit_cents<>0)
  OR EXISTS(SELECT FROM public.participant_addition WHERE credit_cents<>0)
  OR EXISTS(SELECT FROM public.invoice WHERE credit_cents<>0) THEN
  RAISE EXCEPTION 'Initial credit release changed legacy defaults';
 END IF;
 IF EXISTS(SELECT FROM public.credit_account) OR EXISTS(SELECT FROM public.credit_entry)
  OR EXISTS(SELECT FROM public.credit_hold) OR EXISTS(SELECT FROM public.reservation_change) THEN
  RAISE EXCEPTION 'Initial credit release must contain no wallets, grants, holds or financial changes';
 END IF;
END $$;
