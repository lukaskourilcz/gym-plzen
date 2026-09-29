import { sendReservationWhatsApp } from "./whatsapp-delivery";
import {
  isAccessCodeDeliveryDue,
  isAccessCodePreparationDue,
} from "@/lib/config/access-code-delivery";
import { withOperationLock, withReservationLock } from "./operation-lock";
import { getOperations } from "./operations";
import { logger } from "@/lib/helpers/logger";
import { getReservation } from "./reservations";
import {
  issueAccessCode,
  listCodesForReservation,
  recoverAccessCode,
} from "./access-codes";
import {
  dispatchAccessCode,
  sendOrderConfirmation,
  sendReservationConfirmation,
} from "./notifications";
import {
  notifyOrderConfirmed,
  notifyReservationConfirmed,
} from "./operator-notifications";
import { getPipeline, markStepFailed, markStepSucceeded } from "./pipeline";
import { issueDocumentFor } from "./invoices";
import { getOrder, listOrderReservations } from "./order-state";
import type { BookingOrder, Reservation } from "@/lib/db/types";

/**
 * Fulfillment orchestrator : runs a confirmed reservation through the reliability
 * pipeline: (payment ✓) → code_created → code_delivered. Called after payment
 * confirmation (Comgate webhook / membership booking) and by the watchdog cron
 * to retry stuck reservations. Idempotent: it inspects existing state and only
 * does the work that remains.
 */

export async function fulfillReservation(reservationId: string): Promise<void> {
  return withReservationLock(reservationId, () => fulfillLocked(reservationId));
}
/**
 * The once-per-purchase side effects: the customer's confirmation, the
 * operator's notice and the payment document. A slot of a multi-slot order
 * shares them with its order, so they are sent once for the whole order and
 * under a lock of their own: it is taken last and holds no other, which keeps
 * it free of lock-order cycles with the payment and reservation locks.
 */
async function announceConfirmed(reservation: Reservation): Promise<boolean> {
  const order = reservation.orderId
    ? await getOrder(reservation.orderId)
    : null;
  if (order && order.status !== "confirmed") return true;
  const all = order ? await listOrderReservations(order.id) : [];
  const slots = all.filter(
    (slot) => slot.status === "confirmed" || slot.status === "completed",
  );
  // Decided by what was bought, not by what is still booked: a slot of a
  // larger order cancelled later must not turn the watchdog's next retry into
  // a single-slot confirmation of its sibling.
  const perOrder = order !== null && all.length > 1;
  const run = () =>
    announceUnlocked(reservation, perOrder ? { order: order!, slots } : null);
  return order
    ? withOperationLock(`order-fulfillment:${order.id}`, run)
    : run();
}

async function announceUnlocked(
  reservation: Reservation,
  order: { order: BookingOrder; slots: Reservation[] } | null,
): Promise<boolean> {
  const reservationId = reservation.id;
  let confirmationSent = false;
  try {
    if (order) confirmationSent = await sendOrderConfirmation(order);
    else
      confirmationSent = await sendReservationConfirmation({
        userId: reservation.userId ?? null,
        reservationId,
        name: reservation.contactName,
        startsAt: reservation.startsAt,
        endsAt: reservation.endsAt,
        priceCents: reservation.priceCents,
        loyaltyReward: reservation.loyaltyReward,
        email: reservation.contactEmail,
      });
  } catch (error) {
    logger.error(error, {
      where: "fulfillment.sendConfirmation",
      reservationId,
    });
  }

  // And the operator hears about the booking, if they asked to. The notice
  // claims its scope once, so the watchdog's retries stay quiet.
  if (order) await notifyOrderConfirmed(order);
  else await notifyReservationConfirmed(reservation);

  // The payment document is an accounting convenience and is issued at most
  // once per reservation, or once per order. Every failure is logged and
  // swallowed here.
  try {
    const outcome = await issueDocumentFor(reservation);
    if (!outcome.issued && outcome.reason === "profile_incomplete") {
      logger.warn("payment document skipped: billing profile incomplete", {
        reservationId,
      });
    }
  } catch (error) {
    logger.error(error, { where: "fulfillment.issueDocument", reservationId });
  }
  return confirmationSent;
}

