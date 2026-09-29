import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  or,
} from "drizzle-orm";
import { db } from "@/lib/db";
import { accessCode, reservation, reservationPipeline } from "@/lib/db/schema";
import type { AccessCode } from "@/lib/db/types";
import { env, requireEnv } from "@/lib/env";
import { generateKeypadCode, hashCode } from "@/lib/helpers/crypto";
import { encryptPin, decryptPin } from "@/lib/helpers/pin-vault";
import {
  accessCodeValidity,
  isAccessCodePreparationDue,
} from "@/lib/config/access-code-delivery";
import { durableNukiClient } from "@/lib/integrations/nuki";
import { withReservationLock } from "./operation-lock";
import { getOperations } from "./operations";
import { getReservation } from "./reservations";
import { getShowerMinutes } from "./schedule";
import { raiseAlert, resolveAlert } from "./alerts";

export interface IssueCodeResult {
  accessCode: AccessCode;
  plaintext: string;
  provisionedOnLock: boolean;
}
/**
 * How long an online lock may show nothing for an accepted-or-unknown PUT
 * before that PUT counts as lost. Nuki syncs within seconds while the bridge
 * is online; after this, the same PIN may be submitted again.
 */
export const SUBMISSION_GRACE_MS = 10 * 60_000;
const submissionLapsed = (row: AccessCode) =>
  row.provisionState === "submitted" &&
  row.submittedAt !== null &&
  row.submittedAt.getTime() <= Date.now() - SUBMISSION_GRACE_MS;
const identity = (row: Pick<AccessCode, "id" | "reservationId" | "lockId">) =>
  `access-code:${row.id}:${row.reservationId}:${row.lockId}`;
function pinFor(row: AccessCode): string | null {
  if (!row.encryptedPin) return null;
  return decryptPin(
    row.encryptedPin,
    identity(row),
    requireEnv("ACCESS_CODE_ENCRYPTION_KEY").ACCESS_CODE_ENCRYPTION_KEY,
  );
}
async function update(id: string, values: Partial<AccessCode>) {
  const [row] = await db
    .update(accessCode)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(accessCode.id, id))
    .returning();
  if (!row) throw new Error("Access intent disappeared");
  return row;
}

/** Persist intent BEFORE the first network call; a restart always uses this PIN. */
export async function issueAccessCode(params: {
  reservationId: string;
  startsAt: Date;
  endsAt: Date;
  memberName?: string | null;
}): Promise<IssueCodeResult> {
  return withReservationLock(params.reservationId, async () => {
    const booking = await getReservation(params.reservationId);
    if (
      !(await getOperations()).accessCodesEnabled ||
      booking?.status !== "confirmed" ||
      booking.endsAt <= new Date() ||
      !isAccessCodePreparationDue(booking.startsAt)
    )
      throw new Error("Reservation not eligible for access preparation");
    const live = (await listCodesForReservation(booking.id)).find(
      (c) => !["revoked", "expired"].includes(c.status),
    );
    if (live)
      throw new Error("Existing access intent must be reconciled first");
    const { ACCESS_CODE_ENCRYPTION_KEY, NUKI_SMARTLOCK_ID } = requireEnv(
      "ACCESS_CODE_ENCRYPTION_KEY",
      "NUKI_SMARTLOCK_ID",
    );
    const plaintext = generateKeypadCode();
    const id = randomUUID();
    const values = { id, reservationId: booking.id, lockId: NUKI_SMARTLOCK_ID };
    const [record] = await db
      .insert(accessCode)
      .values({
        ...values,
        codeHash: hashCode(plaintext),
        codeLast2: plaintext.slice(-2),
        encryptedPin: encryptPin(
          plaintext,
          identity(values),
          ACCESS_CODE_ENCRYPTION_KEY,
        ),
        ...accessCodeValidity(
          booking.startsAt,
          booking.endsAt,
          await getShowerMinutes(),
        ),
        status: "failed",
        provisionState: "prepared",
        failureReason: "awaiting_device",
      })
      .returning();
    if (!record) throw new Error("Failed to persist access intent");
    const verified = await recoverAccessCode(record);
    return {
      accessCode: record,
      plaintext: verified ?? "",
      provisionedOnLock: Boolean(verified),
    };
  });
}

