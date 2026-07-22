import { logger } from "@/lib/helpers/logger";
import { getReservation } from "./reservations";
import {
  issueAccessCode,
  listCodesForReservation,
  revokeAccessCode,
} from "./access-codes";
import { dispatchAccessCode, loadMemberChannels } from "./notifications";
import { getPipeline, markStepFailed, markStepSucceeded } from "./pipeline";

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
