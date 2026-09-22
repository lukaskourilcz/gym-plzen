import { sendTestReservationWhatsApp } from "./whatsapp-test";
import { isAccessCodeDeliveryDue } from "@/lib/config/access-code-delivery";
import { withReservationLock } from "./operation-lock";
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
  sendReservationConfirmation,
} from "./notifications";
import { notifyReservationConfirmed } from "./operator-notifications";
import { getPipeline, markStepFailed, markStepSucceeded } from "./pipeline";
import { issueAndSend } from "./invoices";

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

  // Confirmation is useful operationally, but must never hold back the entry
  // code. Access-code delivery remains the reliability pipeline's invariant.
  try {
    await sendReservationConfirmation({
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
      where: "fulfillment.sendReservationConfirmation",
      reservationId,
    });
  }

  // And the operator hears about the booking, if they asked to. The notice
  // claims the reservation once, so the watchdog's retries stay quiet.
  await notifyReservationConfirmed(reservation);

  // The payment document is an accounting convenience and is issued at most
  // once per reservation. Like the confirmation it must never hold back the
  // entry code, so every failure is logged and swallowed here.
  try {
    const outcome = await issueAndSend({
      reservationId,
      userId: reservation.userId ?? null,
      customerName: reservation.contactName,
      customerEmail: reservation.contactEmail,
      totalCents: reservation.priceCents,
      startsAt: reservation.startsAt,
    });
    if (!outcome.issued && outcome.reason === "profile_incomplete") {
      logger.warn("payment document skipped: billing profile incomplete", {
        reservationId,
      });
    }
  } catch (error) {
    logger.error(error, { where: "fulfillment.issueAndSend", reservationId });
  }

  // The physical lock is a separately enabled phase. Paid reservations still
  // receive their confirmation/document while lock work remains dormant.
  await markStepSucceeded(reservationId, "payment");
  if (!(await getOperations()).accessCodesEnabled) return;

  // This guard applies to every caller: payment, admin booking and watchdog.
  // Confirmation goes out immediately, but PINs never before start minus 60 min.
  if (!isAccessCodeDeliveryDue(reservation.startsAt)) return;

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
  if (plaintext) {
    const outcome = await dispatchAccessCode({
      accessCodeId,
      userId: reservation.userId ?? null,
      reservationId,
      name: reservation.contactName,
      code: plaintext,
      startsAt: reservation.startsAt,
      email: reservation.contactEmail,
      // Email is the only enabled delivery channel for access codes.
      notifyByWhatsapp: false,
      notifyBySms: false,
    });

    if (accessCodeId && codeValidity) {
      try {
        await sendTestReservationWhatsApp({
          reservationId,
          accessCodeId,
          userId: reservation.userId ?? null,
          phone: reservation.contactPhone,
          email: reservation.contactEmail,
          pin: plaintext,
          startsAt: reservation.startsAt,
          ...codeValidity,
        });
      } catch {
        // An optional test channel must never hold back the mandatory email.
        logger.error("WhatsApp test failed", {
          where: "fulfillment.whatsappTest",
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
