import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNotNull, isNull, lte, or } from "drizzle-orm";
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

/** Recover known success, retry definite rejection, never repeat an unknown PUT. */
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
      const lockId =
        row.lockId ?? requireEnv("NUKI_SMARTLOCK_ID").NUKI_SMARTLOCK_ID;
      // Pin legacy revocations to this device before the first provider call,
      // so a configuration change cannot move a retry to another lock.
      if (!row.lockId) await update(id, { lockId });
      const client = durableNukiClient(lockId);
      let authId = row.nukiAuthId;
      let absent = false;
      if (!authId) {
        const state = await client.inspect({
          codeHash: row.codeHash,
          allowedFrom: row.validFrom,
          allowedUntil: row.validUntil,
        });
        if (state.state === "ready" || state.state === "rejected")
          authId = state.nukiAuthId;
        // Only never-submitted intents can be retired on confirmed absence.
        absent = state.state === "absent" && row.provisionState === "prepared";
      }
      if (!absent && (!authId || !(await client.remove(authId))))
        throw new Error("Revocation not confirmed");
      await update(id, {
        status: "revoked",
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
  for (const hold of holds)
    await withReservationLock(hold.id, async () => {
      const codes = await listCodesForReservation(hold.id);
      if (codes.some((c) => !["revoked", "expired"].includes(c.status))) return;
      await db
        .update(reservation)
        .set({ accessRevocationPending: false, updatedAt: new Date() })
        .where(eq(reservation.id, hold.id));
      await resolveAlert(`code-revocation:${hold.id}`);
    });
  return rows.length;
}
export async function listCodesForReservation(
  reservationId: string,
): Promise<AccessCode[]> {
  return db
    .select()
    .from(accessCode)
    .where(eq(accessCode.reservationId, reservationId));
}
