import {
  assertNoOpenChange,
  assertNoPendingCompanions,
} from "./reservation-finance-guard";
import { issueAccessCode } from "./access-codes";
import { isAccessCodePreparationDue } from "@/lib/config/access-code-delivery";
import { fulfillReservation } from "./fulfillment";
import { and, asc, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  blockedSlot,
  payment,
  reservation,
  reservationChange,
} from "@/lib/db/schema";
import type { Payment } from "@/lib/db/types";
import {
  CREDIT_TERMS_VERSION,
  changedReservationPrice,
} from "@/lib/config/credits";
import { PAYMENT_SESSION_MINUTES } from "@/lib/config/checkout";
import { ActionError } from "@/lib/helpers/action";
import { formatDateTime } from "@/lib/helpers/format";
import { splitFullName } from "@/lib/helpers/profile";
import { paymentMatches } from "@/lib/helpers/payment-state";
import { env, publicEnv } from "@/lib/env";
import {
  createComgatePayment,
  getComgatePayment,
  isComgateConfigured,
  refundComgatePayment,
} from "@/lib/integrations/comgate";
import { checkAvailability, lockSchedule } from "./availability";
import { reserveCreditIn, finishCreditIn } from "./credits";
import { getEntryPriceCents } from "./loyalty";
import { getOperations } from "./operations";
import { resolveOrderSlots } from "./orders";
import { withReservationLock } from "./operation-lock";
import {
  getRescheduleEligibility,
  rescheduleReasonMessage,
  hasReservationBeenRescheduled,
  rescheduleReservation,
  abortPendingReschedule,
} from "./rescheduling";
import { raiseAlert } from "./alerts";

export async function quoteReschedule(
  userId: string,
  reservationId: string,
  startsAt: Date,
) {
  const [current] = await db
    .select()
    .from(reservation)
    .where(
      and(eq(reservation.id, reservationId), eq(reservation.userId, userId)),
    );
  if (!current) throw new ActionError("Rezervaci se nepodařilo najít.");
  await assertNoPendingCompanions(reservationId);
  const requestedAt = new Date();
  const eligibility = getRescheduleEligibility(
    current,
    await hasReservationBeenRescheduled(reservationId, userId),
    requestedAt,
  );
  if (!eligibility.eligible)
    throw new ActionError(rescheduleReasonMessage(eligibility.reason));
  const [target] = await resolveOrderSlots([startsAt]);
  if (!target || current.startsAt.getTime() === startsAt.getTime())
    throw new ActionError("Vyberte jiný budoucí termín.");
  if (current.pricingVersion >= 2 && !current.priceSnapshot)
    throw new ActionError("Cenu rezervace musí ověřit obsluha.");
  const oldPrice = current.priceCents ?? 0;
  const newPrice =
    current.pricingVersion < 2
      ? oldPrice
      : changedReservationPrice(
          await getEntryPriceCents(startsAt),
          current.priceSnapshot!,
        );
  return {
    current,
    target,
    requestedAt,
    oldPriceCents: oldPrice,
    newPriceCents: newPrice,
    differenceCents: newPrice - oldPrice,
    legacy: current.pricingVersion < 2,
  };
}
export type ChangeOutcome =
  | { kind: "completed" | "processing"; changeId: string }
  | { kind: "checkout"; changeId: string; url: string };

