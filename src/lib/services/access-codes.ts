import { withReservationLock } from "./operation-lock";
import { getOperations } from "./operations";
import { getReservation } from "./reservations";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { accessCode } from "@/lib/db/schema";
import type { AccessCode } from "@/lib/db/types";
import { generateKeypadCode, hashCode } from "@/lib/helpers/crypto";
import { accessCodeValidity } from "@/lib/config/access-code-delivery";
import { logger } from "@/lib/helpers/logger";
import {
  createKeypadCode,
  deleteAuth,
  recoverKeypadCode,
} from "@/lib/integrations/nuki";
import { getShowerMinutes } from "./schedule";

/**
 * Access-code service : generates a time-limited numeric code, provisions it on
 * the Nuki lock, and stores only its hash. The plaintext is returned exactly
 * once (to hand to the notification dispatcher) and never persisted.
 */

export interface IssueCodeResult {
  accessCode: AccessCode;
  /** Plaintext code : use immediately for delivery, then discard. */
  plaintext: string;
  provisionedOnLock: boolean;
}

/**
 * Issue an access code for a reservation. Creates the DB record regardless of
 * whether the lock provisioning succeeds (so the pipeline/watchdog can retry
 * the lock step), and reports lock status back to the caller.
 */
export async function issueAccessCode(params: {
  reservationId: string;
  startsAt: Date;
  endsAt: Date;
  memberName?: string | null;
}): Promise<IssueCodeResult> {
  return withReservationLock(params.reservationId, () =>
    issueAccessCodeLocked(params),
  );
}
async function issueAccessCodeLocked(params: {
  reservationId: string;
  startsAt: Date;
  endsAt: Date;
  memberName?: string | null;
}): Promise<IssueCodeResult> {
  const reservation = await getReservation(params.reservationId);
  if (
    !(await getOperations()).accessCodesEnabled ||
    reservation?.status !== "confirmed" ||
    reservation.endsAt <= new Date()
  )
    throw new Error(
      "Access-code issuance is disabled or reservation is not eligible",
    );
  const existing = await listCodesForReservation(params.reservationId);
  if (
    existing.some((row) => row.status !== "revoked" && row.status !== "expired")
  )
    throw new Error("Existing access code must be reconciled or revoked first");
  const plaintext = generateKeypadCode();
  // Entry starts exactly with the reservation and includes the shower grace.
  const showerMinutes = await getShowerMinutes();
  const { validFrom, validUntil } = accessCodeValidity(
    params.startsAt,
    params.endsAt,
    showerMinutes,
  );

  const [record] = await db
    .insert(accessCode)
    .values({
      reservationId: params.reservationId,
      codeHash: hashCode(plaintext),
      codeLast2: plaintext.slice(-2),
      validFrom,
      validUntil,
      status: "failed",
      failureReason: "provisioning_unknown",
    })
    .returning();

  if (!record) throw new Error("Failed to persist access code.");

  const lock = await createKeypadCode({
    name: `Rez. ${params.reservationId.slice(0, 8)}${
      params.memberName ? ` – ${params.memberName}` : ""
    }`,
    code: Number(plaintext),
    allowedFrom: validFrom,
    allowedUntil: validUntil,
  });

  if (lock.created && lock.nukiAuthId) {
    await db
      .update(accessCode)
      .set({
        nukiAuthId: lock.nukiAuthId,
        status: "scheduled",
        failureReason: null,
        updatedAt: new Date(),
      })
      .where(eq(accessCode.id, record.id));
  } else {
    logger.warn(
      "Nuki provisioning unconfirmed; authorization will be reconciled",
      {
        reservationId: params.reservationId,
        error: lock.error,
      },
    );
    await db
      .update(accessCode)
      .set({
        status: "failed",
        failureReason: "provisioning_unknown",
        updatedAt: new Date(),
      })
      .where(eq(accessCode.id, record.id));
  }

  return {
    accessCode: record,
    plaintext,
    provisionedOnLock: Boolean(lock.created && lock.nukiAuthId),
  };
}

/** Revoke a code on the lock and mark it revoked (e.g. on cancellation). */
export async function revokeAccessCode(id: string): Promise<void> {
  const [row] = await db
    .select()
    .from(accessCode)
    .where(eq(accessCode.id, id))
    .limit(1);
  if (!row || row.status === "revoked") return;
  return withReservationLock(row.reservationId, () =>
    revokeAccessCodeLocked(id),
  );
}
async function revokeAccessCodeLocked(id: string): Promise<void> {
  const [row] = await db
    .select()
    .from(accessCode)
    .where(eq(accessCode.id, id))
    .limit(1);
  if (!row || row.status === "revoked") return;
  if (row.failureReason === "provisioning_unknown" && !row.nukiAuthId) {
    const recovered = await recoverKeypadCode({
      codeHash: row.codeHash,
      allowedFrom: row.validFrom,
      allowedUntil: row.validUntil,
    });
    if (!recovered)
      throw new Error(
        "Unknown Nuki authorization must be reconciled before revocation",
      );
    row.nukiAuthId = recovered.nukiAuthId;
    await db
      .update(accessCode)
      .set({ nukiAuthId: recovered.nukiAuthId, updatedAt: new Date() })
      .where(eq(accessCode.id, id));
  }
  if (row.nukiAuthId && !(await deleteAuth(row.nukiAuthId))) {
    throw new Error(
      "Nuki code revocation failed; the code is still considered active.",
    );
  }
  await db
    .update(accessCode)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(eq(accessCode.id, id));
}

/** All codes for a reservation. */
export async function listCodesForReservation(
  reservationId: string,
): Promise<AccessCode[]> {
  return db
    .select()
    .from(accessCode)
    .where(eq(accessCode.reservationId, reservationId));
}

/** Resume a timed-out create or email attempt without changing the customer's PIN. */
export async function recoverAccessCode(
  row: AccessCode,
): Promise<string | null> {
  const recovered = await recoverKeypadCode({
    codeHash: row.codeHash,
    allowedFrom: row.validFrom,
    allowedUntil: row.validUntil,
    nukiAuthId: row.nukiAuthId,
  });
  if (!recovered) return null;
  await db
    .update(accessCode)
    .set({
      nukiAuthId: recovered.nukiAuthId,
      status: "scheduled",
      failureReason: null,
      updatedAt: new Date(),
    })
    .where(eq(accessCode.id, row.id));
  return recovered.plaintext;
}
