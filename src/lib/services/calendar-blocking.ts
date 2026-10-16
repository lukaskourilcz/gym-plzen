import { createHash } from "node:crypto";
import { and, eq, gt, inArray, lt, or } from "drizzle-orm";
import { db, type DatabaseExecutor } from "@/lib/db";
import { readDatabase } from "@/lib/db/read";
import { blockApplication, blockedSlot, reservation } from "@/lib/db/schema";
import { ActionError } from "@/lib/helpers/action";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  dayOfWeek,
  localDateTimeToDate,
} from "@/lib/helpers/datetime";
import {
  calendarBlockRangeSchema,
  calendarBlockSelectionSchema,
  type CalendarBlockRange,
  type CalendarBlockSelection,
} from "@/lib/config/calendar-blocking";
import { buildDaySlots } from "./slots";
import { loadBlockingHours } from "./blocking";
import { lockSchedule, reservationOverlaps } from "./availability";
import { recordIn } from "./activity";

// This service writes only block batches and audit entries. Never fulfillment,
// closures or providers: even a racing customer reservation is left intact.
async function loadRange(
  executor: DatabaseExecutor,
  from: string,
  to: string,
  now: Date,
  selectedDates?: Set<string>,
) {
  const start = localDateTimeToDate(from, 0),
    end = localDateTimeToDate(to, 0);
  const [hours, reservations, blocks] = await Promise.all([
    loadBlockingHours(executor),
    executor
      .select()
      .from(reservation)
      .where(
        and(
          reservationOverlaps(start, end),
          or(
            inArray(reservation.status, ["pending", "confirmed"]),
            eq(reservation.accessRevocationPending, true),
          ),
        ),
      ),
    executor
      .select()
      .from(blockedSlot)
      .where(and(lt(blockedSlot.startsAt, end), gt(blockedSlot.endsAt, start))),
  ]);
  const busy = [...reservations, ...blocks].map((item) => ({
    start: item.startsAt,
    end: item.endsAt,
  }));
  for (const item of reservations)
    if (item.rescheduleStartsAt && item.rescheduleEndsAt)
      busy.push({ start: item.rescheduleStartsAt, end: item.rescheduleEndsAt });
  const windows = [];
  for (let date = from; date < to; date = addDaysToDateKey(date, 1)) {
    if (selectedDates && !selectedDates.has(date)) continue;
    const configured = hours.find(
      (row) => row.dayOfWeek === dayOfWeek(localDateTimeToDate(date, 720)),
    );
    if (!configured) continue;
    for (const slot of buildDaySlots(date, configured, busy, now)) {
      if (slot.available)
        windows.push({
          dateKey: date,
          startISO: slot.start.toISOString(),
          endISO: slot.end.toISOString(),
          label: `${slot.start.toLocaleTimeString("cs-CZ", { timeZone: "Europe/Prague", hour: "2-digit", minute: "2-digit" })}–${slot.end.toLocaleTimeString("cs-CZ", { timeZone: "Europe/Prague", hour: "2-digit", minute: "2-digit" })}`,
        });
    }
  }
  return {
    windows,
    scheduleFingerprint: createHash("sha256")
      .update(
        JSON.stringify(
          hours.map(
            ({
              dayOfWeek,
              openMinute,
              closeMinute,
              slotMinutes,
              isClosed,
            }) => ({
              dayOfWeek,
              openMinute,
              closeMinute,
              slotMinutes,
              isClosed,
            }),
          ),
        ),
      )
      .digest("hex"),
  };
}
export async function loadCalendarBlockChoices(
  raw: CalendarBlockRange,
  now = new Date(),
) {
  const { from, to } = calendarBlockRangeSchema.parse(raw);
  const today = dateKeyInTimeZone(now);
  if (from > `${Number(today.slice(0, 4)) + 2}-12-31`)
    throw new ActionError("Vyberte termíny nejvýše dva roky dopředu.");
  return readDatabase((tx) => loadRange(tx, from, to, now));
}
export async function saveCalendarBlockSelection(
  raw: CalendarBlockSelection,
  adminId: string | null,
  now = new Date(),
) {
  const input = calendarBlockSelectionSchema.parse(raw);
  const windows = [
    ...new Map(input.windows.map((w) => [w.startISO, w])).values(),
  ].sort((a, b) => a.startISO.localeCompare(b.startISO));
  if (windows.length !== input.windows.length)
    throw new ActionError("Výběr obsahuje duplicitní termín.");
  return db.transaction(async (tx) => {
    await lockSchedule(tx, "exclusive");
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          windows,
          scheduleFingerprint: input.scheduleFingerprint,
        }),
      )
      .digest("hex");
    const [existing] = await tx
      .select()
      .from(blockApplication)
      .where(eq(blockApplication.id, input.operationId));
    if (existing) {
      if (
        existing.fingerprint !== fingerprint ||
        existing.createdByAdminId !== adminId ||
        existing.snapshot.templates.length
      )
        throw new ActionError("Tato operace už patří jinému výběru.");
      return { id: existing.id, count: existing.snapshot.windows.length };
    }
    const today = dateKeyInTimeZone(now);
    const dates = [
      ...new Set(windows.map((w) => dateKeyInTimeZone(new Date(w.startISO)))),
    ].sort();
    if (
      dates.some(
        (date) =>
          date < today || date > `${Number(today.slice(0, 4)) + 2}-12-31`,
      )
    )
      throw new ActionError(
        "Vyberte dnešní nebo budoucí termíny, nejvýše dva roky dopředu.",
      );
    // One bounded bulk read under the lock, even for selections across weeks.
    const available = await loadRange(
      tx,
      dates[0]!,
      addDaysToDateKey(dates.at(-1)!, 1),
      now,
      new Set(dates),
    );
    if (available.scheduleFingerprint !== input.scheduleFingerprint)
      throw new ActionError(
        "Rozvrh se změnil. Zrušte výběr a načtěte termíny znovu.",
      );
    const byStart = new Map(
      available.windows.map((window) => [window.startISO, window]),
    );
    const snapshots = windows.map((selected) => {
      const match = byStart.get(selected.startISO);
      if (!match || match.endISO !== selected.endISO)
        throw new ActionError(
          "Některý termín už není volný nebo neodpovídá rozvrhu. Nebylo nic uloženo. Zrušte výběr a vyberte volné termíny znovu.",
        );
      return match;
    });
    await tx.insert(blockApplication).values({
      id: input.operationId,
      request: {
        templateIds: [],
        target: {
          mode: "dates",
          dates: [...new Set(snapshots.map((w) => w.dateKey))].sort(),
        },
      },
      snapshot: { templates: [], windows: snapshots },
      fingerprint,
      createdByAdminId: adminId,
    });
    await tx.insert(blockedSlot).values(
      snapshots.map((w) => ({
        applicationId: input.operationId,
        startsAt: new Date(w.startISO),
        endsAt: new Date(w.endISO),
        reason: "other" as const,
        note: "Výběr v kalendáři",
        createdByAdminId: adminId,
      })),
    );
    await recordIn(tx, {
      action: "blocked_slot.created",
      actorType: "admin",
      actorId: adminId,
      summary: `V kalendáři zablokováno ${snapshots.length} termínů.`,
      context: { applicationId: input.operationId },
    });
    return { id: input.operationId, count: snapshots.length };
  });
}
