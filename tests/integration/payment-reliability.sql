-- Run after the Comgate migration. Uses temporary tables only, with real
-- production constraints copied from the schema. No customer rows are edited.
BEGIN;
CREATE TEMP TABLE test_reward_claim (LIKE public.reservation INCLUDING ALL);
CREATE TEMP TABLE test_payment_attempt (LIKE public.payment INCLUDING ALL);
CREATE TEMP TABLE test_webhook_ledger (LIKE public.webhook_event INCLUDING ALL);
DO $$
DECLARE uid uuid := gen_random_uuid(); rid uuid := gen_random_uuid(); duplicate_rejected boolean := false;
BEGIN
 INSERT INTO test_reward_claim(id,user_id,starts_at,ends_at,status,price_cents,loyalty_reward)
 VALUES(rid,uid,'2035-01-01 10:00Z','2035-01-01 11:00Z','confirmed',0,1);
 BEGIN
  INSERT INTO test_reward_claim(user_id,starts_at,ends_at,status,price_cents,loyalty_reward)
  VALUES(uid,'2035-01-02 10:00Z','2035-01-02 11:00Z','confirmed',0,1);
 EXCEPTION WHEN unique_violation THEN duplicate_rejected := true;
 END;
 IF NOT duplicate_rejected THEN RAISE EXCEPTION 'same reward was consumed twice'; END IF;
 UPDATE test_reward_claim SET status='cancelled' WHERE id=rid;
 INSERT INTO test_reward_claim(user_id,starts_at,ends_at,status,price_cents,loyalty_reward)
 VALUES(uid,'2035-01-02 10:00Z','2035-01-02 11:00Z','confirmed',0,1);
 INSERT INTO test_payment_attempt(reservation_id,type,status,amount_cents,provider)
 VALUES(rid,'one_off','processing',28900,'comgate');
 duplicate_rejected := false;
 BEGIN
  INSERT INTO test_payment_attempt(reservation_id,type,status,amount_cents,provider)
  VALUES(rid,'one_off','pending',28900,'comgate');
 EXCEPTION WHEN unique_violation THEN duplicate_rejected := true;
 END;
 IF NOT duplicate_rejected THEN RAISE EXCEPTION 'second active payment was created'; END IF;
 -- The webhook transaction is rolled back as one unit after a handler error.
 BEGIN
  INSERT INTO test_webhook_ledger(provider,event_id) VALUES('comgate','crash-case');
  UPDATE test_payment_attempt SET status='succeeded' WHERE reservation_id=rid;
  RAISE EXCEPTION 'simulated worker failure';
 EXCEPTION WHEN raise_exception THEN NULL;
 END;
 IF EXISTS(SELECT 1 FROM test_webhook_ledger WHERE event_id='crash-case')
 OR EXISTS(SELECT 1 FROM test_payment_attempt WHERE status='succeeded') THEN
  RAISE EXCEPTION 'webhook ledger and payment were not rolled back together';
 END IF;
 INSERT INTO test_webhook_ledger(provider,event_id) VALUES('comgate','crash-case');
 PERFORM 1 FROM test_webhook_ledger WHERE event_id='crash-case' FOR UPDATE;
 UPDATE test_payment_attempt SET status='succeeded' WHERE reservation_id=rid;
 UPDATE test_webhook_ledger SET processed_at=now() WHERE event_id='crash-case';
 IF NOT EXISTS(SELECT 1 FROM test_webhook_ledger WHERE event_id='crash-case' AND processed_at IS NOT NULL) THEN RAISE EXCEPTION 'retry failed'; END IF;
END $$;
CREATE TEMP TABLE test_code_intent (LIKE public.access_code INCLUDING ALL);
DO $$
DECLARE rid uuid := gen_random_uuid(); rejected boolean := false;
BEGIN
 INSERT INTO test_code_intent(reservation_id,code_hash,valid_from,valid_until,status,failure_reason)
 VALUES(rid,'test-hash',now(),now()+interval '1 hour','failed','provisioning_unknown');
 BEGIN
  INSERT INTO test_code_intent(reservation_id,code_hash,valid_from,valid_until,status)
  VALUES(rid,'another-test-hash',now(),now()+interval '1 hour','scheduled');
 EXCEPTION WHEN unique_violation THEN rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'unknown issuance allowed a second code'; END IF;
END $$;
ROLLBACK;
SELECT 'reward, payment, webhook rollback/retry, code intent constraints passed' AS result;
