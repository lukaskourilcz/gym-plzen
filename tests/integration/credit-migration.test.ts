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
        (f) => f !== "20261027090000_customer_credits.sql",
      )) {
        const migration = await readFile(`drizzle/${file}`, "utf8");
        await sql.begin((tx) => tx.unsafe(migration));
      }
      const [member] =
        await sql`insert into profiles(id,email,full_name) values(gen_random_uuid(),'legacy@example.test','Původní zákazník') returning id`;
      const [booking] =
        await sql`insert into reservation(user_id,starts_at,ends_at,status,contact_email,price_cents) values(${member!.id},'2030-10-28 09:00Z','2030-10-28 10:00Z','confirmed','legacy@example.test',19900) returning id`;
      await sql`insert into access_code(reservation_id,code_hash,encrypted_pin,provision_state,status,valid_from,valid_until,nuki_auth_id) values(${booking!.id},'fictional-hash','fictional-ciphertext','ready','scheduled','2030-10-28 09:00Z','2030-10-28 10:00Z','fictional-auth')`;
      await sql`insert into payment(reservation_id,user_id,type,status,amount_cents,provider,paid_at) values(${booking!.id},${member!.id},'one_off','succeeded',19900,'legacy',now())`;
      await sql`insert into message_delivery(reservation_id,channel,kind,status,recipient,dedupe_key) values(${booking!.id},'email','access_code','sent','legacy@example.test','migration-sent')`;
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
      ];
      const before = await Promise.all(tables.map((t) => fingerprint(t)));
      const migration = await readFile(
        "drizzle/20261027090000_customer_credits.sql",
        "utf8",
      );
      await sql.begin((tx) => tx.unsafe(migration));
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
                : [],
          ),
          before[i],
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
