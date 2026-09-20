import "server-only";
import { desc, eq } from "drizzle-orm";
import { assertAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { accessCode, reservation, profiles } from "@/lib/db/schema";
import { readKeypadCodes } from "@/lib/integrations/nuki";
import { hashCode } from "@/lib/helpers/crypto";

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
  const rows = records.slice(0, ACCESS_CODE_PAGE_SIZE).map(({ code, ...row }) => {
    const auth = pins.find((pin) => pin.id === code.nukiAuthId && hashCode(pin.code) === code.codeHash);
    return { ...row, id: code.id, status: code.status, validFrom: code.validFrom,
      validUntil: code.validUntil, createdAt: code.createdAt,
      pin: auth?.code ?? null, last2: code.codeLast2 };
  });
  return { rows, nukiUnavailable, hasNext: records.length > ACCESS_CODE_PAGE_SIZE };
}
