import "server-only";
import { inArray } from "drizzle-orm";
import { assertAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { accessCode, reservationPipeline } from "@/lib/db/schema";
import type { Reservation } from "@/lib/db/types";
import { env } from "@/lib/env";
import { decryptPin } from "@/lib/helpers/pin-vault";
import { reservationAccessState } from "@/lib/helpers/reservation-access-state";
import { getOperations } from "./operations";

/** Only this authorized server-side projection may reveal a verified PIN. */
export async function adminReservationAccess(rows: Reservation[]) {
  await assertAdmin();
  const ids = rows.map((r) => r.id);
  if (!ids.length)
    return new Map<string, { label: string; at?: Date; pin?: string }>();
  const [codes, steps, operations] = await Promise.all([
    db.select().from(accessCode).where(inArray(accessCode.reservationId, ids)),
    db
      .select()
      .from(reservationPipeline)
      .where(inArray(reservationPipeline.reservationId, ids)),
    getOperations(),
  ]);
  return new Map(
    rows.map((r) => {
      const code = codes.find(
        (c) =>
          c.reservationId === r.id &&
          !["revoked", "expired"].includes(c.status),
      );
      const delivered = steps.some(
        (s) =>
          s.reservationId === r.id &&
          s.step === "code_delivered" &&
          s.status === "succeeded",
      );
      const state = reservationAccessState({
        ...r,
        hold: r.accessRevocationPending,
        delivered,
        code,
        enabled: operations.accessCodesEnabled,
      });
      let pin: string | undefined;
      if (
        r.status === "confirmed" &&
        r.endsAt > new Date() &&
        code?.provisionState === "ready" &&
        !code.revokeRequestedAt &&
        code.encryptedPin &&
        env.ACCESS_CODE_ENCRYPTION_KEY
      ) {
        try {
          pin = decryptPin(
            code.encryptedPin,
            `access-code:${code.id}:${r.id}:${code.lockId}`,
            env.ACCESS_CODE_ENCRYPTION_KEY,
          );
        } catch {
          /* Never leak ciphertext or key errors into the browser. */
        }
      }
      return [r.id, { ...state, pin }];
    }),
  );
}
