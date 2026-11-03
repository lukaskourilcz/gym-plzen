import {
  databaseReady,
  resetDatabase,
  rows,
  seedProfile,
  stopEverything,
} from "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { randomUUID } from "node:crypto";
import {
  updateMemberContact,
  memberContactSnapshot,
} from "../../src/lib/services/admin-member-contact";
import {
  getMember,
  ensureProfileForUser,
} from "../../src/lib/services/members";
import { ActionError } from "../../src/lib/helpers/action";

const user = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "typo@example.test",
  fullName: "Původní Jméno",
};
const actor = {
  id: "33333333-3333-4333-8333-333333333333",
  email: "admin@example.test",
  fullName: "Správce",
};

async function input() {
  const profile = (await getMember(user.id))!.profile!;
  return {
    userId: user.id,
    fullName: "  Klára   Opravená  ",
    email: "Corrected@Example.test",
    phone: "777 111 222",
    expected: memberContactSnapshot(profile),
  };
}
async function protectedState() {
  return rows(`select
    (select jsonb_agg(to_jsonb(r) order by id) from reservation r) as bookings,
    (select jsonb_agg(to_jsonb(c) order by id) from access_code c) as codes,
    (select jsonb_agg(to_jsonb(p) order by id) from payment p) as payments,
    (select jsonb_agg(to_jsonb(m) order by id) from message_delivery m) as messages,
    (select jsonb_agg(to_jsonb(e) order by id) from email_archive e) as emails`);
}
function authFixture() {
  let email = user.email;
  const writes: string[] = [];
  return {
    writes,
    current: () => email,
    factory: () => ({
      getEmail: async () => email,
      setEmail: async (_id: string, next: string) => {
        writes.push(next);
        email = next;
      },
    }),
  };
}