/**
 * Recover known success and retry definite rejection or a lost PUT with the
 * same PIN. An unknown PUT is never repeated with a different PIN.
 */
export async function recoverAccessCode(
  row: AccessCode,
): Promise<string | null> {
  if (row.revokeRequestedAt || ["revoked", "expired"].includes(row.status))
    return null;
  // A PIN already read back from the lock works independently of a later Wi-Fi
  // outage. Delivery can reuse the authenticated ciphertext without a new PUT.
  if (row.provisionState === "ready" && row.nukiAuthId && row.encryptedPin)
    return pinFor(row);
  const lockId =
    row.lockId ?? requireEnv("NUKI_SMARTLOCK_ID").NUKI_SMARTLOCK_ID;
  if (!row.lockId) row = await update(row.id, { lockId });
  const client = durableNukiClient(lockId);
  const probe = () =>
    client.inspect({
      codeHash: row.codeHash,
      allowedFrom: row.validFrom,
      allowedUntil: row.validUntil,
      nukiAuthId: row.nukiAuthId,
    });
  let inspected = await probe();
  if (inspected.state === "rejected") {
    // Nuki reports failure explicitly. Remove that failed operation before retry.
    if (!(await client.remove(inspected.nukiAuthId))) return null;
    row = await update(row.id, {
      provisionState: "prepared",
      nukiAuthId: null,
      submittedAt: null,
    });
    inspected = { state: "absent" };
  }
  if (
    inspected.state === "absent" &&
    submissionLapsed(row) &&
    row.encryptedPin
  ) {
    // The online lock confirms nothing arrived long after the PUT: it was lost.
    // Resubmit the SAME encrypted PIN and window; a second PIN is never made.
    row = await update(row.id, {
      provisionState: "prepared",
      nukiAuthId: null,
      submittedAt: null,
    });
  }
  if (inspected.state === "conflict" && row.provisionState === "prepared") {
    // Another keypad code already uses this PIN. It was never submitted, so no
    // lock holds it on our behalf: rotate it on the same row, then look again.
    const pin = generateKeypadCode();
    row = await update(row.id, {
      codeHash: hashCode(pin),
      codeLast2: pin.slice(-2),
      encryptedPin: encryptPin(
        pin,
        identity(row),
        requireEnv("ACCESS_CODE_ENCRYPTION_KEY").ACCESS_CODE_ENCRYPTION_KEY,
      ),
    });
    inspected = await probe();
  }
  if (inspected.state === "absent" && row.provisionState === "prepared") {
    const pin = pinFor(row);
    if (!pin) return null; // Legacy ambiguous rows cannot be recreated from a hash.
    row = await update(row.id, {
      provisionState: "submitted",
      submittedAt: new Date(),
      failureReason: "provisioning_unknown",
    });
    const outcome = await client.submit({
      name: `NAVI ${row.id.slice(0, 27)}`,
      code: Number(pin),
      allowedFrom: row.validFrom,
      allowedUntil: row.validUntil,
    });
    if (outcome === "rejected") {
      await update(row.id, {
        provisionState: "prepared",
        submittedAt: null,
        failureReason: "provider_rejected",
      });
      return null;
    }
    inspected = await probe();
  }
  if (inspected.state !== "ready") {
    await update(row.id, {
      failureReason:
        inspected.state === "offline"
          ? "device_offline"
          : "provisioning_unknown",
      status: "failed",
    });
    return null;
  }
  const encryptedPin =
    row.encryptedPin ??
    (env.ACCESS_CODE_ENCRYPTION_KEY
      ? encryptPin(
          inspected.plaintext,
          identity(row),
          env.ACCESS_CODE_ENCRYPTION_KEY,
        )
      : null);
  await update(row.id, {
    nukiAuthId: inspected.nukiAuthId,
    status: "scheduled",
    provisionState: "ready",
    encryptedPin,
    failureReason: null,
    attempts: 0,
    retryAt: null,
  });
  return inspected.plaintext;
}

