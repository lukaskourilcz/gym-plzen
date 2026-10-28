import {
  databaseReady,
  rows,
  seedProfile,
  resetDatabase,
  resend,
  startProviders,
  stopEverything,
  setSetting,
} from "./setup";
import { before, beforeEach, after, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  cancelByCustomer,
  cancelReservation,
  listCustomerReservationHistory,
} from "../../src/lib/services/reservations";
import {
  deliverCancellation,
  retryCancellationEmails,
} from "../../src/lib/services/cancellation-delivery";
import { getLoyaltyStatus } from "../../src/lib/services/loyalty";
const member = {
  id: "44444444-4444-4444-8444-444444444444",
  email: "storno@example.test",
  fullName: "Jana Stornová",
};
async function fixture(price = 19900, reward: number | null = null) {
  const [r] = await rows<{ id: string }>(
    `insert into reservation(user_id,starts_at,ends_at,status,price_cents,contact_email,contact_name,loyalty_reward)
  values($1,now()+interval '12 hours'+(select count(*) from reservation)*interval '2 hours',now()+interval '13 hours'+(select count(*) from reservation)*interval '2 hours','confirmed',$2,$3,'Jana Stornová',$4) returning id`,
    [member.id, price, member.email, reward],
  );
  return r!.id;
}
describe("customer cancellation outbox", { skip: !databaseReady }, () => {
  before(startProviders);
  after(stopEverything);
  beforeEach(async () => {
    await resetDatabase();
    await seedProfile(member);
    await setSetting("messages.email.reservation_cancellation", null);
    await setSetting("messages.email.customer_reservation_cancellation", null);
  });
  test("only a new customer cancellation gets the dedicated editable template; repeated cancellation sends once", async () => {
    const id = await fixture();
    await setSetting("messages.email.customer_reservation_cancellation", {
      subject: "Vaše storno",
      body: "{name} | {time} | {price} | {refund_note}",
    });
    await cancelByCustomer({ reservationId: id, userId: member.id });
    await cancelByCustomer({ reservationId: id, userId: member.id });
    assert.equal(resend.sent.length, 1);
    assert.match(resend.sent[0]!.subject, /Vaše storno/);
    assert.match(resend.sent[0]!.text!, /199.*nevrací/);
    const intents = await rows(
      "select * from message_delivery where dedupe_key=$1",
      [`cancellation/${id}`],
    );
    assert.equal(intents.length, 1);
    assert.equal(
      (
        await rows(
          "select * from activity_log where reservation_id=$1 and action='reservation.cancelled'",
          [id],
        )
      ).length,
      1,
    );
    assert.equal(
      (
        await rows(
          "select * from system_alert where dedupe_key like 'refund-needed:%'",
        )
      ).length,
      0,
    );
  });
  test("a lost provider response reuses frozen template bytes even after editing the template", async () => {
    const id = await fixture();
    resend.loseNextAcceptedResponse();
    await cancelByCustomer({ reservationId: id, userId: member.id });
    assert.equal(resend.sent.length, 1);
    const [message] = await rows<{ status: string }>(
      "select status from message_delivery where dedupe_key=$1",
      [`cancellation/${id}`],
    );
    assert.equal(message!.status, "failed");
    await setSetting("messages.email.customer_reservation_cancellation", {
      subject: "Změněné znění",
      body: "Tento text nesmí změnit opakování.",
    });
    await rows(
      "update message_delivery set updated_at=now()-interval '6 minutes' where dedupe_key=$1",
      [`cancellation/${id}`],
    );
    await retryCancellationEmails();
    assert.equal(resend.sent.length, 1);
    assert.equal(
      (
        await rows<{ status: string }>(
          "select status from message_delivery where dedupe_key=$1",
          [`cancellation/${id}`],
        )
      )[0]!.status,
      "sent",
    );
    await deliverCancellation(id);
    assert.equal(resend.sent.length, 1);
  });
  test("old customer cancellations never gain a new outbox, and administrator cancellation keeps its original template", async () => {
    const id = await fixture();
    await rows(
      "update reservation set status='cancelled',cancel_reason='Zrušeno zákazníkem (bez vrácení platby)' where id=$1",
      [id],
    );
    await deliverCancellation(id);
    await retryCancellationEmails();
    assert.equal(resend.sent.length, 0);
    const admin = await fixture();
    await cancelReservation({ id: admin, reason: "Úklid" });
    assert.match(resend.sent[0]!.subject, /^Zrušení rezervace/);
    assert.match(resend.sent[0]!.text!, /Úklid/);
  });
  test("customer outbox older than the safe provider window requires manual reconciliation", async () => {
    const id = await fixture();
    resend.rateLimitNext(2);
    await cancelByCustomer({ reservationId: id, userId: member.id });
    await rows(
      "update message_delivery set created_at=now()-interval '23 hours',updated_at=now()-interval '6 minutes' where dedupe_key=$1",
      [`cancellation/${id}`],
    );
    resend.rateLimitNext(0);
    await retryCancellationEmails();
    await deliverCancellation(id);
    assert.equal(resend.sent.length, 0);
    assert.equal(
      (
        await rows<{ failure_reason: string }>(
          "select failure_reason from message_delivery where dedupe_key=$1",
          [`cancellation/${id}`],
        )
      )[0]!.failure_reason,
      "customer_cancellation_reconcile_required",
    );
  });
  test("administrator cancellation retries the exact frozen message after a lost response and a template edit", async () => {
    const id = await fixture();
    resend.loseNextAcceptedResponse();
    await cancelReservation({ id, reason: "Údržba" });
    assert.equal(resend.sent.length, 1);
    await setSetting("messages.email.reservation_cancellation", {
      subject: "Nové znění",
      body: "{reason} se teď změnilo.",
    });
    await rows(
      "update message_delivery set updated_at=now()-interval '6 minutes' where dedupe_key=$1",
      [`cancellation/${id}`],
    );
    await retryCancellationEmails();
    const [stored] = await rows<{ status: string }>(
      "select status from message_delivery where dedupe_key=$1",
      [`cancellation/${id}`],
    );
    assert.equal(stored!.status, "sent");
    assert.equal(resend.sent.length, 1);
  });
  test("administrator cancellation never posts after the safe provider window", async () => {
    const id = await fixture();
    resend.rateLimitNext(2);
    await cancelReservation({ id, reason: "Údržba" });
    await rows(
      "update message_delivery set created_at=now()-interval '23 hours',updated_at=now()-interval '6 minutes' where dedupe_key=$1",
      [`cancellation/${id}`],
    );
    resend.rateLimitNext(0);
    await retryCancellationEmails();
    await deliverCancellation(id);
    assert.equal(resend.sent.length, 0);
    const [stored] = await rows<{ failure_reason: string }>(
      "select failure_reason from message_delivery where dedupe_key=$1",
      [`cancellation/${id}`],
    );
    assert.equal(
      stored!.failure_reason,
      "customer_cancellation_reconcile_required",
    );
  });
  test("legacy uncertain administrator sends without their original bytes require review instead of rebuilding a message", async () => {
    const id = await fixture();
    resend.loseNextAcceptedResponse();
    await cancelReservation({ id, reason: "Údržba" });
    await rows(
      "update message_delivery set provider_response=null,updated_at=now()-interval '6 minutes' where dedupe_key=$1",
      [`cancellation/${id}`],
    );
    await retryCancellationEmails();
    const [stored] = await rows<{ failure_reason: string }>(
      "select failure_reason from message_delivery where dedupe_key=$1",
      [`cancellation/${id}`],
    );
    assert.equal(
      stored!.failure_reason,
      "customer_cancellation_reconcile_required",
    );
    assert.equal(resend.sent.length, 1);
  });
  test("cancelling a bonus removes it from loyalty without changing other reservations, codes, payments or invoices", async () => {
    const id = await fixture(0, 1);
    const other = await fixture();
    const [order] = await rows<{ id: string }>(
      "insert into booking_order(user_id,total_cents,status) values($1,19900,'confirmed') returning id",
      [member.id],
    );
    await rows("update reservation set order_id=$1 where id in ($2,$3)", [
      order!.id,
      id,
      other,
    ]);
    await rows(
      "insert into payment(user_id,order_id,type,status,amount_cents) values($1,$2,'one_off','succeeded',19900)",
      [member.id, order!.id],
    );
    await rows(
      "insert into invoice(number,year,reservation_id,order_id,user_id,supplied_at,total_cents,base_cents,vat_cents,description,supplier) values('LOCAL-ONLY-1',2026,$1,$2,$3,now(),19900,19900,0,'Isolated test order','{}')",
      [id, order!.id, member.id],
    );
    await rows(
      "insert into access_code(reservation_id,code_hash,valid_from,valid_until,provision_state,status) select id,'synthetic-'||id,starts_at,ends_at,'prepared','scheduled' from reservation where id in ($1,$2)",
      [id, other],
    );
    const state = () =>
      rows(
        `select (select md5(string_agg(to_jsonb(r)::text,'' order by id)) from reservation r where id<>$1) as bookings,
      (select md5(coalesce(string_agg(to_jsonb(c)::text,'' order by id),'')) from access_code c where reservation_id<>$1) as codes,
      (select md5(coalesce(string_agg(to_jsonb(p)::text,'' order by id),'')) from payment p) as payments,
      (select md5(coalesce(string_agg(to_jsonb(i)::text,'' order by id),'')) from invoice i) as invoices`,
        [id],
      );
    const before = await state();
    const initial = (await getLoyaltyStatus(member.id)).totalEntries;
    await cancelByCustomer({ reservationId: id, userId: member.id });
    assert.deepEqual(await state(), before);
    assert.equal(
      (
        await rows<{ status: string }>(
          "select status from access_code where reservation_id=$1",
          [id],
        )
      )[0]!.status,
      "revoked",
    );
    assert.equal(
      (
        await rows<{ status: string }>(
          "select status from access_code where reservation_id=$1",
          [other],
        )
      )[0]!.status,
      "scheduled",
    );
    assert.equal((await getLoyaltyStatus(member.id)).totalEntries, initial - 1);
    assert.match(resend.sent[0]!.text!, /bonusový 10. vstup zdarma/);
    assert.doesNotMatch(resend.sent[0]!.text!, /Zaplacených/);
    const history = await listCustomerReservationHistory(member.id, 1);
    assert.deepEqual(
      history.map((r) => r.id),
      [id],
    );
    assert.notEqual(other, id);
  });
});
