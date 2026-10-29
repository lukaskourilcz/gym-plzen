import {
  databaseReady,
  resend,
  comgate,
  resetDatabase,
  rows,
  seedProfile,
  setSetting,
  startProviders,
  stopEverything,
} from "./setup";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { after, before, beforeEach, describe, test } from "node:test";
import { startOrder } from "../../src/lib/services/orders";
import { synchronizeComgatePayment } from "../../src/lib/services/payments";
import { fulfillReservation } from "../../src/lib/services/fulfillment";
import { listCustomerOrders } from "../../src/lib/services/customer-orders";
import { getLoyaltyStatus } from "../../src/lib/services/loyalty";
import {
  prepareTransactionalEmail,
  saveEmailTemplate,
} from "../../src/lib/services/email-templates";
import { requireTestDatabaseUrl } from "../helpers/test-database";

const MEMBER = {
  id: "abcb4321-4321-4321-8321-123412341234",
  email: "guest-repair@example.test",
  fullName: "Ukázková Zákaznice",
  phone: "+420733555222",
};
const WRONG = "guest-repair@exampl.test";

describe(
  "explicit one-off guest order repair",
  { skip: !databaseReady && "requires local database" },
  () => {
    let connection: ReturnType<typeof postgres>;
    before(async () => {
      await startProviders();
      connection = postgres(requireTestDatabaseUrl(), {
        max: 1,
        prepare: false,
      });
      // Minimal local identity stand-in; never calls a hosted Auth service.
      await connection`create schema if not exists auth`;
      await connection`create table if not exists auth.users (id uuid primary key, email text, email_confirmed_at timestamptz)`;
    });
    after(async () => {
      await connection?.end({ timeout: 2 });
      await stopEverything();
    });
    beforeEach(async () => {
      await resetDatabase();
      await seedProfile(MEMBER);
      await connection`insert into auth.users (id,email,email_confirmed_at) values (${MEMBER.id},${MEMBER.email},now()) on conflict (id) do update set email=excluded.email,email_confirmed_at=excluded.email_confirmed_at`;
    });
    async function fixture() {
      const starts = Array.from(
        { length: 5 },
        (_, i) => new Date(Date.now() + (5 + i) * 86_400_000),
      );
      // Use exact whole hours on the fixture's 60-minute schedule.
      for (const start of starts) start.setUTCMinutes(0, 0, 0);
      const result = await startOrder({
        userId: null,
        starts,
        details: {
          name: MEMBER.fullName,
          email: WRONG,
          phone: MEMBER.phone,
          acceptedAt: new Date(),
        },
      });
      assert.equal(result.kind, "checkout");
      comgate.settle("TEST-0001", "PAID");
      await synchronizeComgatePayment("TEST-0001");
      const slots = await rows<{ id: string }>(
        "select id from reservation where order_id=$1 order by id",
        [result.orderId],
      );
      return { orderId: result.orderId, slots: slots.map((r) => r.id) };
    }
    async function repair(orderId: string, slots: string[]) {
      const script = await readFile(
        "scripts/operations/attach-verified-guest-order.sql",
        "utf8",
      );
      await connection.begin(async (tx) => {
        await tx`select set_config('navi.repair.order_id',${orderId},true),set_config('navi.repair.user_id',${MEMBER.id},true),set_config('navi.repair.old_email',${WRONG},true),set_config('navi.repair.new_email',${MEMBER.email},true),set_config('navi.repair.slot_ids',${`{${slots.join(",")}}`},true)`;
        await tx.unsafe(script);
      });
    }
    test("five verified slots become visible with unchanged payments, PINs and notification history; fulfillment sends nothing again", async () => {
      const { orderId, slots } = await fixture();
      const beforeSlots = await rows(
        "select to_jsonb(r)-ARRAY['user_id','contact_email','updated_at'] as state from reservation r order by id",
      );
      const protectedState = () =>
        rows(`select
      (select jsonb_agg(to_jsonb(p) order by id) from payment p) as payments,
      (select jsonb_agg(to_jsonb(m) order by id) from message_delivery m) as messages,
      (select jsonb_agg(to_jsonb(c) order by id) from access_code c) as codes,
      (select jsonb_agg(to_jsonb(e) order by id) from email_archive e) as emails`);
      const before = await protectedState();
      const sent = resend.sent.length;
      await repair(orderId, slots);
      assert.equal(resend.sent.length, sent);
      assert.deepEqual(await protectedState(), before);
      assert.deepEqual(
        await rows(
          "select to_jsonb(r)-ARRAY['user_id','contact_email','updated_at'] as state from reservation r order by id",
        ),
        beforeSlots,
      );
      const orders = await listCustomerOrders(MEMBER.id, 1);
      assert.equal(orders.length, 1);
      assert.equal(orders[0]?.slots.length, 5);
      assert.equal((await getLoyaltyStatus(MEMBER.id)).totalEntries, 5);
      assert.equal(
        (
          await rows(
            "select id from reservation where user_id=$1 and contact_email=$2",
            [MEMBER.id, MEMBER.email],
          )
        ).length,
        5,
      );
      for (const id of slots) await fulfillReservation(id);
      assert.equal(
        resend.sent.length,
        sent,
        "neither customer nor operator receives another confirmation",
      );
      assert.deepEqual(await protectedState(), before);
      await assert.rejects(
        repair(orderId, slots),
        /ownership or verified identity/,
      );
    });
    test("identity mismatch, changed slot list or an existing code aborts the complete repair", async () => {
      const { orderId, slots } = await fixture();
      await connection`update profiles set phone='+420777999444' where id=${MEMBER.id}`;
      await assert.rejects(repair(orderId, slots), /identity/);
      await connection`update profiles set phone=${MEMBER.phone} where id=${MEMBER.id}`;
      await assert.rejects(
        repair(orderId, [
          ...slots.slice(0, 4),
          "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        ]),
        /contents/,
      );
      await connection`insert into access_code (reservation_id,code_hash,code_last2,valid_from,valid_until) values (${slots[0]!},'synthetic-hash','11',now()+interval '4 days',now()+interval '5 days')`;
      await assert.rejects(repair(orderId, slots), /fulfillment state/);
      assert.equal(
        (await rows("select id from reservation where user_id=$1", [MEMBER.id]))
          .length,
        0,
      );
      assert.equal(
        (
          await rows(
            "select id from booking_order where id=$1 and user_id is null",
            [orderId],
          )
        ).length,
        1,
      );
    });
    test("saving and preparing emphasized access code mail only renders; existing outboxes stay unchanged", async () => {
      const sent = resend.sent.length;
      const changes = () =>
        rows("select count(*)::int as n from message_delivery");
      const before = await changes();
      await saveEmailTemplate({
        id: "access_code",
        updatedByAdminId: MEMBER.id,
        subject: "Vstupní kód",
        body: "Ahoj **{name}**,\n\n**Hudbu jen do sluchátek.**\n\nKód: {code}\nČas: {time}",
      });
      const prepared = await prepareTransactionalEmail({
        id: "access_code",
        to: "fictional@example.test",
        variables: { name: "<Host> **X**", code: "123456", time: "21:00" },
        requiredSummary: {
          variable: "payment_summary",
          text: "Použité kredity: **20 Kč**",
        },
      });
      assert.match(prepared.html, /<strong>Hudbu jen do sluchátek\.<\/strong>/);
      assert.match(prepared.html, /<strong>&lt;Host&gt; \*\*X\*\*<\/strong>/);
      assert.match(prepared.text ?? "", /Hudbu jen do sluchátek\./);
      assert.doesNotMatch(prepared.text ?? "", /\*\*Hudbu/);
      assert.match(prepared.html, /\*\*20 Kč\*\*/);
      assert.equal(resend.sent.length, sent);
      assert.deepEqual(await changes(), before);
      await setSetting("messages.email.access_code", null);
    });
  },
);