/** Durable revocation intent must exist even if the process dies during DELETE. */
export async function requestCodeRevocations(reservationId: string) {
  await db
    .update(accessCode)
    .set({
      revokeRequestedAt: new Date(),
      retryAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(accessCode.reservationId, reservationId),
        inArray(accessCode.status, ["scheduled", "active", "used", "failed"]),
      ),
    );
}
/**
 * True only once the lock provably holds no authorization for this intent.
 * An offline lock or a failed read never counts as proof of absence.
 */
async function removeFromLock(row: AccessCode): Promise<boolean> {
  // Never submitted: the PIN never left this database, even during an outage.
  if (row.provisionState === "prepared" && !row.nukiAuthId) return true;
  const lockId =
    row.lockId ?? requireEnv("NUKI_SMARTLOCK_ID").NUKI_SMARTLOCK_ID;
  // Pin legacy revocations to this device before the first provider call,
  // so a configuration change cannot move a retry to another lock.
  if (!row.lockId) await update(row.id, { lockId });
  const client = durableNukiClient(lockId);
  let authId = row.nukiAuthId;
  if (!authId) {
    const state = await client.inspect({
      codeHash: row.codeHash,
      allowedFrom: row.validFrom,
      allowedUntil: row.validUntil,
    });
    if (state.state === "ready" || state.state === "rejected")
      authId = state.nukiAuthId;
    // `absent` comes only from an online lock. It proves absence when the PUT
    // can no longer land usefully: its window is over, or it was lost.
    else if (state.state === "absent")
      return row.validUntil <= new Date() || submissionLapsed(row);
  }
  return authId ? client.remove(authId) : false;
}

export async function revokeAccessCode(id: string): Promise<void> {
  const [initial] = await db
    .select()
    .from(accessCode)
    .where(eq(accessCode.id, id))
    .limit(1);
  if (!initial) return;
  return withReservationLock(initial.reservationId, async () => {
    const [row] = await db
      .select()
      .from(accessCode)
      .where(eq(accessCode.id, id))
      .limit(1);
    if (!row || ["revoked", "expired"].includes(row.status)) return;
    await update(id, {
      revokeRequestedAt: row.revokeRequestedAt ?? new Date(),
    });
    try {
      if (!(await removeFromLock(row)))
        throw new Error("Revocation not confirmed");
      await update(id, {
        status: row.validUntil <= new Date() ? "expired" : "revoked",
        encryptedPin: null,
        failureReason: null,
        retryAt: null,
      });
      const booking = await getReservation(row.reservationId);
      if (booking?.status === "confirmed") {
        await db
          .update(reservationPipeline)
          .set({
            status: "pending",
            nextRetryAt: new Date(),
            completedAt: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(reservationPipeline.reservationId, row.reservationId),
              inArray(reservationPipeline.step, [
                "code_created",
                "code_delivered",
              ]),
            ),
          );
      }
    } catch {
      const attempts = row.attempts + 1;
      await update(id, {
        attempts,
        failureReason: "revocation_pending",
        retryAt: new Date(Date.now() + Math.min(15, attempts * 2) * 60_000),
      });
      await raiseAlert({
        severity: "critical",
        dedupeKey: `code-revocation:${row.reservationId}`,
        title: "Vstupní kód zrušené rezervace čeká na odebrání",
        body: "Termín zůstává blokovaný. Systém odebrání automaticky opakuje.",
        context: { reservationId: row.reservationId },
      });
      throw new Error("Revocation not confirmed; slot remains blocked");
    }
  });
}
export async function reconcileRevocations(limit = 20) {
  // Include cancellations committed just before a crash, even without an intent flag.
  const rows = await db
    .select({ code: accessCode })
    .from(accessCode)
    .innerJoin(reservation, eq(reservation.id, accessCode.reservationId))
    .where(
      and(
        inArray(accessCode.status, ["scheduled", "active", "used", "failed"]),
        or(
          eq(reservation.status, "cancelled"),
          eq(reservation.accessRevocationPending, true),
          isNotNull(accessCode.revokeRequestedAt),
        ),
        or(isNull(accessCode.retryAt), lte(accessCode.retryAt, new Date())),
      ),
    )
    .orderBy(asc(accessCode.validFrom), asc(accessCode.id))
    .limit(limit);
  for (const { code } of rows) {
    try {
      await revokeAccessCode(code.id);
    } catch {
      /* intent remains due */
    }
  }
  const holds = await db
    .select({ id: reservation.id })
    .from(reservation)
    .where(eq(reservation.accessRevocationPending, true));
  for (const hold of holds) {
    try {
      await withReservationLock(hold.id, async () => {
        const codes = await listCodesForReservation(hold.id);
        if (codes.some((c) => !["revoked", "expired"].includes(c.status)))
          return;
        await db
          .update(reservation)
          .set({ accessRevocationPending: false, updatedAt: new Date() })
          .where(eq(reservation.id, hold.id));
        await resolveAlert(`code-revocation:${hold.id}`);
      });
    } catch {
      /* a busy lock must not keep the other holds from releasing */
    }
  }
  return rows.length;
}

