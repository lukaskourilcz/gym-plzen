import { z } from "zod";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  dayOfWeek,
  isDateKey,
  localDateTimeToDate,
  minuteOfDay,
} from "@/lib/helpers/datetime";

export const PLANNED_SCHEDULES_KEY = "schedule.planned";
export const MAX_PLANNED_SCHEDULES = 100;
export const MAX_PLANNED_WINDOWS = 48;

const dateKey = z
  .string()
  .refine(
    (value) => isDateKey(value) && value <= "2099-12-31",
    "Vyberte platné datum do roku 2099.",
  );
const minute = z.number().int().min(0).max(1439);
const plannedWindowSchema = z.object({
  startMinute: minute,
  endMinute: minute,
  priceCents: z.number().int().positive().max(1_000_000),
});

export const plannedScheduleInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    revision: z.string().uuid().optional(),
    name: z.string().trim().min(1, "Zadejte název rozvrhu.").max(100),
    from: dateKey,
    to: dateKey,
    weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    windows: z.array(plannedWindowSchema).min(1).max(MAX_PLANNED_WINDOWS),
  })
  .superRefine((input, ctx) => {
    if (input.to < input.from)
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: "Konec období musí být v den začátku nebo později.",
      });
    if (new Set(input.weekdays).size !== input.weekdays.length)
      ctx.addIssue({
        code: "custom",
        path: ["weekdays"],
        message: "Každý den lze vybrat jen jednou.",
      });
    const sorted = [...input.windows].sort(
      (a, b) => a.startMinute - b.startMinute,
    );
    if (sorted.some((window) => window.endMinute <= window.startMinute))
      ctx.addIssue({
        code: "custom",
        path: ["windows"],
        message: "Konec každého okna musí být po jeho začátku.",
      });
    if (
      sorted.some(
        (window, i) => i > 0 && window.startMinute < sorted[i - 1]!.endMinute,
      )
    )
      ctx.addIssue({
        code: "custom",
        path: ["windows"],
        message: "Časová okna se nesmí překrývat.",
      });
  });
export type PlannedScheduleInput = z.infer<typeof plannedScheduleInputSchema>;
export type PlannedSchedule = PlannedScheduleInput & {
  id: string;
  revision: string;
};

const savedScheduleSchema = plannedScheduleInputSchema.safeExtend({
  id: z.string().uuid(),
  revision: z.string().uuid(),
});

export function parsePlannedSchedules(value: unknown): PlannedSchedule[] {
  if (value == null) return [];
  return z.array(savedScheduleSchema).max(MAX_PLANNED_SCHEDULES).parse(value);
}

/** The same weekday may have at most one schedule on any actual visit date. */
export function plannedSchedulesOverlap(
  a: PlannedScheduleInput,
  b: PlannedScheduleInput,
): boolean {
  const from = a.from > b.from ? a.from : b.from;
  const to = a.to < b.to ? a.to : b.to;
  for (let offset = 0; offset < 7; offset++) {
    const date = addDaysToDateKey(from, offset);
    if (date > to) return false;
    const weekday = dayOfWeek(localDateTimeToDate(date, 720));
    if (a.weekdays.includes(weekday) && b.weekdays.includes(weekday))
      return true;
  }
  return false;
}

export function plannedScheduleForDate(
  schedules: readonly PlannedSchedule[],
  key: string,
) {
  const eligible = schedules.filter(
    (schedule) => schedule.from <= key && key <= schedule.to,
  );
  if (!eligible.length) return undefined;
  const weekday = dayOfWeek(localDateTimeToDate(key, 720));
  return eligible.find((schedule) => schedule.weekdays.includes(weekday));
}

/** Nonexistent local times on a DST transition do not become shifted bookings. */
export function plannedWindowTimes(
  date: string,
  window: Pick<PlannedSchedule["windows"][number], "startMinute" | "endMinute">,
) {
  try {
    return {
      startsAt: localDateTimeToDate(date, window.startMinute),
      endsAt: localDateTimeToDate(date, window.endMinute),
    };
  } catch {
    return null;
  }
}

export function plannedWindowAt(schedule: PlannedSchedule, startsAt: Date) {
  const key = dateKeyInTimeZone(startsAt);
  const minute = minuteOfDay(startsAt);
  const window = schedule.windows.find((item) => item.startMinute === minute);
  if (!window) return null;
  const times = plannedWindowTimes(key, window);
  return times && times.startsAt.getTime() === startsAt.getTime()
    ? { ...times, priceCents: window.priceCents }
    : null;
}
