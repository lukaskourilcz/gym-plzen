import { and, desc, gte, lt, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { entryLog, accessCode, reservation } from "@/lib/db/schema";
import type { EntryLog } from "@/lib/db/types";
import { fetchLog, type NukiLogEntry } from "@/lib/integrations/nuki";
import {
  isSuccessfulKeypadUse,
  isFailedKeypadUse,
} from "@/lib/helpers/nuki-usage";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/helpers/logger";

/**
 * Entry-log service : mirrors the Nuki lock activity feed into `entry_log` so
 * the admin's "kniha vstupů" shows who actually unlocked and when. Nuki numeric
 * codes for action/trigger are mapped to readable labels.
 */

// Nuki API numeric enums (subset we care about).
const ACTIONS: Record<number, string> = {
  1: "unlock",
  2: "lock",
  3: "unlatch",
  4: "lock_n_go",
};
const TRIGGERS: Record<number, string> = {
  0: "system",
  1: "manual",
  2: "button",
  3: "automatic",
  4: "web",
  5: "app",
  6: "auto_lock",
  7: "accessory",
  255: "keypad",
};

/** Pull the latest lock log entries and upsert new ones (idempotent by nukiLogId). */
export async function syncEntryLog(limit = 50): Promise<{ inserted: number }> {
  const entries = await fetchLog(limit);
  if (entries.length === 0) return { inserted: 0 };

  const ids = entries
    .filter(
      (e) => (isSuccessfulKeypadUse(e) || isFailedKeypadUse(e)) && e.authId,
    )
    .map((e) => e.authId!);
  const linked = ids.length
    ? await db
        .select({
          codeId: accessCode.id,
          authId: accessCode.nukiAuthId,
          reservationId: accessCode.reservationId,
          userId: reservation.userId,
        })
        .from(accessCode)
        .innerJoin(reservation, eq(reservation.id, accessCode.reservationId))
        .where(inArray(accessCode.nukiAuthId, ids))
    : [];
  const rows = entries.map((e) => {
    const match =
      isSuccessfulKeypadUse(e) || isFailedKeypadUse(e)
        ? linked.find((c) => c.authId === e.authId)
        : undefined;
    return {
      ...mapEntry(e),
      ...(isFailedKeypadUse(e)
        ? { action: `keypad_failure_${e.state}`, trigger: "keypad" }
        : {}),
      accessCodeId: match?.codeId ?? null,
      reservationId: match?.reservationId ?? null,
      userId: match?.userId ?? null,
    };
  });
  const result = await db
    .insert(entryLog)
    .values(rows)
    .onConflictDoNothing({ target: entryLog.nukiLogId })
    .returning({ id: entryLog.id });

  logger.info("Entry log synced", {
    fetched: entries.length,
    inserted: result.length,
  });
  return { inserted: result.length };
}

function mapEntry(e: NukiLogEntry) {
  return {
    nukiLogId: e.id,
    nukiName: e.name ?? null,
    action:
      e.action != null ? (ACTIONS[e.action] ?? `action_${e.action}`) : null,
    trigger:
      e.trigger != null
        ? (TRIGGERS[e.trigger] ?? `trigger_${e.trigger}`)
        : null,
    occurredAt: new Date(e.date),
  };
}

/** Recent entries for the admin "kniha vstupů". */
export async function listRecentEntries(limit = 100): Promise<EntryLog[]> {
  return db
    .select()
    .from(entryLog)
    .orderBy(desc(entryLog.occurredAt))
    .limit(limit);
}

/**
 * Today's lock activity for the admin dashboard.
 *
 * The Nuki log records unlocks, not departures, so this answers "who came in
 * and when" and never "who is inside right now".
 */
export async function listEntriesForDay(bounds: {
  start: Date;
  end: Date;
}): Promise<EntryLog[]> {
  return db
    .select()
    .from(entryLog)
    .where(
      and(
        gte(entryLog.occurredAt, bounds.start),
        lt(entryLog.occurredAt, bounds.end),
      ),
    )
    .orderBy(desc(entryLog.occurredAt));
}
