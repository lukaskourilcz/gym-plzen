import {
  databaseReady,
  resetDatabase,
  rows,
  seedProfile,
  stopEverything,
} from "./setup";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, beforeEach, describe, test } from "node:test";
import { memberDirectoryPage } from "../../src/lib/services/member-directory";
import { readAdminFilters } from "../../src/lib/helpers/admin-list";
import {
  ensureProfileForUser,
  updateProfile,
} from "../../src/lib/services/members";
import { saveCustomerProfile } from "../../src/lib/services/customer-profile";

describe(
  "phone policy and registered/guest directory",
  { skip: !databaseReady },
  () => {
    after(stopEverything);
    beforeEach(resetDatabase);
    const filters = (registration = "") =>
      readAdminFilters({
        registration,
        pageSize: "20",
        sort: "name",
        direction: "asc",
      });
    const old = {
      id: "22222222-2222-4222-8222-222222222222",
      email: "member@example.test",
      fullName: "Člen",
    };

    test("legacy profiles may stay empty; new profiles cannot erase their phone through either writer", async () => {
      await seedProfile(old);
      await updateProfile(old.id, { phone: null });
      await rows(
        "update profiles set phone_required=true,phone='+420777123456' where id=$1",
        [old.id],
      );
      await assert.rejects(
        updateProfile(old.id, { phone: null }),
        /telefonní číslo/,
      );
      await assert.rejects(
        saveCustomerProfile(old.id, {
          firstName: "Člen",
          lastName: "Test",
          phone: "",
          notifyByWhatsapp: false,
          avatarSource: "initials",
        }),
        /telefonní číslo/,
      );
      await updateProfile(old.id, { phone: "777 999 888" });
      const [row] = await rows<{ phone: string }>(
        "select phone from profiles where id=$1",
        [old.id],
      );
      assert.equal(row!.phone, "+420777999888");
    });

    test("Auth fallback preserves old users and saves new registration contact without trusting metadata roles", async () => {
      await rows(
        "insert into site_setting(key,value) values ('registration.phone_required_from','\"2026-10-15T10:00:00Z\"') on conflict(key) do update set value=excluded.value",
      );
      const legacy = await ensureProfileForUser({
        ...old,
        createdAt: "2026-10-01T10:00:00Z",
      });
      assert.equal(legacy.phoneRequired, false);
      assert.equal(legacy.phone, null);
      const fresh = await ensureProfileForUser({
        id: randomUUID(),
        email: "fresh@example.test",
        fullName: "Nový",
        phone: "777123456",
        createdAt: "2026-10-16T10:00:00Z",
      });
      assert.equal(fresh.phoneRequired, true);
      assert.equal(fresh.phone, "+420777123456");
      assert.equal(fresh.role, "member");
      const google = await ensureProfileForUser({
        id: randomUUID(),
        email: "google@example.test",
        fullName: "Google",
        createdAt: "2026-10-16T10:00:00Z",
      });
      assert.equal(google.phoneRequired, true);
      assert.equal(google.phone, null);
    });

    test("Auth trigger accepts only valid contact metadata and never metadata roles or exemptions", async () => {
      await rows(
        "create table auth_phone_fixture(id uuid, email text, raw_user_meta_data jsonb)",
      );
      try {
        await rows(
          "create trigger auth_phone_insert after insert on auth_phone_fixture for each row execute function public.handle_new_user()",
        );
        const id = randomUUID();
        await rows(
          "insert into auth_phone_fixture values ($1,'trigger@example.test',$2)",
          [
            id,
            {
              full_name: "Nový",
              phone: "+420777123456",
              role: "admin",
              phone_required: false,
            },
          ],
        );
        const [profile] = await rows<{
          phone: string;
          phone_required: boolean;
          role: string;
        }>("select phone,phone_required,role from profiles where id=$1", [id]);
        assert.equal(profile!.phone, "+420777123456");
        assert.equal(profile!.phone_required, true);
        assert.equal(profile!.role, "member");
      } finally {
        await rows("drop table auth_phone_fixture");
      }
    });

    test("directory groups guest email variants, keeps latest known phone and excludes duplicate account contacts without linking bookings", async () => {
      await seedProfile(old);
      await rows(`insert into reservation(starts_at,ends_at,status,contact_name,contact_email,contact_phone,created_at) values
      ('2030-01-01 10:00Z','2030-01-01 11:00Z','cancelled','Host první',' Host@Example.Test ','+420777123456','2026-01-01'),
      ('2030-01-01 12:00Z','2030-01-01 13:00Z','cancelled','Host poslední','host@example.test',null,'2026-01-02'),
      ('2030-01-01 14:00Z','2030-01-01 15:00Z','cancelled','Stejný e-mail',' MEMBER@example.test ',null,'2026-01-03')`);
      const before = await rows("select * from reservation order by id");
      const all = await memberDirectoryPage(1, filters());
      assert.equal(all.length, 2);
      const guest = all.find((row) => row.registration === "guest")!;
      assert.equal(guest.user.name, "Host poslední");
      assert.equal(guest.user.email, "host@example.test");
      assert.equal(guest.contactPhone, "+420777123456");
      assert.equal(guest.profile, null);
      assert.equal(guest.totalCount, 2);
      assert.equal(
        (await memberDirectoryPage(1, filters("registered"))).length,
        1,
      );
      assert.equal((await memberDirectoryPage(1, filters("guest"))).length, 1);
      assert.equal(
        (
          await memberDirectoryPage(
            1,
            readAdminFilters({ q: "777123456", registration: "guest" }),
          )
        ).length,
        1,
      );
      assert.deepEqual(
        await rows("select * from reservation order by id"),
        before,
      );
      assert.equal((await rows("select id from profiles")).length, 1);
    });

    test("guest directory paginates and reports totals beyond one page", async () => {
      await rows(`insert into reservation(starts_at,ends_at,status,contact_name,contact_email)
      select '2030-01-01 10:00Z'::timestamptz,'2030-01-01 11:00Z'::timestamptz,'cancelled','Host '||n,'guest-'||n||'@example.test' from generate_series(1,45) n`);
      const first = await memberDirectoryPage(1, filters("guest"));
      const second = await memberDirectoryPage(2, filters("guest"));
      assert.equal(first.length, 21);
      assert.equal(first[0]!.totalCount, 45);
      assert.equal(
        new Set(
          [...first.slice(0, 20), ...second.slice(0, 20)].map(
            (row) => row.user.id,
          ),
        ).size,
        40,
      );
      assert.equal((await memberDirectoryPage(3, filters("guest"))).length, 5);
    });
  },
);
