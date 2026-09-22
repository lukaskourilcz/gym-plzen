import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { messageDelivery } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { formatDateTime } from "@/lib/helpers/format";
import { isZernioTestRecipient } from "@/lib/helpers/zernio-access";
import { sendZernioAccessCode } from "@/lib/integrations/zernio";

/** Explicit, temporary allowlist. Unrelated customers remain on email only. */
export async function sendTestReservationWhatsApp(input: {
  reservationId: string;
  accessCodeId: string;
  userId: string | null;
  phone: string | null;
  email: string | null;
  pin: string;
  startsAt: Date;
  validFrom: Date;
  validUntil: Date;
}) {
  if (
    !isZernioTestRecipient({
      phone: input.phone,
      email: input.email,
      allowedPhone: env.ZERNIO_TEST_RECIPIENT,
      allowedEmail: env.ZERNIO_TEST_EMAIL,
    })
  )
    return;
  const [claim] = await db
    .insert(messageDelivery)
    .values({
      reservationId: input.reservationId,
      userId: input.userId,
      channel: "whatsapp",
      kind: "access_code",
      recipient: input.phone!,
      status: "queued",
      dedupeKey: `zernio-access/${input.accessCodeId}`,
    })
    .onConflictDoNothing({ target: messageDelivery.dedupeKey })
    .returning({ id: messageDelivery.id });
  if (!claim) return;
  const result = await sendZernioAccessCode({
    phone: input.phone!,
    pin: input.pin,
    reservationTime: formatDateTime(input.startsAt),
    validFrom: formatDateTime(input.validFrom),
    validUntil: formatDateTime(input.validUntil),
  });
  await db
    .update(messageDelivery)
    .set({
      status: result.sent ? "sent" : "failed",
      providerMessageId: result.sent ? result.providerMessageId : null,
      failureReason: result.sent ? null : result.error,
      sentAt: result.sent ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(messageDelivery.id, claim.id));
}
