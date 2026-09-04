import { logger } from "@/lib/helpers/logger";
import { getReservation } from "./reservations";
import {
  issueAccessCode,
  listCodesForReservation,
  revokeAccessCode,
} from "./access-codes";
import {
  dispatchAccessCode,
  loadMemberChannels,
  sendReservationConfirmation,
} from "./notifications";
import { getPipeline, markStepFailed, markStepSucceeded } from "./pipeline";
import { issueAndSend } from "./invoices";

/**
 * Fulfillment orchestrator : runs a confirmed reservation through the reliability
 * pipeline: (payment ✓) → code_created → code_delivered. Called after payment
 * confirmation (Stripe webhook / membership booking) and by the watchdog cron
 * to retry stuck reservations. Idempotent: it inspects existing state and only
 * does the work that remains.
 */

export async function fulfillReservation(reservationId: string): Promise<void> {
  const reservation = await getReservation(reservationId);
  if (!reservation) {
    logger.warn("fulfillReservation: reservation not found", { reservationId });
    return;
  }

  // Step: payment : reaching here means it's confirmed/paid.
  await markStepSucceeded(reservationId, "payment");

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
      email: reservation.contactEmail,
    });
  } catch (error) {
    logger.error(error, {
      where: "fulfillment.sendReservationConfirmation",
      reservationId,
    });
  }

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

  // Step: code_created : issue a code + provision it on the lock (once).
  const existing = await listCodesForReservation(reservationId);
  const pipeline = await getPipeline(reservationId);
  const deliveryDone = pipeline.some(
    (step) => step.step === "code_delivered" && step.status === "succeeded",
  );
  let plaintext: string | null = null;
  let codeReady = existing.some((c) => c.status !== "failed" && c.nukiAuthId);

  const needsFreshCode =
    existing.length === 0 || !codeReady || (codeReady && !deliveryDone);

  if (needsFreshCode && !deliveryDone) {
    if (codeReady) {
      await Promise.allSettled(
        existing
          .filter((code) => code.nukiAuthId)
          .map((code) => revokeAccessCode(code.id)),
      );
      codeReady = false;
    }
    try {
      const issued = await issueAccessCode({
        reservationId,
        startsAt: reservation.startsAt,
        endsAt: reservation.endsAt,
        memberName: reservation.contactName,
      });
      plaintext = issued.plaintext;
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

  // Step: code_delivered : dispatch across channels. We can only deliver a
  // freshly-generated plaintext (we never store it); on retries without a new
  // code we treat delivery as already handled by the original run.
  if (plaintext) {
    const channels = reservation.userId
      ? await loadMemberChannels(reservation.userId)
      : null;
    const outcome = await dispatchAccessCode({
      userId: reservation.userId ?? null,
      reservationId,
      name: reservation.contactName,
      code: plaintext,
      startsAt: reservation.startsAt,
      email: reservation.contactEmail,
      phone: reservation.contactPhone ?? channels?.phone ?? null,
      notifyByWhatsapp: channels?.notifyByWhatsapp ?? true,
      notifyBySms: channels?.notifyBySms ?? false,
    });

    if (outcome.anyDelivered) {
      await markStepSucceeded(reservationId, "code_delivered");
    } else {
      await markStepFailed(
        reservationId,
        "code_delivered",
        "No channel delivered the access code",
      );
    }
  }
}
