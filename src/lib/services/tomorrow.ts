import { and, asc, eq, gte, inArray, lt, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  accessCode,
  messageDelivery,
  profiles,
  reservation,
} from "@/lib/db/schema";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  localDateTimeToDate,
} from "@/lib/helpers/datetime";
import {
  checkTomorrowCode,
  checkTomorrowDelivery,
} from "@/lib/helpers/tomorrow-readiness";
import { readKeypadCodes } from "@/lib/integrations/nuki";

export async function getTomorrowOverview(now = new Date()) {
  const dateKey = addDaysToDateKey(dateKeyInTimeZone(now), 1);
  const start = localDateTimeToDate(dateKey, 0);
  const end = localDateTimeToDate(addDaysToDateKey(dateKey, 1), 0);
  const bookings = await db
    .select({
      id: reservation.id,
      startsAt: reservation.startsAt,
      endsAt: reservation.endsAt,
      status: reservation.status,
      contactName: reservation.contactName,
      contactEmail: reservation.contactEmail,
      userId: reservation.userId,
      whatsAppOptIn: profiles.notifyByWhatsapp,
      whatsAppPhone: profiles.phone,
    })
    .from(reservation)
    .leftJoin(profiles, eq(profiles.id, reservation.userId))
    .where(
      and(
        gte(reservation.startsAt, start),
        lt(reservation.startsAt, end),
        ne(reservation.status, "cancelled"),
      ),
    )
    .orderBy(asc(reservation.startsAt), asc(reservation.id));

  if (!bookings.length)
    return { dateKey, rows: [], confirmed: 0, pending: 0, needsAttention: 0 };
  const ids = bookings.map((booking) => booking.id);
  const [codes, deliveries] = await Promise.all([
    db.select().from(accessCode).where(inArray(accessCode.reservationId, ids)),
    db
      .select({
        reservationId: messageDelivery.reservationId,
        channel: messageDelivery.channel,
        status: messageDelivery.status,
        createdAt: messageDelivery.createdAt,
      })
      .from(messageDelivery)
      .where(
        and(
          inArray(messageDelivery.reservationId, ids),
          eq(messageDelivery.kind, "access_code"),
        ),
      )
      .orderBy(asc(messageDelivery.createdAt)),
  ]);
  // A Nuki read failure means "cannot verify", never a false mismatch.
  const nuki = codes.some(
    (code) => !["revoked", "expired"].includes(code.status),
  )
    ? await readKeypadCodes().catch(() => null)
    : [];
  const rows = bookings.map((booking) => {
    const code =
      codes.find(
        (item) =>
          item.reservationId === booking.id &&
          !["revoked", "expired"].includes(item.status),
      ) ?? null;
    const latest = (channel: "email" | "whatsapp") =>
      deliveries
        .filter(
          (item) =>
            item.reservationId === booking.id && item.channel === channel,
        )
        .at(-1)?.status ?? null;
    const codeCheck =
      booking.status === "confirmed"
        ? checkTomorrowCode(booking.startsAt, code, nuki, now)
        : "scheduled";
    const email =
      booking.status === "confirmed"
        ? checkTomorrowDelivery(
            booking.startsAt,
            Boolean(booking.contactEmail),
            latest("email"),
            now,
          )
        : "scheduled";
    const whatsApp =
      booking.status === "confirmed"
        ? checkTomorrowDelivery(
            booking.startsAt,
            Boolean(
              booking.userId && booking.whatsAppOptIn && booking.whatsAppPhone,
            ),
            latest("whatsapp"),
            now,
          )
        : "scheduled";
    return {
      id: booking.id,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      status: booking.status,
      contactName:
        booking.contactName ?? booking.contactEmail ?? "Kontakt neuveden",
      userId: booking.userId,
      codeCheck,
      email,
      whatsApp,
    };
  });
  return {
    dateKey,
    rows,
    confirmed: rows.filter((row) => row.status === "confirmed").length,
    pending: rows.filter((row) => row.status === "pending").length,
    needsAttention: rows.filter(
      (row) =>
        row.status === "confirmed" &&
        (["missing", "mismatch"].includes(row.codeCheck) ||
          row.email === "failed" ||
          row.whatsApp === "failed"),
    ).length,
  };
}