/** An ended window stays on the lock this long before cleanup removes it. */
export const EXPIRY_GRACE_MS = 30 * 60_000;
const EXPIRY_ALERT_ATTEMPTS = 5;

/**
 * Keypad slots are finite: remove authorizations whose window has ended and
 * mark them expired. Bounded per run; a failure just waits for a later run.
 */
export async function expireEndedCodes(limit = 10): Promise<number> {
  const now = new Date();
  const due = await db
    .select({ id: accessCode.id, reservationId: accessCode.reservationId })
    .from(accessCode)
    .innerJoin(reservation, eq(reservation.id, accessCode.reservationId))
    .where(
      and(
        inArray(accessCode.status, ["scheduled", "active", "used"]),
        isNotNull(accessCode.nukiAuthId),
        lt(accessCode.validUntil, new Date(now.getTime() - EXPIRY_GRACE_MS)),
        // Cancellations belong to `reconcileRevocations`.
        isNull(accessCode.revokeRequestedAt),
        ne(reservation.status, "cancelled"),
        eq(reservation.accessRevocationPending, false),
        or(isNull(accessCode.retryAt), lte(accessCode.retryAt, now)),
      ),
    )
    .orderBy(asc(accessCode.validUntil), asc(accessCode.id))
    .limit(limit);
  let expired = 0;
  for (const code of due) {
    let removed: boolean;
    try {
      removed = await expireAccessCode(code.id, code.reservationId);
    } catch {
      continue; // This reservation is busy; a later run picks it up.
    }
    // An unreachable lock fails every call alike: stop and leave the rest due.
    if (!removed) break;
    expired++;
  }
  return expired;
}

async function expireAccessCode(
  id: string,
  reservationId: string,
): Promise<boolean> {
  return withReservationLock(reservationId, async () => {
    const [row] = await db
      .select()
      .from(accessCode)
      .where(eq(accessCode.id, id))
      .limit(1);
    if (
      !row ||
      row.revokeRequestedAt ||
      !["scheduled", "active", "used"].includes(row.status) ||
      row.validUntil.getTime() > Date.now() - EXPIRY_GRACE_MS
    )
      return true;
    let removed = false;
    try {
      removed = await removeFromLock(row);
    } catch {
      removed = false;
    }
    if (removed) {
      await update(id, {
        status: "expired",
        encryptedPin: null,
        failureReason: null,
        retryAt: null,
        attempts: 0,
      });
      await resolveAlert(`code-expiry:${id}`);
      return true;
    }
    const attempts = row.attempts + 1;
    await update(id, {
      attempts,
      failureReason: "expiry_pending",
      retryAt: new Date(Date.now() + Math.min(60, attempts * 5) * 60_000),
    });
    if (attempts === EXPIRY_ALERT_ATTEMPTS)
      await raiseAlert({
        severity: "warning",
        dedupeKey: `code-expiry:${id}`,
        title: "Prošlý vstupní kód se nedaří odebrat ze zámku",
        body: "Platnost kódu skončila, ale v klávesnici Nuki stále zabírá místo. Systém odebrání opakuje; zkontrolujte připojení zámku.",
        context: { reservationId, accessCodeId: id },
      });
    return false;
  });
}
export async function listCodesForReservation(
  reservationId: string,
): Promise<AccessCode[]> {
  return db
    .select()
    .from(accessCode)
    .where(eq(accessCode.reservationId, reservationId));
}
