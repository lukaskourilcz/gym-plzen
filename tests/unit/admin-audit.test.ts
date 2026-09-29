import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { pgConstraint, pgErrorCode } from "../../src/lib/helpers/pg-error";
import {
  closureConfirmationMessage,
  closureFailureMessage,
  reservationsAccusative,
} from "../../src/lib/helpers/closure-copy";
import {
  RECOVERY_GRANT_TTL_MS,
  recoveryGrantKey,
  signRecoveryGrant,
  verifyRecoveryGrant,
} from "../../src/lib/auth/recovery-grant";
import { entryPriceSchema } from "../../src/lib/validations/memberships";
import { createReservationSchema } from "../../src/lib/validations/reservations";
import { isCancellableByAdmin } from "../../src/lib/services/admin-reservations";

test("Postgres codes are read through drizzle's query-error wrapper", () => {
  const driverError = Object.assign(new Error("conflicting key value"), {
    code: "23P01",
    constraint_name: "reservation_no_overlap",
  });
  const wrapped = new DrizzleQueryError(
    "insert into reservation …",
    [],
    driverError,
  );
  assert.equal((wrapped as unknown as { code?: string }).code, undefined);
  assert.equal(pgErrorCode(wrapped), "23P01");
  assert.equal(pgConstraint(wrapped), "reservation_no_overlap");
  // The bare driver error keeps working, and unrelated errors match nothing.
  assert.equal(pgErrorCode(driverError), "23P01");
  assert.equal(pgErrorCode(new Error("boom")), undefined);
  assert.equal(pgErrorCode("23P01"), undefined);
  assert.equal(pgConstraint(null), undefined);
  // A Node system error code is not a SQLSTATE.
  assert.equal(
    pgErrorCode(Object.assign(new Error("x"), { code: "ECONNRESET" })),
    undefined,
  );
});

test("closure copy counts bookings in Czech", () => {
  assert.equal(reservationsAccusative(1), "1 rezervaci");
  assert.equal(reservationsAccusative(3), "3 rezervace");
  assert.equal(reservationsAccusative(7), "7 rezervací");
  assert.equal(
    closureConfirmationMessage(2),
    "Uzavření zruší 2 rezervace a zákazníkům odejde e-mail. Potvrďte znovu.",
  );
  assert.match(
    closureFailureMessage([{ startsAt: new Date("2026-10-02T08:00:00Z") }]),
    /^Blok je uložen, ale 1 rezervaci se nepodařilo zrušit \(.+\)\./,
  );
});

test("a password-recovery grant is bound to its user and expires", () => {
  const key = recoveryGrantKey({ DATABASE_URL: "postgres://secret@db/x" })!;
  assert.ok(key);
  const issuedAt = Date.parse("2026-09-29T10:00:00Z");
  const grant = signRecoveryGrant("user-a", issuedAt, key)!;
  assert.equal(
    verifyRecoveryGrant(grant, "user-a", issuedAt + 60_000, key),
    true,
  );
  assert.equal(
    verifyRecoveryGrant(grant, "user-b", issuedAt + 60_000, key),
    false,
  );
  assert.equal(
    verifyRecoveryGrant(
      grant,
      "user-a",
      issuedAt + RECOVERY_GRANT_TTL_MS + 1,
      key,
    ),
    false,
  );
  assert.equal(verifyRecoveryGrant(grant, "user-a", issuedAt - 1, key), false);
  const otherKey = recoveryGrantKey({
    SUPABASE_SECRET_KEY: "sb_secret_other",
  })!;
  assert.equal(
    verifyRecoveryGrant(grant, "user-a", issuedAt + 1, otherKey),
    false,
  );
  // A forged timestamp invalidates the signature.
  const [, signature] = grant.split(".");
  assert.equal(
    verifyRecoveryGrant(
      `${issuedAt + 5_000}.${signature}`,
      "user-a",
      issuedAt + 6_000,
      key,
    ),
    false,
  );
  assert.equal(verifyRecoveryGrant(undefined, "user-a", issuedAt, key), false);
  assert.equal(verifyRecoveryGrant("garbage", "user-a", issuedAt, key), false);
  // No server secret: nothing can be signed and nothing verifies.
  assert.equal(recoveryGrantKey({}), null);
});

test("the reset page and action require the recovery grant; the routes that verify a recovery set it", async () => {
  const [action, page, confirm, callback] = await Promise.all([
    readFile("src/app/reset-password/actions.ts", "utf8"),
    readFile("src/app/reset-password/page.tsx", "utf8"),
    readFile("src/app/auth/confirm/route.ts", "utf8"),
    readFile("src/app/auth/callback/route.ts", "utf8"),
  ]);
  assert.match(action, /verifyRecoveryGrant\(/);
  assert.match(action, /cookieStore\.delete\(RECOVERY_GRANT_COOKIE\)/);
  assert.match(page, /verifyRecoveryGrant\(/);
  assert.match(
    confirm,
    /type === "recovery" && data\.user\)\s*attachRecoveryGrant/,
  );
  assert.match(
    callback,
    /next === "\/reset-password" && data\.user\)\s*attachRecoveryGrant/,
  );
});

test("every Supabase client writes the session cookie with the same attributes", async () => {
  for (const file of [
    "src/lib/supabase/server.ts",
    "src/lib/supabase/middleware.ts",
    "src/lib/supabase/client.ts",
  ]) {
    const source = await readFile(file, "utf8");
    assert.match(source, /cookieOptions: SUPABASE_COOKIE_OPTIONS/, file);
  }
  const { SUPABASE_COOKIE_OPTIONS } =
    await import("../../src/lib/supabase/cookie-options");
  assert.equal(SUPABASE_COOKIE_OPTIONS.sameSite, "lax");
});

test("the entry price cannot be zero or negative", () => {
  assert.equal(entryPriceSchema.safeParse({ priceCzk: 0 }).success, false);
  assert.equal(entryPriceSchema.safeParse({ priceCzk: -1 }).success, false);
  assert.equal(entryPriceSchema.safeParse({ priceCzk: 229 }).success, true);
});

test("a manual booking takes no end from the form", () => {
  const parsed = createReservationSchema.parse({
    startsAt: "2026-10-01T10:00",
    endsAt: "2026-10-01T13:00",
  });
  assert.equal("endsAt" in parsed, false);
});

test("the administration may cancel only reservations that have not ended", () => {
  const now = new Date("2026-10-01T10:30:00Z");
  const ended = new Date("2026-10-01T10:30:00Z");
  const running = new Date("2026-10-01T11:00:00Z");
  assert.equal(
    isCancellableByAdmin({ status: "confirmed", endsAt: ended }, now),
    false,
  );
  assert.equal(
    isCancellableByAdmin({ status: "confirmed", endsAt: running }, now),
    true,
  );
  assert.equal(
    isCancellableByAdmin({ status: "pending", endsAt: running }, now),
    true,
  );
  assert.equal(
    isCancellableByAdmin({ status: "cancelled", endsAt: running }, now),
    false,
  );
});

test("the admin calendar cannot start a drag over a booking", async () => {
  const calendar = await readFile(
    "src/components/admin/booking-calendar.tsx",
    "utf8",
  );
  assert.match(
    calendar,
    /selectOverlap=\{\(event\) => event\.display === "background"\}/,
  );
});
