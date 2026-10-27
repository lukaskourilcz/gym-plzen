import { databaseReady } from "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import { readdir, readFile } from "node:fs/promises";
import { requireTestDatabaseUrl } from "../helpers/test-database";

test(
  "credit migration preserves historical reservations, codes, payments and deliveries byte for byte",
  { skip: !databaseReady },
  async () => {
    const source = new URL(requireTestDatabaseUrl());
    const name = `navi_credit_migration_${process.pid}_test`;
    const admin = postgres(source.toString(), { max: 1, prepare: false });
    await admin`create database ${admin(name)} template template0 encoding 'UTF8'`;
    source.pathname = `/${name}`;
    const sql = postgres(requireTestDatabaseUrl(source.toString()), {
      max: 1,
      prepare: false,
    });
    try {
      await sql.unsafe(
        await readFile("tests/integration/bootstrap.sql", "utf8"),
      );
      const files = (await readdir("drizzle"))
        .filter((f) => f.endsWith(".sql"))
        .sort();
      for (const file of files.filter(
        (f) => f < "20261027090000_customer_credits.sql",
      )) {
        const migration = await readFile(`drizzle/${file}`, "utf8");
        await sql.begin((tx) => tx.unsafe(migration));
      }
      const [member] =
        await sql`insert into profiles(id,email,full_name) values(gen_random_uuid(),'legacy@example.test','Původní zákazník') returning id`;
      const [order] =
        await sql`insert into booking_order(user_id,status,total_cents,contact_email) values(${member!.id},'confirmed',19900,'legacy@example.test') returning id`;
      const [booking] =
        await sql`insert into reservation(user_id,order_id,starts_at,ends_at,status,contact_email,price_cents) values(${member!.id},${order!.id},'2030-10-28 09:00Z','2030-10-28 10:00Z','confirmed','legacy@example.test',19900) returning id`;
      await sql`insert into access_code(reservation_id,code_hash,encrypted_pin,provision_state,status,valid_from,valid_until,nuki_auth_id) values(${booking!.id},'fictional-hash','fictional-ciphertext','ready','scheduled','2030-10-28 09:00Z','2030-10-28 10:00Z','fictional-auth')`;
      await sql`insert into payment(reservation_id,user_id,type,status,amount_cents,provider,paid_at) values(${booking!.id},${member!.id},'one_off','succeeded',19900,'legacy',now())`;
      await sql`insert into message_delivery(reservation_id,channel,kind,status,recipient,dedupe_key) values(${booking!.id},'email','access_code','sent','legacy@example.test','migration-sent')`;
      await sql`insert into participant_addition(reservation_id,user_id,from_count,to_count,amount_cents,pricing_mode,status) values(${booking!.id},${member!.id},0,1,10000,'flat','confirmed')`;
      await sql`insert into invoice(number,year,reservation_id,order_id,user_id,supplied_at,total_cents,base_cents,vat_cents,description,supplier,customer_email) values('FIXTURE-2026-1',2026,${booking!.id},${order!.id},${member!.id},now(),19900,19900,0,'Původní doklad','{}','legacy@example.test')`;
      async function fingerprint(table: string, remove: string[] = []) {
        const [value] =
          await sql`select coalesce(jsonb_agg(to_jsonb(t)-${remove}::text[] order by t.id),'[]'::jsonb) as data from ${sql(table)} t`;
        return value!.data;
      }
      const tables = [
        "reservation",
        "access_code",
        "payment",
        "message_delivery",
        "booking_order",
        "participant_addition",
        "invoice",
        "profiles",
      ];
      const before = await Promise.all(tables.map((t) => fingerprint(t)));
      const migration = await readFile(
        "drizzle/20261027090000_customer_credits.sql",
        "utf8",
      );
      const indexes = await readFile(
        "drizzle/20261027180000_credit_audit_indexes.sql",
        "utf8",
      );
      const beforeGuard = await readFile(
        "scripts/release/credits-initial-before.sql",
        "utf8",
      );
      const afterGuard = await readFile(
        "scripts/release/credits-initial-after.sql",
        "utf8",
      );
      await sql.begin(async (tx) => {
        await tx.unsafe(beforeGuard);
        await tx.unsafe(migration);
        await tx.unsafe(indexes);
        await tx.unsafe(afterGuard);
      });
      const [indexed] =
        await sql`select count(*)::int as n from pg_indexes where schemaname='public' and indexname in ('reservation_change_user_completed_idx','reservation_change_recovery_idx')`;
      assert.equal(indexed!.n, 2);
      for (const [i, table] of tables.entries())
        assert.deepEqual(
          await fingerprint(
            table,
            table === "reservation"
              ? [
                  "pricing_version",
                  "terms_version",
                  "price_snapshot",
                  "credit_paid_cents",
                ]
              : table === "payment"
                ? ["reservation_change_id"]
                : ["booking_order", "participant_addition", "invoice"].includes(
                      table,
                    )
                  ? ["credit_cents"]
                  : [],
          ),
          before[i],
        );
      await assert.rejects(
        sql.begin(async (tx) => {
          await tx.unsafe(beforeGuard);
          await tx`update reservation set price_cents=1 where id=${booking!.id}`;
          await tx.unsafe(afterGuard);
        }),
        /modified pre-existing row fields/,
      );
      assert.deepEqual(
        await fingerprint("reservation", [
          "pricing_version",
          "terms_version",
          "price_snapshot",
          "credit_paid_cents",
        ]),
        before[0],
      );
      await assert.rejects(
        sql.begin(async (tx) => {
          await tx.unsafe(beforeGuard);
          await tx`insert into credit_account(user_id) values(${member!.id})`;
          await tx.unsafe(afterGuard);
        }),
        /must contain no wallets/,
      );
      const [legacy] =
        await sql`select pricing_version,terms_version,credit_paid_cents from reservation where id=${booking!.id}`;
      assert.deepEqual(legacy, {
        pricing_version: 1,
        terms_version: null,
        credit_paid_cents: 0,
      });
      for (const table of [
        "credit_account",
        "credit_entry",
        "credit_hold",
        "reservation_change",
      ]) {
        const [count] = await sql`select count(*)::int as n from ${sql(table)}`;
        assert.equal(count!.n, 0);
        const [permissions] =
          await sql`select relrowsecurity as rls,has_table_privilege('anon',${"public." + table},'SELECT') as anon,has_table_privilege('authenticated',${"public." + table},'INSERT') as customer from pg_class where oid=${"public." + table}::regclass`;
        assert.deepEqual(permissions, {
          rls: true,
          anon: false,
          customer: false,
        });
      }
    } finally {
      await sql.end({ timeout: 2 });
      await admin`drop database ${admin(name)}`;
      await admin.end({ timeout: 2 });
    }
  },
);
