import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  localDateTimeToDate,
} from "@/lib/helpers/datetime";

export type FinancePeriod = "7d" | "30d" | "all";

export function parseFinancePeriod(value: string | undefined): FinancePeriod {
  return value === "7d" || value === "30d" ? value : "all";
}

/** Calendar days in Prague, including today, rather than a sliding UTC clock. */
export function financePeriodStart(
  period: FinancePeriod,
  now = new Date(),
): Date | null {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : 30;
  const firstDay = addDaysToDateKey(dateKeyInTimeZone(now), 1 - days);
  return localDateTimeToDate(firstDay, 0);
}
