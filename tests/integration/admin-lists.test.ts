import {
  databaseReady,
  resetDatabase,
  rows,
  seedProfile,
  stopEverything,
} from "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { readAdminFilters } from "../../src/lib/helpers/admin-list";
import { splitAdminPage } from "../../src/lib/helpers/admin-list";
import { programmeCodeStates } from "../../src/lib/services/admin-programme";
import { splitPage } from "../../src/lib/helpers/pagination";
import {
  accessCodePage,
  activityPage,
  alertPage,
  blockPage,
  emailPage,
  entryPage,
  invoicePage,
  memberMessagePage,
  memberPage,
  messagePage,
  newsletterPage,
  reservationPage,
  voucherPage,
} from "../../src/lib/services/admin-lists";
import {
  historyTotalsForUser,
  listHistoryForUser,
} from "../../src/lib/services/reservations";

const member = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "jana@example.test",
  fullName: "Jana Černá",
};
const now = new Date("2026-09-30T20:00:00Z");
const filters = (params: Parameters<typeof readAdminFilters>[0]) =>
  readAdminFilters({ pageSize: "50", ...params });
async function booking(name = "Host Žluťoučký") {
  const [row] = await rows<{ id: string }>(
    `insert into reservation (user_id, starts_at, ends_at, status, contact_name, contact_email, price_cents)
    values ($1,'2026-09-30 22:00+00','2026-09-30 23:15+00','cancelled',$2,$3,19900) returning id`,
    [member.id, name, member.email],
  );
  return row!.id;
}
async function delivery(
  params: {
    provider?: string;
    reservation?: string;
    channel?: string;
    status?: string;
    sent?: string;
    created?: string;
    recipient?: string;
  } = {},
) {
  const [row] = await rows<{ id: string }>(
    `insert into message_delivery (user_id,reservation_id,channel,kind,status,recipient,provider_message_id,created_at,sent_at)
    values ($1,$2,$3,'reservation_confirmation',$4,$5,$6,$7,$8) returning id`,
    [
      member.id,
      params.reservation ?? null,
      params.channel ?? "email",
      params.status ?? "sent",
      params.recipient ?? member.email,
      params.provider ?? null,
      params.created ?? "2026-09-30 10:00:00",
      params.sent ?? "2026-09-29 22:30:00",
    ],
  );
  return row!.id;
}
async function archive(
  provider: string,
  sent = "2026-09-29 22:30+00",
  recipient = member.email,
  subject = "Potvrzení",
) {
  await rows(
    `insert into email_archive (provider_message_id,sender,recipient,subject,html,sent_at) values ($1,'sender@example.test',$2,$3,'PRIVATE BODY PIN',$4)`,
    [provider, recipient, subject, sent],
  );
}

