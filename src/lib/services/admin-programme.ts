import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  accessCode,
  entryLog,
  messageDelivery,
  reservation,
  reservationPipeline,
} from "@/lib/db/schema";

/** Read after requireAdmin. No provider calls, PIN reads or synchronization writes. */
export async function programmeCodeStates(reservationIds: string[]) {
  if (!reservationIds.length)
    return new Map<string, { sent: boolean; used: boolean }>();
  const rows = await db
    .select({
      reservationId: accessCode.reservationId,
      sent: sql<boolean>`exists (select 1 from ${reservationPipeline}
      where ${reservationPipeline.reservationId}=${accessCode.reservationId}
        and ${reservationPipeline.step}='code_delivered' and ${reservationPipeline.status}='succeeded'
        and ${reservationPipeline.completedAt}>=${accessCode.createdAt})
      or exists (select 1 from ${messageDelivery}
        where ${messageDelivery.reservationId}=${accessCode.reservationId}
          and ${messageDelivery.kind}='access_code'
          and ${messageDelivery.sentAt}>=${accessCode.createdAt})`,
      used: sql<boolean>`exists (select 1 from ${entryLog}
      where ${entryLog.accessCodeId}=${accessCode.id}
        and ${entryLog.reservationId}=${accessCode.reservationId}
        and ${entryLog.trigger}='keypad'
        and ${entryLog.action} in ('keypad_open','unlock','unlatch','lock_n_go','action_5'))`,
    })
    .from(accessCode)
    .innerJoin(reservation, eq(reservation.id, accessCode.reservationId))
    .where(
      and(
        inArray(accessCode.reservationId, reservationIds),
        eq(reservation.status, "confirmed"),
        ne(accessCode.status, "revoked"),
        ne(accessCode.status, "failed"),
        eq(accessCode.validFrom, reservation.startsAt),
        sql`${accessCode.validUntil}>=${reservation.endsAt}`,
      ),
    )
    .orderBy(desc(accessCode.createdAt), desc(accessCode.id));
  const states = new Map<string, { sent: boolean; used: boolean }>();
  for (const row of rows)
    if (!states.has(row.reservationId))
      states.set(row.reservationId, { sent: row.sent, used: row.used });
  return states;
}
