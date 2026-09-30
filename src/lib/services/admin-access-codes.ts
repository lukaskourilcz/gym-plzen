import { accessCodePage } from "./admin-lists";
import { readAdminFilters, type AdminFilters } from "@/lib/helpers/admin-list";
import "server-only";
import { desc, eq, inArray, sql, or, like } from "drizzle-orm";
import { assertAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { accessCode, reservation, entryLog } from "@/lib/db/schema";
import { readKeypadCodes, readKeypadUsageLog } from "@/lib/integrations/nuki";
import { hashCode } from "@/lib/helpers/crypto";

import {
  isSuccessfulKeypadUse,
  isFailedKeypadUse,
  keypadFailureReason,
} from "@/lib/helpers/nuki-usage";

export const ACCESS_CODE_PAGE_SIZE = 50;

/** Authorize before either database or Nuki access; never persist fetched PINs. */
export async function listAdminAccessCodes(
  page: number,
  filters: AdminFilters = readAdminFilters({}),
) {
  await assertAdmin();
  const records = await accessCodePage(page, filters);
  let nukiUnavailable = false;
  const pins = records.length
    ? await readKeypadCodes().catch(() => {
        nukiUnavailable = true;
        return [];
      })
    : [];
  let usageUnavailable = false;
  const visible = records.slice(0, ACCESS_CODE_PAGE_SIZE);
  const usage = await readKeypadUsageLog(
    new Date(
      Math.min(
        Date.now() - 30 * 86400000,
        ...visible.map((r) => r.code.createdAt.getTime()),
      ),
    ),
  ).catch(() => {
    usageUnavailable = true;
    return { entries: [], complete: false };
  });
  if (!usage.complete) usageUnavailable = true;
  const failedAuthIds = usage.entries
    .filter(isFailedKeypadUse)
    .flatMap((e) => (e.authId ? [e.authId] : []));
  const failedOwners = failedAuthIds.length
    ? await db
        .select({
          codeId: accessCode.id,
          nukiAuthId: accessCode.nukiAuthId,
          reservationId: accessCode.reservationId,
          userId: reservation.userId,
        })
        .from(accessCode)
        .innerJoin(reservation, eq(reservation.id, accessCode.reservationId))
        .where(inArray(accessCode.nukiAuthId, failedAuthIds))
    : [];
  const uses = usage.entries
    .filter((event) => isSuccessfulKeypadUse(event) || isFailedKeypadUse(event))
    .flatMap((event) => {
      const match = visible.find((r) => r.code.nukiAuthId === event.authId);
      const owner = failedOwners.find((r) => r.nukiAuthId === event.authId);
      return match || isFailedKeypadUse(event)
        ? [
            {
              nukiLogId: event.id,
              nukiName: event.name ?? null,
              accessCodeId: match?.code.id ?? owner?.codeId ?? null,
              reservationId:
                match?.reservationId ?? owner?.reservationId ?? null,
              userId: match?.userId ?? owner?.userId ?? null,
              action: isFailedKeypadUse(event)
                ? `keypad_failure_${event.state}`
                : "keypad_open",
              trigger: "keypad",
              occurredAt: new Date(event.date),
            },
          ]
        : [];
    });
  // Retain verified use even after Nuki removes an expired authorization or old logs.
  const uniqueUses = [
    ...new Map(uses.map((use) => [use.nukiLogId, use])).values(),
  ];
  if (uniqueUses.length)
    await db
      .insert(entryLog)
      .values(uniqueUses)
      .onConflictDoUpdate({
        target: entryLog.nukiLogId,
        set: {
          accessCodeId: sql`excluded.access_code_id`,
          reservationId: sql`excluded.reservation_id`,
          userId: sql`excluded.user_id`,
          action: sql`excluded.action`,
          trigger: sql`excluded.trigger`,
        },
      });
  const storedUses = await db
    .select({
      id: entryLog.id,
      action: entryLog.action,
      codeId: entryLog.accessCodeId,
      at: entryLog.occurredAt,
    })
    .from(entryLog)
    .where(
      or(
        inArray(
          entryLog.accessCodeId,
          visible.map((r) => r.code.id),
        ),
        like(entryLog.action, "keypad_failure_%"),
      ),
    )
    .orderBy(desc(entryLog.occurredAt));
  const failures = storedUses.filter((use) =>
    use.action?.startsWith("keypad_failure_"),
  );
  const failureDetail = (use: (typeof storedUses)[number]) => ({
    id: use.id,
    at: use.at.toISOString(),
    reason: keypadFailureReason(
      Number(use.action?.replace("keypad_failure_", "")),
    ),
  });
  const unassignedFailures = failures
    .filter((use) => !use.codeId)
    .map(failureDetail);
  const rows = records
    .slice(0, ACCESS_CODE_PAGE_SIZE)
    .map(({ code, ...row }) => {
      const auth = pins.find(
        (pin) =>
          pin.id === code.nukiAuthId && hashCode(pin.code) === code.codeHash,
      );
      return {
        ...row,
        id: code.id,
        status: code.status,
        validFrom: code.validFrom,
        validUntil: code.validUntil,
        createdAt: code.createdAt,
        pin: auth?.code ?? null,
        last2: code.codeLast2,
        usedAt: storedUses
          .filter(
            (use) =>
              use.codeId === code.id &&
              !use.action?.startsWith("keypad_failure_"),
          )
          .map((use) => use.at),
        failures: failures
          .filter((use) => use.codeId === code.id)
          .map(failureDetail),
      };
    });
  return {
    rows,
    unassignedFailures,
    nukiUnavailable,
    usageUnavailable,
    hasNext: records.length > ACCESS_CODE_PAGE_SIZE,
  };
}
