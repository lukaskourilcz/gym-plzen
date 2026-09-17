import { desc, eq } from "drizzle-orm";
import { db, type DatabaseExecutor } from "@/lib/db";
import { activityLog } from "@/lib/db/schema";
import type { ActivityLog } from "@/lib/db/types";
import { logger } from "@/lib/helpers/logger";

/**
 * The activity log: one row per important thing that happened, written by
 * the service or action that made it happen, in the words an administrator
 * reads. A failed write must never undo the action it describes, so the
 * plain `record` swallows its own failure; inside a transaction use
 * `recordIn`, where the entry commits together with the change.
 */

export const ACTIVITY_ACTIONS = {
  "reservation.created": "Rezervace vytvořena",
  "reservation.confirmed": "Rezervace potvrzena",
  "reservation.cancelled": "Rezervace zrušena",
  "reservation.rescheduled": "Změna termínu",
  "payment.settled": "Platba přijata",
  "payment.cancelled": "Platba neproběhla",
  "blocked_slot.created": "Termíny uzavřeny",
  "blocked_slot.deleted": "Uzavření zrušeno",
  "voucher.created": "Voucher vytvořen",
  "voucher.activated": "Voucher aktivován",
  "voucher.deactivated": "Voucher deaktivován",
  "member.profile_updated": "Profil člena upraven",
  "member.role_changed": "Role člena změněna",
  "settings.operations_saved": "Provozní nastavení uloženo",
  "settings.price_saved": "Cena vstupu uložena",
  "settings.pricing_period_saved": "Cenové období uloženo",
  "settings.pricing_period_deleted": "Cenové období smazáno",
} as const;

export type ActivityAction = keyof typeof ACTIVITY_ACTIONS;

export const ACTOR_LABELS: Record<ActivityLog["actorType"], string> = {
  customer: "Zákazník",
  admin: "Správce",
  system: "Systém",
};

/** Czech title of an action key; an unknown key reads as itself. */
export function activityActionLabel(action: string): string {
  return (ACTIVITY_ACTIONS as Record<string, string>)[action] ?? action;
}

export interface ActivityEntry {
  action: ActivityAction;
  actorType: ActivityLog["actorType"];
  actorId?: string | null;
  actorLabel?: string | null;
  memberId?: string | null;
  reservationId?: string | null;
  summary: string;
  context?: Record<string, unknown>;
  occurredAt?: Date;
}

/** Write an entry as part of a transaction; it fails with the transaction. */
export async function recordIn(
  executor: DatabaseExecutor,
  entry: ActivityEntry,
): Promise<void> {
  await executor.insert(activityLog).values({
    action: entry.action,
    actorType: entry.actorType,
    actorId: entry.actorId ?? null,
    actorLabel: entry.actorLabel ?? null,
    memberId: entry.memberId ?? null,
    reservationId: entry.reservationId ?? null,
    summary: entry.summary,
    context: entry.context ?? null,
    occurredAt: entry.occurredAt ?? new Date(),
  });
}

/** Write an entry outside a transaction. Never throws: the log is a record of the action, not a condition of it. */
export async function record(entry: ActivityEntry): Promise<void> {
  try {
    await recordIn(db, entry);
  } catch (error) {
    logger.error(error, { where: "activity.record", action: entry.action });
  }
}

/** Newest entries first, for the administration's history page. */
export async function listRecent(limit = 200): Promise<ActivityLog[]> {
  return db
    .select()
    .from(activityLog)
    .orderBy(desc(activityLog.occurredAt), desc(activityLog.id))
    .limit(limit);
}

/** Everything that concerns one member, newest first. */
export async function listForMember(
  memberId: string,
  limit = 100,
): Promise<ActivityLog[]> {
  return db
    .select()
    .from(activityLog)
    .where(eq(activityLog.memberId, memberId))
    .orderBy(desc(activityLog.occurredAt), desc(activityLog.id))
    .limit(limit);
}

/** Everything that happened to one reservation, oldest first. */
export async function listForReservation(
  reservationId: string,
): Promise<ActivityLog[]> {
  return db
    .select()
    .from(activityLog)
    .where(eq(activityLog.reservationId, reservationId))
    .orderBy(activityLog.occurredAt, activityLog.id);
}
