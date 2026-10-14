import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  participantAddition,
  payment,
  reservation,
  systemAlert,
} from "@/lib/db/schema";
import type { ParticipantAddition, Payment, Reservation } from "@/lib/db/types";
import { env, publicEnv } from "@/lib/env";
import { ActionError } from "@/lib/helpers/action";
import {
  participantAdditionPrice,
  assertExtraPeople,
} from "@/lib/config/participants";
import { getParticipantPricing } from "./block-pricing";
import { withReservationLock } from "./operation-lock";
import { getOperations } from "./operations";
import {
  createComgatePayment,
  getComgatePayment,
  isComgateConfigured,
} from "@/lib/integrations/comgate";
import { nextPaymentStatus, paymentMatches } from "@/lib/helpers/payment-state";
import { splitFullName } from "@/lib/helpers/profile";
import { processWebhookEvent } from "./webhooks";
import { recordIn } from "./activity";
import { formatMoney } from "@/lib/helpers/format";
import { synchronizeComgatePayment } from "./payments";

export type ParticipantOutcome =
  | { kind: "confirmed" | "processing"; additionId: string }
  | { kind: "checkout"; additionId: string; url: string };
function eligible(booking: Reservation, userId: string): boolean {
  return (
    booking.userId === userId &&
    booking.status === "confirmed" &&
    booking.startsAt > new Date() &&
    !booking.rescheduleStartsAt
  );
}
/** Account ownership is required even when a reservation has guest contact data. */
export async function getParticipantBooking(userId: string, id: string) {
  const [booking] = await db
    .select()
    .from(reservation)
    .where(and(eq(reservation.id, id), eq(reservation.userId, userId)));
  return booking ?? null;
}
export async function listParticipantAdditions(
  userId: string,
  id: string,
): Promise<ParticipantAddition[]> {
  return db
    .select()
    .from(participantAddition)
    .where(
      and(
        eq(participantAddition.reservationId, id),
        eq(participantAddition.userId, userId),
      ),
    )
    .orderBy(desc(participantAddition.createdAt));
}
/** Authenticated return/refresh; never query arbitrary provider IDs from the URL. */
export async function refreshParticipantAddition(
  userId: string,
  reservationId: string,
): Promise<void> {
  const [attempt] = await db
    .select({ providerId: payment.providerPaymentId })
    .from(payment)
    .innerJoin(
      participantAddition,
      eq(payment.participantAdditionId, participantAddition.id),
    )
    .where(
      and(
        eq(participantAddition.userId, userId),
        eq(participantAddition.reservationId, reservationId),
        eq(participantAddition.status, "pending"),
        inArray(payment.status, ["pending", "processing"]),
      ),
    );
  if (attempt?.providerId) await synchronizeComgatePayment(attempt.providerId);
}

