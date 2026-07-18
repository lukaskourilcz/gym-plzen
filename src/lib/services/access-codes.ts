import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { accessCode } from "@/lib/db/schema";
import type { AccessCode } from "@/lib/db/types";
import { generateNumericCode, hashCode } from "@/lib/helpers/crypto";
import { addMinutes } from "@/lib/helpers/datetime";
import { logger } from "@/lib/helpers/logger";
import { createKeypadCode, deleteAuth } from "@/lib/integrations/nuki";
import { CODE_LEAD_MINUTES } from "@/lib/config/schedule";
import { getShowerMinutes } from "./schedule";

/**
 * Access-code service — generates a time-limited numeric code, provisions it on
 * the Nuki lock, and stores only its hash. The plaintext is returned exactly
 * once (to hand to the notification dispatcher) and never persisted.
 */


export interface IssueCodeResult {
  accessCode: AccessCode;
  /** Plaintext code — use immediately for delivery, then discard. */
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
  const plaintext = generateNumericCode(6);
  // Code valid from a lead time before the slot until the end of the slot plus
  // the shower grace, so the member can shower after training.
  const showerMinutes = await getShowerMinutes();
  const validFrom = addMinutes(params.startsAt, -CODE_LEAD_MINUTES);
  const validUntil = addMinutes(params.endsAt, showerMinutes);

  const [record] = await db
    .insert(accessCode)
    .values({
      reservationId: params.reservationId,
      codeHash: hashCode(plaintext),
      codeLast2: plaintext.slice(-2),
      validFrom,
      validUntil,
      status: "scheduled",
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

  if (lock.created) {
    await db
      .update(accessCode)
      .set({ nukiAuthId: lock.nukiAuthId, updatedAt: new Date() })
      .where(eq(accessCode.id, record.id));
  } else {
    logger.warn("Nuki provisioning failed; code stored for retry", {
      reservationId: params.reservationId,
      error: lock.error,
    });
    await db
      .update(accessCode)
      .set({ status: "failed", failureReason: lock.error, updatedAt: new Date() })
      .where(eq(accessCode.id, record.id));
  }

  return {
    accessCode: record,
    plaintext,
    provisionedOnLock: lock.created,
  };
}

/** Revoke a code on the lock and mark it revoked (e.g. on cancellation). */
export async function revokeAccessCode(id: string): Promise<void> {
  const [row] = await db
    .select()
    .from(accessCode)
    .where(eq(accessCode.id, id))
    .limit(1);
  if (!row) return;
  if (row.nukiAuthId) await deleteAuth(row.nukiAuthId);
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