export async function startPricedReschedule(input: {
  id: string;
  userId: string;
  reservationId: string;
  startsAt: Date;
  quotedCents: number;
  useCredits: boolean;
  quotedCreditCents?: number;
}): Promise<ChangeOutcome> {
  return withReservationLock(input.reservationId, async () => {
    const [existing] = await db
      .select()
      .from(reservationChange)
      .where(eq(reservationChange.id, input.id));
    if (existing) {
      if (
        existing.userId !== input.userId ||
        existing.reservationId !== input.reservationId ||
        existing.startsAt.getTime() !== input.startsAt.getTime() ||
        existing.newPriceCents !== input.quotedCents
      )
        throw new ActionError("Požadavek změny není platný.");
      return outcomeFor(existing.id);
    }
    await assertNoOpenChange(input.reservationId);
    const quote = await quoteReschedule(
      input.userId,
      input.reservationId,
      input.startsAt,
    );
    if (quote.newPriceCents !== input.quotedCents)
      throw new ActionError(
        "Cena termínu se změnila. Vyberte ho znovu a potvrďte aktuální cenu.",
      );
    if (quote.legacy) {
      await rescheduleReservation({
        reservationId: input.reservationId,
        userId: input.userId,
        startsAt: input.startsAt,
      });
      return { kind: "completed", changeId: input.id };
    }
    const expiresAt = new Date(
      Math.min(
        Date.now() + PAYMENT_SESSION_MINUTES * 60000,
        input.startsAt.getTime(),
      ),
    );
    const change = await db.transaction(async (tx) => {
      await lockSchedule(tx, "exclusive");
      const [locked] = await tx
        .select()
        .from(reservation)
        .where(eq(reservation.id, input.reservationId))
        .for("update");
      if (
        !locked ||
        locked.status !== "confirmed" ||
        locked.startsAt.getTime() !== quote.current.startsAt.getTime() ||
        locked.priceCents !== quote.oldPriceCents ||
        locked.rescheduleStartsAt
      )
        throw new ActionError("Rezervace se mezitím změnila. Obnovte stránku.");
      const available = await checkAvailability(
        quote.target.startsAt,
        quote.target.endsAt,
        { excludeReservationId: locked.id },
        tx,
      );
      if (!available.available)
        throw new ActionError(
          "Tento termín už není dostupný. Vyberte prosím jiný čas.",
        );
      const difference = Math.max(0, quote.differenceCents);
      const creditCents = await reserveCreditIn(
        tx,
        input.userId,
        `change:${input.id}`,
        difference,
        input.useCredits,
      );
      if (
        input.quotedCreditCents !== undefined &&
        creditCents !== input.quotedCreditCents
      )
        throw new ActionError(
          "Dostupný kredit se změnil. Obnovte stránku a potvrďte nový doplatek.",
        );
      const cashCents = difference - creditCents;
      if (
        cashCents &&
        (!(await getOperations()).paymentsEnabled || !isComgateConfigured())
      )
        throw new ActionError("Online doplatek momentálně není dostupný.");
      if (cashCents > 0 && cashCents < 100)
        throw new ActionError(
          "Doplatek menší než 1 Kč nelze uhradit bránou. Použijte kredit nebo kontaktujte obsluhu.",
        );
      const [block] = await tx
        .insert(blockedSlot)
        .values({
          startsAt: quote.target.startsAt,
          endsAt: quote.target.endsAt,
          note: "Dočasně drženo při změně rezervace",
          reason: "other",
        })
        .returning();
      const [created] = await tx
        .insert(reservationChange)
        .values({
          id: input.id,
          reservationId: locked.id,
          userId: input.userId,
          startsAt: quote.target.startsAt,
          endsAt: quote.target.endsAt,
          previousStartsAt: locked.startsAt,
          previousPriceCents: quote.oldPriceCents,
          newPriceCents: quote.newPriceCents,
          creditCents,
          cashCents,
          status: cashCents ? "awaiting_payment" : "applying",
          blockId: block!.id,
          expiresAt,
          createdAt: quote.requestedAt,
          quote: {
            pricingVersion: locked.pricingVersion,
            termsVersion: CREDIT_TERMS_VERSION,
          },
        })
        .returning();
      return created!;
    });
    if (!change.cashCents) {
      await applyPaidChange(change.id);
      return outcomeFor(change.id);
    }
    const [attempt] = await db
      .insert(payment)
      .values({
        reservationChangeId: change.id,
        userId: input.userId,
        type: "one_off",
        status: "processing",
        amountCents: change.cashCents,
        currency: "czk",
        provider: "comgate",
        providerMerchantId: env.COMGATE_MERCHANT_ID,
        providerEnvironment: env.COMGATE_TEST_MODE,
        failureReason: "creation_pending",
      })
      .returning();
    const result = await createComgatePayment({
      orderNumber: attempt!.id,
      amountMinor: change.cashCents,
      payer: {
        email: quote.current.contactEmail ?? "",
        ...splitFullName(quote.current.contactName ?? ""),
        phone: quote.current.contactPhone ?? undefined,
      },
      description: "Doplatek změny termínu | NAVI Private Gym",
      returnUrl: `${publicEnv.NEXT_PUBLIC_APP_URL}/account/rezervace/${input.reservationId}/zmenit?change_id=${change.id}`,
    });
    if (!result.created) {
      await db
        .update(payment)
        .set({
          status: result.ambiguous ? "processing" : "failed",
          failureReason: result.ambiguous ? "creation_unknown" : result.error,
          updatedAt: new Date(),
        })
        .where(eq(payment.id, attempt!.id));
      if (!result.ambiguous) await cancelChange(change.id);
      else
        await changeAlert(
          change.id,
          "Výsledek založení doplatku není známý",
          "Původní rezervace zůstává platná. Nový čas a kredity držíme; ověřte platbu v Comgate podle reference před dalším pokusem.",
        );
      if (!result.ambiguous)
        throw new ActionError(
          "Doplatek se nepodařilo zahájit. Původní rezervace zůstává platná.",
        );
      return { kind: "processing", changeId: change.id };
    }
    await db
      .update(payment)
      .set({
        status: "pending",
        providerPaymentId: result.payment.id,
        gatewayUrl: result.payment.gwUrl,
        failureReason: null,
        lastCheckedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(payment.id, attempt!.id));
    return {
      kind: "checkout",
      changeId: change.id,
      url: result.payment.gwUrl!,
    };
  });
}
async function outcomeFor(id: string): Promise<ChangeOutcome> {
  const [change] = await db
    .select()
    .from(reservationChange)
    .where(eq(reservationChange.id, id));
  if (change?.status === "completed")
    return { kind: "completed", changeId: id };
  const [attempt] = await db
    .select()
    .from(payment)
    .where(eq(payment.reservationChangeId, id));
  if (
    change?.status === "awaiting_payment" &&
    attempt?.gatewayUrl &&
    attempt.status === "pending"
  )
    return { kind: "checkout", changeId: id, url: attempt.gatewayUrl };
  return { kind: "processing", changeId: id };
}
async function changeAlert(id: string, title: string, body: string) {
  const [change] = await db
    .select()
    .from(reservationChange)
    .where(eq(reservationChange.id, id));
  await raiseAlert({
    severity: "critical",
    dedupeKey: `reservation-change:${id}`,
    title,
    body,
    context: { reservationId: change?.reservationId, changeId: id },
  });
}
async function cancelChange(id: string) {
  await db.transaction(async (tx) => {
    await lockSchedule(tx, "exclusive");
    const [change] = await tx
      .select()
      .from(reservationChange)
      .where(eq(reservationChange.id, id))
      .for("update");
    if (!change || change.status !== "awaiting_payment") return;
    await finishCreditIn(tx, `change:${id}`, false);
    await tx
      .update(reservationChange)
      .set({ status: "cancelled", blockId: null, updatedAt: new Date() })
      .where(eq(reservationChange.id, id));
    if (change.blockId)
      await tx.delete(blockedSlot).where(eq(blockedSlot.id, change.blockId));
  });
}
export async function applyPaidChange(id: string) {
  const [known] = await db
    .select()
    .from(reservationChange)
    .where(eq(reservationChange.id, id));
  if (!known) return;
  return withReservationLock(known.reservationId, async () => {
    const [change] = await db
      .select()
      .from(reservationChange)
      .where(eq(reservationChange.id, id));
    if (!change || change.status !== "applying") return;
    if (change.expiresAt <= new Date()) {
      await db
        .update(reservationChange)
        .set({
          status: "review_needed",
          error:
            "Platnost nabídky vypršela před dokončením změny. Původní rezervace se nepřesouvá; doplatek bude vrácen.",
          updatedAt: new Date(),
        })
        .where(eq(reservationChange.id, id));
      return;
    }
    try {
      await rescheduleReservation({
        reservationId: change.reservationId,
        userId: change.userId,
        startsAt: change.startsAt,
        financialChangeId: id,
      });
    } catch (error) {
      await db
        .update(reservationChange)
        .set({
          status: "review_needed",
          error:
            error instanceof ActionError
              ? error.message
              : "Změnu se nepodařilo bezpečně dokončit.",
          updatedAt: new Date(),
        })
        .where(eq(reservationChange.id, id));
      await changeAlert(
        id,
        "Zaplacená změna termínu vyžaduje kontrolu",
        `Rezervace ${formatDateTime(change.previousStartsAt)} se nepřesunula. Ověřte původní vstupní kód a vrácení doplatku. Nový čas zůstává chráněný do bezpečného vyřešení.`,
      );
    }
  });
}
export async function synchronizeChangePayment(
  known: Payment,
  providerId: string,
) {
  if (known.status === "refunded") return true;
  const [change] = await db
    .select()
    .from(reservationChange)
    .where(eq(reservationChange.id, known.reservationChangeId!));
  if (!change) return false;
  return withReservationLock(change.reservationId, async () => {
    const result = await getComgatePayment(providerId);
    if (!result.found || !paymentMatches(known, result.payment))
      throw new Error("Doplatek se nepodařilo ověřit.");
    const state = result.payment.state;
    if (state === "PAID") {
      await db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(payment)
          .where(eq(payment.id, known.id))
          .for("update");
        if (!current || !paymentMatches(current, result.payment))
          throw new Error("Vazba doplatku se změnila.");
        await tx
          .update(payment)
          .set({
            status: "succeeded",
            paidAt: current.paidAt ?? new Date(),
            lastCheckedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(payment.id, current.id));
        const [intent] = await tx
          .select()
          .from(reservationChange)
          .where(eq(reservationChange.id, change.id))
          .for("update");
        if (intent?.status === "awaiting_payment")
          await tx
            .update(reservationChange)
            .set({
              status:
                change.expiresAt > new Date() ? "applying" : "review_needed",
              error:
                change.expiresAt > new Date()
                  ? null
                  : "Doplatek dorazil po vypršení nabídky; ověřte vrácení platby.",
              updatedAt: new Date(),
            })
            .where(eq(reservationChange.id, change.id));
      });
      await applyPaidChange(change.id);
      const [after] = await db
        .select()
        .from(reservationChange)
        .where(eq(reservationChange.id, change.id));
      if (after?.status === "review_needed")
        await changeAlert(
          change.id,
          "Doplatek změny vyžaduje vrácení nebo ověření",
          "Platba je přijatá, ale změna není dokončená. Původní rezervaci nerušte. Ověřte přístup a nápravu v detailu změny.",
        );
    } else if (state === "CANCELLED") {
      // A later CANCELLED notification must never undo a paid change.
      if (
        !["succeeded", "refunded"].includes(
          (await db.select().from(payment).where(eq(payment.id, known.id)))[0]!
            .status,
        )
      ) {
        await db
          .update(payment)
          .set({
            status: "failed",
            failureReason: "CANCELLED",
            lastCheckedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(payment.id, known.id));
        await cancelChange(change.id);
      }
    } else
      await db
        .update(payment)
        .set({ lastCheckedAt: new Date() })
        .where(eq(payment.id, known.id));
    return true;
  });
}
export async function retryPaidChanges(limit = 10) {
  const changes = await db
    .select()
    .from(reservationChange)
    .where(eq(reservationChange.status, "applying"))
    .orderBy(asc(reservationChange.updatedAt))
    .limit(limit);
  for (const change of changes) await applyPaidChange(change.id);
  const abandoned = await db
    .select()
    .from(reservationChange)
    .where(
      and(
        eq(reservationChange.status, "awaiting_payment"),
        lt(reservationChange.expiresAt, new Date()),
      ),
    )
    .limit(limit);
  for (const change of abandoned)
    await withReservationLock(change.reservationId, async () => {
      const [attempt] = await db
        .select()
        .from(payment)
        .where(eq(payment.reservationChangeId, change.id));
      if (!attempt) await cancelChange(change.id);
    });
  const failed = await db
    .select()
    .from(reservationChange)
    .where(
      inArray(reservationChange.status, ["review_needed", "refund_pending"]),
    )
    .orderBy(asc(reservationChange.updatedAt))
    .limit(limit);
  for (const change of failed) await recoverFailedChange(change.id);
  return changes.length;
}
export async function ownReservationChange(
  userId: string,
  reservationId: string,
) {
  const [change] = await db
    .select()
    .from(reservationChange)
    .where(
      and(
        eq(reservationChange.userId, userId),
        eq(reservationChange.reservationId, reservationId),
        inArray(reservationChange.status, [
          "awaiting_payment",
          "applying",
          "review_needed",
          "refund_pending",
        ]),
      ),
    )
    .orderBy(asc(reservationChange.createdAt))
    .limit(1);
  return change ?? null;
}

/** Prove target codes absent and original access restored before releasing holds. */
export async function recoverFailedChange(id: string) {
  const [known] = await db
    .select()
    .from(reservationChange)
    .where(eq(reservationChange.id, id));
  if (!known) return;
  return withReservationLock(known.reservationId, async () => {
    const [change] = await db
      .select()
      .from(reservationChange)
      .where(eq(reservationChange.id, id));
    if (!change || !["review_needed", "refund_pending"].includes(change.status))
      return;
    if (change.status === "review_needed") {
      if (!(await abortPendingReschedule(change.reservationId))) return;
      const [original] = await db
        .select()
        .from(reservation)
        .where(eq(reservation.id, change.reservationId));
      if (
        !original ||
        !["confirmed", "completed", "no_show"].includes(original.status) ||
        original.startsAt.getTime() !== change.previousStartsAt.getTime()
      )
        return;
      if (
        original.status === "confirmed" &&
        original.endsAt > new Date() &&
        (await getOperations()).accessCodesEnabled &&
        isAccessCodePreparationDue(original.startsAt)
      ) {
        const code = await issueAccessCode({
          reservationId: original.id,
          startsAt: original.startsAt,
          endsAt: original.endsAt,
        });
        if (!code.provisionedOnLock) return;
        await fulfillReservation(original.id);
      }
      await db.transaction(async (tx) => {
        await lockSchedule(tx, "exclusive");
        await finishCreditIn(tx, `change:${id}`, false);
        await tx
          .update(reservationChange)
          .set({
            status: change.cashCents ? "refund_pending" : "cancelled",
            blockId: null,
            updatedAt: new Date(),
          })
          .where(eq(reservationChange.id, id));
        if (change.blockId)
          await tx
            .delete(blockedSlot)
            .where(eq(blockedSlot.id, change.blockId));
      });
    }
    const [intent] = await db
      .select()
      .from(reservationChange)
      .where(eq(reservationChange.id, id));
    if (intent?.status !== "refund_pending" || intent.refundState !== "none")
      return;
    const [paid] = await db
      .select()
      .from(payment)
      .where(eq(payment.reservationChangeId, id));
    if (
      !paid?.providerPaymentId ||
      paid.status !== "succeeded" ||
      paid.providerMerchantId !== env.COMGATE_MERCHANT_ID ||
      paid.providerEnvironment !== env.COMGATE_TEST_MODE
    )
      return;
    // Persist before POST. Comgate refId is NOT unique: an uncertain POST is
    // never retried automatically, even after a crash before storing response.
    await db
      .update(reservationChange)
      .set({ refundState: "submitting", updatedAt: new Date() })
      .where(eq(reservationChange.id, id));
    let result;
    try {
      result = await refundComgatePayment(
        paid.providerPaymentId,
        paid.amountCents,
        id,
      );
    } catch {
      result = { accepted: false, ambiguous: true };
    }
    await db
      .update(reservationChange)
      .set({
        refundState: result.accepted
          ? "requested"
          : result.ambiguous
            ? "unknown"
            : "rejected",
        updatedAt: new Date(),
      })
      .where(eq(reservationChange.id, id));
    await changeAlert(
      id,
      result.accepted
        ? "Vrácení doplatku bylo předáno Comgate"
        : "Vrácení doplatku vyžaduje ověření",
      result.accepted
        ? "Původní rezervace je zachovaná a kredity jsou uvolněné. Ověřte dokončení refundace v Comgate a potvrďte ji v Kreditech."
        : "Původní rezervace je zachovaná. Ověřte refundaci v Comgate podle reference; nejistý požadavek automaticky neopakujeme.",
    );
  });
}