/** Persist intent before contacting the gateway, serialising double submits. */
export async function addParticipants(params: {
  userId: string;
  reservationId: string;
  toCount: number;
  quotedCents: number;
}): Promise<ParticipantOutcome> {
  assertExtraPeople(params.toCount);
  return withReservationLock(params.reservationId, async () => {
    const pricing = await getParticipantPricing();
    const operations = await getOperations();
    const intent = await db.transaction(async (tx) => {
      const [booking] = await tx
        .select()
        .from(reservation)
        .where(
          and(
            eq(reservation.id, params.reservationId),
            eq(reservation.userId, params.userId),
          ),
        )
        .for("update");
      if (!booking || !eligible(booking, params.userId))
        throw new ActionError(
          "Doprovod lze přidat pouze k vlastní budoucí potvrzené rezervaci bez probíhající změny termínu.",
        );
      const [existing] = await tx
        .select()
        .from(participantAddition)
        .where(
          and(
            eq(participantAddition.reservationId, booking.id),
            eq(participantAddition.status, "pending"),
          ),
        );
      if (existing) {
        if (existing.toCount !== params.toCount)
          throw new ActionError(
            "Nejdříve dokončete rozpracovanou platbu za doprovod.",
          );
        const [attempt] = await tx
          .select()
          .from(payment)
          .where(eq(payment.participantAdditionId, existing.id));
        if (!attempt) throw new Error("Participant payment intent missing");
        return { booking, addition: existing, attempt, fresh: false };
      }
      if (params.toCount <= booking.extraPeople)
        throw new ActionError(
          "Tento počet lidí už je v rezervaci uvedený. Obnovte stránku.",
        );
      const amountCents = participantAdditionPrice(
        booking.extraPeople,
        params.toCount,
        pricing,
      );
      if (amountCents !== params.quotedCents)
        throw new ActionError(
          "Příplatek se změnil. Obnovte stránku a potvrďte aktuální cenu.",
        );
      if (
        amountCents > 0 &&
        (!operations.paymentsEnabled || !isComgateConfigured())
      )
        throw new ActionError(
          "Online platby teď nejsou dostupné. Zkuste to prosím později.",
        );
      const [addition] = await tx
        .insert(participantAddition)
        .values({
          reservationId: booking.id,
          userId: params.userId,
          fromCount: booking.extraPeople,
          toCount: params.toCount,
          amountCents,
          pricingMode: pricing.mode,
          status: amountCents === 0 ? "confirmed" : "pending",
        })
        .returning();
      if (!addition) throw new Error("Participant addition missing");
      if (amountCents === 0) {
        await tx
          .update(reservation)
          .set({ extraPeople: params.toCount, updatedAt: new Date() })
          .where(eq(reservation.id, booking.id));
        await recordIn(tx, {
          action: "reservation.participants_added",
          actorType: "customer",
          actorId: params.userId,
          memberId: params.userId,
          reservationId: booking.id,
          summary: `Doprovod změněn na +${params.toCount}, bez dalšího doplatku.`,
          context: { additionId: addition.id },
        });
        return { booking, addition, attempt: null, fresh: true };
      }
      const [attempt] = await tx
        .insert(payment)
        .values({
          participantAdditionId: addition.id,
          userId: params.userId,
          type: "one_off",
          status: "processing",
          amountCents,
          currency: "czk",
          provider: "comgate",
          providerMerchantId: env.COMGATE_MERCHANT_ID,
          providerEnvironment: env.COMGATE_TEST_MODE,
          failureReason: "creation_pending",
        })
        .returning();
      if (!attempt) throw new Error("Participant payment missing");
      return { booking, addition, attempt, fresh: true };
    });
    const { booking, addition, attempt } = intent;
    if (!attempt) return { kind: "confirmed", additionId: addition.id };
    if (!intent.fresh)
      return attempt.gatewayUrl
        ? { kind: "checkout", url: attempt.gatewayUrl, additionId: addition.id }
        : { kind: "processing", additionId: addition.id };
    const outcome = await createComgatePayment({
      orderNumber: attempt.id,
      amountMinor: addition.amountCents,
      payer: {
        email: booking.contactEmail ?? "",
        ...splitFullName(booking.contactName ?? ""),
        ...(booking.contactPhone ? { phone: booking.contactPhone } : {}),
      },
      description: `Doprovod +${addition.toCount} | NAVI Private Gym`,
      returnUrl: `${publicEnv.NEXT_PUBLIC_APP_URL}/account/rezervace/${booking.id}/osoby?addition_id=${addition.id}`,
    });
    if (!outcome.created) {
      await db.transaction(async (tx) => {
        await tx
          .update(payment)
          .set({
            status: outcome.ambiguous ? "processing" : "failed",
            failureReason: outcome.ambiguous
              ? "creation_unknown"
              : outcome.error,
            lastCheckedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(payment.id, attempt.id));
        if (!outcome.ambiguous)
          await tx
            .update(participantAddition)
            .set({ status: "failed", updatedAt: new Date() })
            .where(eq(participantAddition.id, addition.id));
        else
          await tx
            .insert(systemAlert)
            .values({
              severity: "critical",
              dedupeKey: `payment-unknown:${attempt.id}`,
              title: "Výsledek platby za doprovod není známý",
              body: "Ověřte pokus v Comgate podle reference. Další platbu automaticky nezakládáme.",
              context: {
                paymentId: attempt.id,
                participantAdditionId: addition.id,
                reservationId: booking.id,
              },
            });
      });
      if (outcome.ambiguous)
        return { kind: "processing", additionId: addition.id };
      throw new ActionError(
        "Platbu za doprovod se nepodařilo zahájit. Původní rezervace zůstává platná.",
      );
    }
    await db
      .update(payment)
      .set({
        providerPaymentId: outcome.payment.id,
        gatewayUrl: outcome.payment.gwUrl,
        status: "pending",
        failureReason: null,
        lastCheckedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(payment.id, attempt.id));
    return {
      kind: "checkout",
      additionId: addition.id,
      url: outcome.payment.gwUrl!,
    };
  });
}

/** Supplemental settlement never calls fulfillment, code delivery or e-mail. */
export async function synchronizeParticipantPayment(
  known: Payment,
  providerId: string,
): Promise<boolean> {
  const [addition] = await db
    .select()
    .from(participantAddition)
    .where(eq(participantAddition.id, known.participantAdditionId!));
  if (!addition) return false;
  return withReservationLock(addition.reservationId, async () => {
    const outcome = await getComgatePayment(providerId);
    if (!outcome.found) throw new Error("Payment status unavailable");
    const snapshot = outcome.payment;
    if (!paymentMatches(known, snapshot))
      throw new Error("Payment identity or amount mismatch");
    await processWebhookEvent(
      {
        provider: "comgate",
        eventId: `${snapshot.id}:${snapshot.state}`,
        payload: { paymentId: known.id, state: snapshot.state },
      },
      async (tx) => {
        const [current] = await tx
          .select()
          .from(payment)
          .where(eq(payment.id, known.id))
          .for("update");
        const [intent] = await tx
          .select()
          .from(participantAddition)
          .where(eq(participantAddition.id, addition.id))
          .for("update");
        const [booking] = await tx
          .select()
          .from(reservation)
          .where(eq(reservation.id, addition.reservationId))
          .for("update");
        if (
          !current ||
          !intent ||
          !booking ||
          !paymentMatches(current, snapshot) ||
          current.participantAdditionId !== intent.id
        )
          throw new Error("Participant payment binding changed");
        const status = nextPaymentStatus(current.status, snapshot.state);
        await tx
          .update(payment)
          .set({
            status,
            paidAt:
              status === "succeeded"
                ? (current.paidAt ?? new Date())
                : current.paidAt,
            failureReason: status === "failed" ? snapshot.state : null,
            lastCheckedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(payment.id, current.id));
        if (status === "succeeded" && intent.status === "pending") {
          if (
            eligible(booking, intent.userId) &&
            booking.extraPeople === intent.fromCount
          ) {
            await tx
              .update(reservation)
              .set({
                extraPeople: intent.toCount,
                additionalPeoplePaidCents: sql`${reservation.additionalPeoplePaidCents} + ${intent.amountCents}`,
                updatedAt: new Date(),
              })
              .where(eq(reservation.id, booking.id));
            await tx
              .update(participantAddition)
              .set({ status: "confirmed", updatedAt: new Date() })
              .where(eq(participantAddition.id, intent.id));
            await recordIn(tx, {
              action: "reservation.participants_added",
              actorType: "system",
              actorLabel: "Comgate",
              memberId: intent.userId,
              reservationId: booking.id,
              summary: `Doprovod +${intent.toCount} potvrzen, doplatek ${formatMoney(intent.amountCents)} přijat.`,
              context: { additionId: intent.id, paymentId: current.id },
            });
          } else {
            await tx
              .update(participantAddition)
              .set({ status: "review_needed", updatedAt: new Date() })
              .where(eq(participantAddition.id, intent.id));
            await tx
              .insert(systemAlert)
              .values({
                severity: "critical",
                dedupeKey: `late-participant-payment:${current.id}`,
                title: "Doplatek za doprovod vyžaduje kontrolu",
                body: "Rezervace se mezitím změnila nebo už začala. Osoby jsme nepřidali. Ověřte vrácení doplatku.",
                context: {
                  paymentId: current.id,
                  participantAdditionId: intent.id,
                  reservationId: booking.id,
                },
              });
          }
        } else if (status === "failed" && intent.status === "pending") {
          await tx
            .update(participantAddition)
            .set({ status: "failed", updatedAt: new Date() })
            .where(eq(participantAddition.id, intent.id));
        }
      },
    );
    await db
      .update(payment)
      .set({ lastCheckedAt: new Date() })
      .where(eq(payment.id, known.id));
    return true;
  });
}