describe(
  "admin filtered database pages",
  { skip: !databaseReady && "needs isolated local Postgres" },
  () => {
    after(stopEverything);
    beforeEach(async () => {
      await resetDatabase();
      await rows("truncate email_archive, newsletter_subscriber");
      await seedProfile(member);
    });

    test("archive and delivery pages reach records beyond the old 200-row cap with stable ties", async () => {
      await rows(
        `insert into message_delivery (user_id,channel,kind,status,recipient,created_at)
      select $1,'email','marketing','sent','bulk-'||n||'@example.test','2026-09-30 12:00' from generate_series(1,205) n`,
        [member.id],
      );
      await rows(`insert into email_archive (provider_message_id,sender,recipient,subject,html,sent_at)
      select 'archive-'||n,'sender@example.test','bulk-'||n||'@example.test','Bulk','PRIVATE','2026-09-30 12:00+00' from generate_series(1,205) n`);
      const first = splitPage(await messagePage(1, filters({}), now), 50);
      const second = splitPage(await messagePage(2, filters({}), now), 50);
      assert.equal(first.rows.length, 50);
      assert.equal(first.hasNext, true);
      assert.equal(
        new Set([...first.rows, ...second.rows].map((r) => r.id)).size,
        100,
      );
      assert.deepEqual(
        (await messagePage(1, filters({}), now)).map((r) => r.id),
        (await messagePage(1, filters({}), now)).map((r) => r.id),
      );
      assert.equal((await messagePage(5, filters({}), now)).length, 5);
      assert.equal((await emailPage(5, filters({}), now)).length, 5);
      await delivery({
        created: "2026-09-01 10:00",
        recipient: "old-search@example.test",
      });
      await archive(
        "old-search",
        "2026-09-01 10:00+00",
        "old-search@example.test",
      );
      assert.equal(
        (await messagePage(1, filters({ q: "old-search" }), now)).length,
        1,
      );
      const found = await emailPage(1, filters({ q: "old-search" }), now);
      assert.equal(found.length, 1);
      assert.equal("html" in found[0]!, false);
      assert.equal("bodyText" in found[0]!, false);
    });

    test("sorts the complete member set before paging, bounds size and counts filtered empty pages", async () => {
      await rows(`insert into profiles(id,email,full_name,notify_by_whatsapp,created_at)
        select md5('sort-'||n)::uuid,'sort-'||n||'@example.test','Sort '||lpad(n::text,3,'0'),n%2=0,'2026-09-01'::timestamp+n*interval '1 hour' from generate_series(1,105) n`);
      for (const size of [20, 50, 100]) {
        const f = filters({
          q: "sort-",
          sort: "name",
          direction: "asc",
          pageSize: String(size),
        });
        const first = await memberPage(1, f),
          second = await memberPage(2, f);
        assert.equal(first.length, size + 1);
        assert.equal(first[0]!.user.name, "Sort 001");
        assert.equal(
          second[0]!.user.name,
          `Sort ${String(size + 1).padStart(3, "0")}`,
        );
        assert.equal(first[0]!.totalCount, 105);
      }
      const whatsapp = filters({
        q: "sort-",
        whatsapp: "enabled",
        sort: "name",
        direction: "desc",
        pageSize: "20",
      });
      const result = await splitAdminPage(
        await memberPage(1, whatsapp),
        1,
        whatsapp,
        () => memberPage(1, whatsapp),
      );
      assert.equal(result.totalCount, 52);
      assert.equal(result.rows.length, 20);
      assert.equal(result.rows[0]!.user.name, "Sort 104");
      assert.ok(result.rows.every((r) => r.profile?.notifyByWhatsapp));
      const empty = await splitAdminPage(
        await memberPage(9, whatsapp),
        9,
        whatsapp,
        () => memberPage(1, whatsapp),
      );
      assert.equal(empty.rows.length, 0);
      assert.equal(empty.totalCount, 52);
      assert.equal(
        (await memberPage(1, filters({ q: "sort-", whatsapp: "disabled" })))[0]!
          .totalCount,
        53,
      );
      // URL values cannot become an ORDER BY expression or escape the allowlist.
      assert.deepEqual(
        (
          await memberPage(
            1,
            filters({ q: "sort-", sort: "name; delete from profiles" }),
          )
        ).map((r) => r.user.id),
        (await memberPage(1, filters({ q: "sort-" }))).map((r) => r.user.id),
      );
      assert.equal(
        (await rows<{ n: number }>("select count(*)::int n from profiles"))[0]!
          .n,
        106,
      );
    });

    test("programme states require the current confirmed code, recorded sending and successful keypad use", async () => {
      const ids: string[] = [];
      for (let n = 0; n < 7; n++) {
        const [r] = await rows<{ id: string }>(
          `insert into reservation(user_id,starts_at,ends_at,status,contact_name)
          values ($1,'2026-10-01 00:00+00'::timestamptz+$2*interval '20 minutes','2026-10-01 00:10+00'::timestamptz+$2*interval '20 minutes',$3,'Programme fixture') returning id`,
          [
            member.id,
            n,
            n === 5 ? "cancelled" : n === 6 ? "pending" : "confirmed",
          ],
        );
        ids.push(r!.id);
        const [code] = await rows<{ id: string }>(
          `insert into access_code(reservation_id,code_hash,valid_from,valid_until,status,created_at)
          select id,'TEST',starts_at,ends_at+interval '15 minutes',case when $2=4 then 'revoked'::access_code_status else 'expired'::access_code_status end,'2026-09-30 12:00' from reservation where id=$1 returning id`,
          [r!.id, n],
        );
        if (n !== 2)
          await rows(
            `insert into message_delivery(reservation_id,kind,channel,status,recipient,sent_at) values ($1,'access_code','email',$2,'fixture@example.test',$3)`,
            [
              r!.id,
              n === 3 ? "failed" : "sent",
              n === 3
                ? null
                : n === 4
                  ? "2026-09-30 11:00"
                  : "2026-09-30 13:00",
            ],
          );
        await rows(
          `insert into entry_log(reservation_id,access_code_id,trigger,action,occurred_at) values ($1,$2,$3,$4,'2026-10-01 01:00+00')`,
          [
            r!.id,
            code!.id,
            n === 1 ? "app" : "keypad",
            n === 2 || n === 3 ? "keypad_failure_224" : "unlock",
          ],
        );
      }
      const states = await programmeCodeStates(ids);
      assert.deepEqual(states.get(ids[0]!), { sent: true, used: true });
      assert.deepEqual(states.get(ids[1]!), { sent: true, used: false });
      assert.deepEqual(states.get(ids[2]!), { sent: false, used: false });
      assert.deepEqual(states.get(ids[3]!), { sent: false, used: false });
      assert.equal(states.has(ids[4]!), false);
      assert.equal(states.has(ids[5]!), false);
      assert.equal(states.has(ids[6]!), false);
      assert.equal((await programmeCodeStates([])).size, 0);
    });

    test("name lookup supports diacritics, guests, detached archives and duplicate provider attempts", async () => {
      const id = await booking();
      await delivery({ provider: "guest", reservation: id });
      await delivery({ provider: "guest", reservation: id });
      await archive("guest");
      await archive("detached");
      const guest = await emailPage(
        1,
        filters({
          q: "zlutoucky",
          status: "sent",
          kind: "reservation_confirmation",
          channel: "email",
        }),
        now,
      );
      assert.equal(guest.length, 1);
      assert.equal(guest[0]!.customerName, "Host Žluťoučký");
      const detached = await emailPage(1, filters({ q: "JANA CERNA" }), now);
      assert.equal(detached.length, 1);
      assert.equal(detached[0]!.customerName, "Jana Černá");
      assert.equal(
        (await emailPage(1, filters({ channel: "sms" }), now)).length,
        0,
      );
      assert.equal(
        (await messagePage(1, filters({ q: "zlutoucky" }), now)).length,
        0,
      ); // represented by the retained preview
      await delivery({
        channel: "sms",
        reservation: id,
        status: "failed",
        provider: "guest",
      });
      assert.equal(
        (
          await messagePage(
            1,
            filters({
              q: "zlutoucky",
              status: "failed",
              channel: "sms",
              kind: "reservation_confirmation",
            }),
            now,
          )
        ).length,
        1,
      );
    });

    test("sent-date filtering uses Prague calendar days, not creation date, and preserves 30-day retention", async () => {
      await delivery({
        provider: "start",
        sent: "2026-09-29 22:00:00",
        created: "2026-09-28 09:00",
      });
      await delivery({
        provider: "last",
        sent: "2026-09-30 21:59:59",
        created: "2026-09-28 09:00",
      });
      await delivery({ provider: "outside", sent: "2026-09-30 22:00:00" });
      await archive("start", "2026-09-29 22:00+00");
      await archive("expired", "2026-08-31 20:00+00");
      const day = filters({ from: "2026-09-30", to: "2026-09-30" });
      assert.deepEqual(
        (await emailPage(1, day, now)).map((r) => r.recipient),
        [member.email],
      );
      assert.equal((await messagePage(1, day, now)).length, 1);
      assert.equal((await emailPage(1, filters({}), now)).length, 1);
      for (const bad of [
        { from: "2026-02-30" },
        { from: "2026-10-02", to: "2026-10-01" },
        { to: "9999-12-31" },
      ]) {
        assert.equal((await emailPage(1, filters(bad), now)).length, 0);
        assert.equal((await reservationPage(1, filters(bad))).length, 0);
      }
    });

    test("search treats percent, underscore, backslash and SQL syntax literally", async () => {
      await archive("literal", undefined, member.email, "100%_\\ special");
      await archive("ordinary", undefined, member.email, "100xyz");
      assert.equal((await emailPage(1, filters({ q: "%_\\" }), now)).length, 1);
      assert.equal(
        (await emailPage(1, filters({ q: "' OR true --" }), now)).length,
        0,
      );
    });

    test("members, reservations, activity, alerts and entry book filter before the page boundary", async () => {
      await booking();
      assert.equal(
        (
          await reservationPage(
            1,
            filters({
              q: "cerna",
              status: "cancelled",
              from: "2026-10-01",
              to: "2026-10-01",
            }),
          )
        ).length,
        1,
      );
      assert.equal(
        (await reservationPage(1, filters({ status: "confirmed" }))).length,
        0,
      );
      assert.equal(
        (await memberPage(1, filters({ q: "CERNA", role: "member" }))).length,
        1,
      );
      assert.equal((await memberPage(1, filters({ role: "admin" }))).length, 0);
      await rows(`insert into activity_log (actor_type,actor_label,action,summary,member_id,occurred_at)
      select 'system','Robot','member.registered','Bulk',null,'2026-09-30 12:00+00' from generate_series(1,60)`);
      await rows(
        `insert into activity_log (actor_type,actor_label,action,summary,member_id,occurred_at)
      values ('admin','Správce','member.profile_updated','Změna telefonu',$1,'2026-09-29 22:30+00')`,
        [member.id],
      );
      assert.equal(
        (
          await activityPage(
            1,
            filters({
              q: "CERNA",
              action: "member.profile_updated",
              from: "2026-09-30",
              to: "2026-09-30",
            }),
          )
        ).length,
        1,
      );
      await rows(
        `insert into system_alert (title,body,severity,created_at) values ('Nuki','Čeká na spojení','critical','2026-09-29 22:30')`,
      );
      assert.equal(
        (
          await alertPage(
            1,
            filters({
              q: "spojeni",
              severity: "critical",
              state: "open",
              from: "2026-09-30",
              to: "2026-09-30",
            }),
          )
        ).length,
        1,
      );
      assert.equal(
        (await alertPage(1, filters({ state: "resolved" }))).length,
        0,
      );
      await rows(
        `insert into entry_log (user_id,nuki_name,action,trigger,occurred_at) values ($1,'Jana','keypad_failure_3','keypad','2026-09-29 22:30+00')`,
        [member.id],
      );
      assert.equal(
        (
          await entryPage(
            1,
            filters({
              q: "CERNA",
              action: "keypad_failure",
              trigger: "keypad",
            }),
          )
        ).length,
        1,
      );
    });

    test("newsletter totals span all pages and filters including customer-name matching", async () => {
      await rows(
        `insert into newsletter_subscriber (email,status) select 'bulk-'||n||'@example.test','subscribed' from generate_series(1,65) n`,
      );
      await rows(
        `insert into newsletter_subscriber (email,status,consented_at) values ($1,'unsubscribed','2026-09-29 22:30+00')`,
        [member.email],
      );
      const result = await newsletterPage(
        1,
        filters({
          q: "CERNA",
          status: "unsubscribed",
          from: "2026-09-30",
          to: "2026-09-30",
        }),
      );
      assert.equal(result.rows.length, 1);
      assert.deepEqual(result.totals, { total: 66, active: 65 });
      assert.equal((await newsletterPage(2, filters({}))).rows.length, 16);
    });

    test("voucher filters and global counts ignore expired holds without writing on reads", async () => {
      await rows(
        `insert into voucher (code,kind,value,is_active) select 'CODE-'||n,'percentage',10,true from generate_series(1,60) n`,
      );
      const [v] = await rows<{ id: string }>(
        `insert into voucher (code,kind,value,max_redemptions) values ('LIMITED','fixed_amount',100,1) returning id`,
      );
      const r1 = await booking(),
        r2 = await booking();
      await rows(
        `insert into voucher_redemption (voucher_id,reservation_id,status,original_price_cents,discount_cents,final_price_cents,reserved_until)
      values ($1,$2,'redeemed',19900,100,19800,'2026-10-01'),($1,$3,'reserved',19900,100,19800,'2026-09-01')`,
        [v!.id, r1, r2],
      );
      const result = await voucherPage(
        1,
        filters({ q: "LIMITED", state: "exhausted", kind: "fixed_amount" }),
        now,
      );
      assert.equal(result.rows.length, 1);
      assert.equal(result.rows[0]!.reservedCount, 0);
      assert.deepEqual(result.totals, { total: 61, active: 60, redeemed: 1 });
      const [hold] = await rows<{ status: string }>(
        "select status from voucher_redemption where reservation_id=$1",
        [r2],
      );
      assert.equal(hold!.status, "reserved");
      assert.equal((await voucherPage(2, filters({}), now)).rows.length, 11);
    });

    test("blocks and access validity include intervals already in progress, code state agrees with time", async () => {
      await rows(
        `insert into blocked_slot (starts_at,ends_at,reason,note) values ('2026-09-29 08:00+00','2026-10-01 08:00+00','maintenance','Oprava')`,
      );
      const day = filters({ from: "2026-09-30", to: "2026-09-30" });
      assert.equal((await blockPage(1, day)).length, 1);
      assert.equal(
        (await blockPage(1, filters({ reason: "holiday" }))).length,
        0,
      );
      const id = await booking();
      await rows(
        `insert into access_code (reservation_id,code_hash,valid_from,valid_until,status)
      values ($1,'test-hash','2026-09-29 08:00+00','2026-10-01 08:00+00','scheduled')`,
        [id],
      );
      assert.equal(
        (
          await accessCodePage(
            1,
            filters({
              from: "2026-09-30",
              to: "2026-09-30",
              q: "CERNA",
              state: "active",
            }),
            now,
          )
        ).length,
        1,
      );
      assert.equal(
        (await accessCodePage(1, filters({ state: "scheduled" }), now)).length,
        0,
      );
    });

    test("profile pagination remains scoped to one member and complete totals survive filtering", async () => {
      await rows(
        `insert into reservation (user_id,starts_at,ends_at,status,contact_email,price_cents)
      select $1,'2026-10-01 08:00+00','2026-10-01 09:15+00','cancelled',$2,19900 from generate_series(1,60)`,
        [member.id, member.email],
      );
      const id = await booking();
      await rows(
        `insert into payment (user_id,reservation_id,type,status,amount_cents,provider,provider_payment_id) values ($1,$2,'one_off','succeeded',19900,'comgate','TEST-PROFILE')`,
        [member.id, id],
      );
      assert.equal(
        (
          await listHistoryForUser(member.id, 51, {
            offset: 50,
            filters: filters({}),
          })
        ).length,
        11,
      );
      assert.equal(
        (
          await listHistoryForUser(member.id, 51, {
            offset: 0,
            filters: filters({ status: "confirmed" }),
          })
        ).length,
        0,
      );
      assert.deepEqual(await historyTotalsForUser(member.id), {
        count: 61,
        spentCents: 19900,
      });
      await delivery();
      assert.equal(
        (await memberMessagePage(member.id, 1, filters({}))).length,
        1,
      );
      assert.equal(
        (
          await memberMessagePage(
            "33333333-3333-4333-8333-333333333333",
            1,
            filters({}),
          )
        ).length,
        0,
      );
      assert.equal(
        (
          await activityPage(
            1,
            filters({}),
            "33333333-3333-4333-8333-333333333333",
          )
        ).length,
        0,
      );
    });

    test("documents filter by customer, number, issue date and delivery state", async () => {
      const id = await booking();
      await rows(
        `insert into invoice (reservation_id,number,year,customer_name,customer_email,total_cents,base_cents,vat_cents,description,supplier,issued_at,supplied_at)
      values ($1,'NAVI-2026-0001',2026,'Jana Černá',$2,19900,19900,0,'Fixture','{}','2026-09-29 22:30+00','2026-09-29 22:30+00')`,
        [id, member.email],
      );
      assert.equal(
        (
          await invoicePage(
            1,
            filters({
              q: "CERNA",
              delivery: "unsent",
              from: "2026-09-30",
              to: "2026-09-30",
            }),
          )
        ).length,
        1,
      );
      assert.equal(
        (await invoicePage(1, filters({ q: "0001", delivery: "sent" }))).length,
        0,
      );
    });
  },
);