describe(
  "administrator customer contact editing",
  { skip: !databaseReady },
  () => {
    beforeEach(async () => {
      await resetDatabase();
      await seedProfile(user);
      await seedProfile(actor);
      await rows("update profiles set role='admin' where id=$1", [actor.id]);
      await rows(
        "update profiles set phone='+420777999888',phone_verified=true,note='Private note',notify_by_whatsapp=true where id=$1",
        [user.id],
      );
      const [booking] = await rows<{ id: string }>(
        "insert into reservation(user_id,starts_at,ends_at,status,price_cents,contact_name,contact_email,contact_phone) values($1,now()+interval '5 days',now()+interval '5 days 75 minutes','confirmed',23900,'Původní Jméno',$2,'+420777999888') returning id",
        [user.id, user.email],
      );
      await rows(
        "insert into access_code(reservation_id,code_hash,nuki_auth_id,valid_from,valid_until,status) values($1,'synthetic-hash','synthetic-lock-authorization',now()+interval '5 days',now()+interval '5 days 90 minutes','scheduled')",
        [booking!.id],
      );
    });
    after(stopEverything);

    test("saves one stable identity, splits the name and preserves bookings, codes, roles and preferences", async () => {
      const original = (await getMember(user.id))!.profile!;
      const protectedBefore = await protectedState(),
        auth = authFixture();
      await updateMemberContact(await input(), actor, auth.factory);
      const updated = (await getMember(user.id))!.profile!;
      assert.equal(updated.id, user.id);
      assert.equal(updated.fullName, "Klára Opravená");
      assert.equal(updated.firstName, "Klára");
      assert.equal(updated.lastName, "Opravená");
      assert.equal(updated.email, "corrected@example.test");
      assert.equal(auth.current(), updated.email);
      assert.equal(updated.phone, "+420777111222");
      assert.equal(updated.phoneVerified, false);
      for (const key of [
        "role",
        "note",
        "notifyByWhatsapp",
        "notifyBySms",
        "marketingConsent",
        "marketingConsentAt",
        "termsAcceptedAt",
        "createdAt",
        "avatarSource",
        "phoneRequired",
      ] as const)
        assert.deepEqual(updated[key], original[key]);
      assert.deepEqual(await protectedState(), protectedBefore);
      const audit = await rows(
        "select * from activity_log where member_id=$1",
        [user.id],
      );
      assert.equal(audit.length, 1);
      assert.equal(audit[0]!.actor_id, actor.id);
    });
    test("a lost successful action response can be retried without another Auth write or audit row", async () => {
      const values = await input(),
        auth = authFixture();
      await updateMemberContact(values, actor, auth.factory);
      const saved = await getMember(user.id);
      await updateMemberContact(values, actor, auth.factory);
      assert.deepEqual(await getMember(user.id), saved);
      assert.equal(auth.writes.length, 1);
      assert.equal(
        (await rows("select * from activity_log where member_id=$1", [user.id]))
          .length,
        1,
      );
    });
    test("name and phone edits require no Auth call and unchanged phones retain verification", async () => {
      const values = {
        ...(await input()),
        email: user.email,
        phone: "+420777999888",
      };
      await updateMemberContact(values, actor, () => {
        throw new Error("Unexpected Auth access");
      });
      assert.equal((await getMember(user.id))!.profile!.phoneVerified, true);
    });
    test("duplicate email and invalid phone are refused before any contact or Auth mutation", async () => {
      const before = await getMember(user.id),
        auth = authFixture();
      const values = await input();
      await assert.rejects(
        updateMemberContact(
          { ...values, email: actor.email },
          actor,
          auth.factory,
        ),
        /už používá/,
      );
      await assert.rejects(
        updateMemberContact(
          { ...values, phone: "not a phone" },
          actor,
          auth.factory,
        ),
      );
      await rows("update profiles set phone_required=true where id=$1", [
        user.id,
      ]);
      await assert.rejects(
        updateMemberContact(
          { ...(await input()), phone: "" },
          actor,
          auth.factory,
        ),
        /telefonní číslo/,
      );
      assert.equal(
        (await getMember(user.id))!.profile!.email,
        before!.profile!.email,
      );
      assert.equal(auth.writes.length, 0);
    });
    test("a provider rejection or independently changed Auth identity never changes the profile", async () => {
      const values = await input(),
        before = await getMember(user.id);
      await assert.rejects(
        updateMemberContact(values, actor, () => ({
          getEmail: async () => user.email,
          setEmail: async () => {
            throw new ActionError("Tento e-mail už používá jiný zákazník.");
          },
        })),
        /už používá/,
      );
      await assert.rejects(
        updateMemberContact(values, actor, () => ({
          getEmail: async () => "newer@example.test",
          setEmail: async () => {
            throw new Error("Must not overwrite");
          },
        })),
        /už má jiný e-mail/,
      );
      assert.deepEqual(await getMember(user.id), before);
    });
    test("stale forms cannot overwrite newer contact details", async () => {
      const values = await input(),
        auth = authFixture();
      await rows("update profiles set full_name='Novější jméno' where id=$1", [
        user.id,
      ]);
      await assert.rejects(
        updateMemberContact(values, actor, auth.factory),
        /mezitím změnily/,
      );
      assert.equal(auth.writes.length, 0);
      assert.equal(
        (await getMember(user.id))!.profile!.fullName,
        "Novější jméno",
      );
    });
    test("an Auth success followed by a failed database commit is completed by the same safe retry", async () => {
      const values = await input(),
        before = await getMember(user.id),
        protectedBefore = await protectedState(),
        auth = authFixture();
      // The audit FK deliberately fails only in this isolated database.
      await assert.rejects(
        updateMemberContact(
          values,
          { ...actor, id: randomUUID() },
          auth.factory,
        ),
        /e-mail byl změněn.*nedokončilo/,
      );
      assert.equal(auth.current(), "corrected@example.test");
      assert.deepEqual(await getMember(user.id), before);
      await updateMemberContact(values, actor, auth.factory);
      assert.equal(auth.writes.length, 1);
      assert.equal((await getMember(user.id))!.profile!.email, auth.current());
      assert.deepEqual(await protectedState(), protectedBefore);
    });
    test("stale session and registration snapshots cannot revert the corrected email", async () => {
      const auth = authFixture();
      await updateMemberContact(await input(), actor, auth.factory);
      const saved = await getMember(user.id);
      await ensureProfileForUser(user);
      assert.deepEqual(await getMember(user.id), saved);
      await ensureProfileForUser(user, {
        refreshIdentity: async () => ({ id: user.id, email: auth.current() }),
      });
      assert.deepEqual(await getMember(user.id), saved);
      await assert.rejects(
        ensureProfileForUser(user, {
          refreshIdentity: async () => ({ id: actor.id, email: actor.email }),
        }),
        /ověřit/,
      );
      assert.deepEqual(await getMember(user.id), saved);
    });
  },
);
