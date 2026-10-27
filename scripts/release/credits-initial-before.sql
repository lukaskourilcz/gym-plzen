-- First credit release only. Execute before the migration in the SAME transaction
-- as credits-initial-after.sql. No row values or PINs leave the database.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE public.reservation, public.access_code, public.payment,
 public.booking_order, public.participant_addition, public.invoice,
 public.message_delivery, public.profiles, public.reservation_pipeline,
 public.site_setting, public.opening_hours IN SHARE MODE;
CREATE TEMP TABLE credits_initial_snapshot (
 table_name text PRIMARY KEY, excluded_columns text[] NOT NULL, fingerprint text NOT NULL
) ON COMMIT DROP;
DO $$
DECLARE item record; digest text;
BEGIN
 FOR item IN SELECT * FROM (VALUES
  ('reservation',ARRAY['pricing_version','terms_version','price_snapshot','credit_paid_cents']),
  ('payment',ARRAY['reservation_change_id']),
  ('booking_order',ARRAY['credit_cents']),
  ('participant_addition',ARRAY['credit_cents']),
  ('invoice',ARRAY['credit_cents']),
  ('access_code',ARRAY[]::text[]),('message_delivery',ARRAY[]::text[]),
  ('profiles',ARRAY[]::text[]),('reservation_pipeline',ARRAY[]::text[]),
  ('site_setting',ARRAY[]::text[]),('opening_hours',ARRAY[]::text[])
 ) AS t(table_name,excluded_columns)
 LOOP
  EXECUTE format('select md5(coalesce(jsonb_agg(to_jsonb(t)-$1 order by coalesce(to_jsonb(t)->>''id'',to_jsonb(t)->>''key''))::text,''[]'')) from public.%I t',item.table_name)
   INTO digest USING item.excluded_columns;
  INSERT INTO pg_temp.credits_initial_snapshot VALUES(item.table_name,item.excluded_columns,digest);
 END LOOP;
END $$;
