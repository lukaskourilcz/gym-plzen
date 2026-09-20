import "server-only";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { assertAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { accessCode, reservation, profiles, entryLog } from "@/lib/db/schema";
import { readKeypadCodes, readKeypadUsageLog } from "@/lib/integrations/nuki";
import { hashCode } from "@/lib/helpers/crypto";

import { isSuccessfulKeypadUse } from "@/lib/helpers/nuki-usage";

export const ACCESS_CODE_PAGE_SIZE = 50;

/** Authorize before either database or Nuki access; never persist fetched PINs. */
export async function listAdminAccessCodes(page: number) {
  await assertAdmin();
  const records = await db.select({
    code: accessCode,
    reservationId: reservation.id,
    reservationStart: reservation.startsAt,
    reservationEnd: reservation.endsAt,
    reservationStatus: reservation.status,
    userId: reservation.userId,
    name: reservation.contactName,
    email: reservation.contactEmail,
    memberName: profiles.fullName,
    memberEmail: profiles.email,
  }).from(accessCode)
    .innerJoin(reservation, eq(reservation.id, accessCode.reservationId))
    .leftJoin(profiles, eq(profiles.id, reservation.userId))
    .orderBy(desc(accessCode.createdAt), desc(accessCode.id))
    .offset((page - 1) * ACCESS_CODE_PAGE_SIZE).limit(ACCESS_CODE_PAGE_SIZE + 1);
  let nukiUnavailable = false;
  const pins = records.length ? await readKeypadCodes().catch(() => {
    nukiUnavailable = true;
    return [];
  }) : [];
  let usageUnavailable = false;
  const visible = records.slice(0, ACCESS_CODE_PAGE_SIZE);
  const usage = visible.length ? await readKeypadUsageLog(new Date(Math.min(...visible.map(r => r.code.createdAt.getTime()))))
    .catch(() => { usageUnavailable = true; return { entries: [], complete: false }; }) : { entries: [], complete: true };
  if (!usage.complete) usageUnavailable = true;
  const uses = usage.entries.filter(isSuccessfulKeypadUse).flatMap(event => {
    const match = visible.find(r => r.code.nukiAuthId === event.authId);
    return match ? [{ nukiLogId: event.id, nukiName: event.name ?? null,
      accessCodeId: match.code.id, reservationId: match.reservationId, userId: match.userId,
      action: "keypad_open", trigger: "keypad", occurredAt: new Date(event.date) }] : [];
  });
  // Retain verified use even after Nuki removes an expired authorization or old logs.
  const uniqueUses = [...new Map(uses.map(use => [use.nukiLogId, use])).values()];
  if (uniqueUses.length) await db.insert(entryLog).values(uniqueUses).onConflictDoUpdate({
    target: entryLog.nukiLogId, set: {
      accessCodeId: sql`excluded.access_code_id`, reservationId: sql`excluded.reservation_id`,
      userId: sql`excluded.user_id`, action: sql`excluded.action`, trigger: sql`excluded.trigger`,
    },
  });
  const storedUses = visible.length ? await db.select({ codeId: entryLog.accessCodeId, at: entryLog.occurredAt })
    .from(entryLog).where(inArray(entryLog.accessCodeId, visible.map(r => r.code.id)))
    .orderBy(desc(entryLog.occurredAt)) : [];
  const rows = records.slice(0, ACCESS_CODE_PAGE_SIZE).map(({ code, ...row }) => {
    const auth = pins.find((pin) => pin.id === code.nukiAuthId && hashCode(pin.code) === code.codeHash);
    return { ...row, id: code.id, status: code.status, validFrom: code.validFrom,
      validUntil: code.validUntil, createdAt: code.createdAt,
      pin: auth?.code ?? null, last2: code.codeLast2,
      usedAt: storedUses.filter(use => use.codeId === code.id).map(use => use.at) };
  });
  return { rows, nukiUnavailable, usageUnavailable, hasNext: records.length > ACCESS_CODE_PAGE_SIZE };
}
