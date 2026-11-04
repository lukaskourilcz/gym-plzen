import { eq, sql } from "drizzle-orm";
import { db, type DatabaseExecutor } from "@/lib/db";
import { openingHours, siteSetting } from "@/lib/db/schema";
import type { PricingHours } from "@/lib/config/block-pricing";
import {
  parsePlannedSchedules,
  PLANNED_SCHEDULES_KEY,
} from "@/lib/config/planned-schedules";

export async function listPlannedSchedules(executor: DatabaseExecutor = db) {
  const [row] = await executor
    .select({ value: siteSetting.value })
    .from(siteSetting)
    .where(eq(siteSetting.key, PLANNED_SCHEDULES_KEY));
  return parsePlannedSchedules(row?.value);
}

/** One row for both schedule sources, so checkout keeps a bounded query count. */
export async function loadBookingSchedule(executor: DatabaseExecutor = db) {
  const [row] = await executor.execute<{
    weekly: PricingHours[];
    planned: unknown;
  }>(sql`
    select coalesce((
      select jsonb_agg(jsonb_build_object(
        'dayOfWeek', ${openingHours.dayOfWeek},
        'openMinute', ${openingHours.openMinute},
        'closeMinute', ${openingHours.closeMinute},
        'slotMinutes', ${openingHours.slotMinutes},
        'isClosed', ${openingHours.isClosed}
      )) from ${openingHours}
    ), '[]'::jsonb) as weekly,
    (select ${siteSetting.value} from ${siteSetting} where ${siteSetting.key} = ${PLANNED_SCHEDULES_KEY}) as planned
  `);
  return { weekly: row!.weekly, planned: parsePlannedSchedules(row!.planned) };
}