async function fulfillLocked(reservationId: string): Promise<void> {
  const reservation = await getReservation(reservationId);
  if (
    !reservation ||
    reservation.status !== "confirmed" ||
    reservation.endsAt <= new Date()
  ) {
    logger.warn("fulfillReservation: reservation not found", { reservationId });
    return;
  }

  // Step: payment : reaching here means it's confirmed/paid.
  // Keep this step pending until initial fulfillment finishes, so a crash
  // after the payment commit is recoverable even while the lock is disabled.

  // Confirmation, the operator's notice and the payment document are useful
  // operationally, but must never hold back the entry code. Access-code
  // delivery remains the reliability pipeline's invariant.
  const confirmationSent = await announceConfirmed(reservation);

  // The physical lock is a separately enabled phase. Paid reservations still
  // receive their confirmation/document while lock work remains dormant.
  // The "payment" step also carries the customer's confirmation: a paid
  // customer who never heard back is retried and, in the end, alerted.
  if (confirmationSent) await markStepSucceeded(reservationId, "payment");
  else
    await markStepFailed(
      reservationId,
      "payment",
      "Potvrzovací e-mail zákazníkovi se nepodařilo odeslat.",
    );
  if (!(await getOperations()).accessCodesEnabled) return;

  // This guard applies to every caller: payment, admin booking and watchdog.
  // Confirmation is immediate; prepare at -24h, deliver separately at -1h.
  if (!isAccessCodePreparationDue(reservation.startsAt)) return;

  // Step: code_created : issue a code + provision it on the lock (once).
  const existing = await listCodesForReservation(reservationId);
  const pipeline = await getPipeline(reservationId);
  const deliveryDone = pipeline.some(
    (step) => step.step === "code_delivered" && step.status === "succeeded",
  );
  let plaintext: string | null = null;
  let codeReady = existing.some(
    (c) => ["scheduled", "active", "used"].includes(c.status) && c.nukiAuthId,
  );

  const liveCode = existing.find(
    (code) => !["revoked", "expired"].includes(code.status),
  );
  let accessCodeId = liveCode?.id;
  let codeValidity = liveCode
    ? { validFrom: liveCode.validFrom, validUntil: liveCode.validUntil }
    : null;
  if (!deliveryDone && liveCode) {
    try {
      plaintext = await recoverAccessCode(liveCode);
    } catch {
      plaintext = null;
    }
    if (!plaintext) {
      await markStepFailed(
        reservationId,
        "code_created",
        "Nuki zatím nepotvrdilo správný kód a jeho platnost. Další kód se nevytváří.",
      );
      return;
    }
    codeReady = true;
    await markStepSucceeded(reservationId, "code_created");
  } else if (!deliveryDone) {
    try {
      const issued = await issueAccessCode({
        reservationId,
        startsAt: reservation.startsAt,
        endsAt: reservation.endsAt,
        memberName: reservation.contactName,
      });
      plaintext = issued.plaintext;
      accessCodeId = issued.accessCode.id;
      codeValidity = {
        validFrom: issued.accessCode.validFrom,
        validUntil: issued.accessCode.validUntil,
      };
      codeReady = issued.provisionedOnLock;
      if (issued.provisionedOnLock) {
        await markStepSucceeded(reservationId, "code_created");
      } else {
        await markStepFailed(
          reservationId,
          "code_created",
          "Nuki provisioning failed",
        );
        return;
      }
    } catch (e) {
      await markStepFailed(
        reservationId,
        "code_created",
        e instanceof Error ? e.message : "unknown",
      );
      return;
    }
  } else if (codeReady) {
    await markStepSucceeded(reservationId, "code_created");
  }

  // Deliver a newly confirmed PIN or the same PIN recovered from Nuki.
  // A stable Resend key prevents duplicate sends after an ambiguous response.
  if (plaintext && isAccessCodeDeliveryDue(reservation.startsAt)) {
    const outcome = await dispatchAccessCode({
      accessCodeId,
      userId: reservation.userId ?? null,
      reservationId,
      name: reservation.contactName,
      code: plaintext,
      startsAt: reservation.startsAt,
      email: reservation.contactEmail,
      // WhatsApp goes separately below (Zernio), never instead of e-mail.
      notifyByWhatsapp: false,
      notifyBySms: false,
    });

    if (accessCodeId && codeValidity) {
      try {
        await sendReservationWhatsApp({
          reservationId,
          accessCodeId,
          userId: reservation.userId ?? null,
          pin: plaintext,
          startsAt: reservation.startsAt,
          ...codeValidity,
        });
      } catch {
        // The optional channel must never hold back the mandatory e-mail.
        logger.error("WhatsApp delivery failed", {
          where: "fulfillment.whatsapp",
          reservationId,
        });
      }
    }

    if (outcome.emailDelivered) {
      await markStepSucceeded(reservationId, "code_delivered");
    } else {
      await markStepFailed(
        reservationId,
        "code_delivered",
        "Mandatory email delivery failed",
      );
    }
  }
}
