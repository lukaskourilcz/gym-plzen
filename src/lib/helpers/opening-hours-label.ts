import type { PricingHours } from "@/lib/config/block-pricing";
import {
  DEFAULT_OPEN_MINUTE,
  DEFAULT_CLOSE_MINUTE,
} from "@/lib/config/schedule";
import { minutesToHHmm, RANGE_DASH } from "./format";
const names = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];
const time = (minute: number) => minutesToHHmm(minute).replace(/^0/, "");
/** Read-only display of the same hours used by the calendar. */
export function openingHoursLabel(hours: readonly PricingHours[]): string {
  if (!hours.length)
    return `${time(DEFAULT_OPEN_MINUTE)}${RANGE_DASH}${time(DEFAULT_CLOSE_MINUTE)}`;
  const labels = [1, 2, 3, 4, 5, 6, 0].map((day) => {
    const row = hours.find((h) => h.dayOfWeek === day);
    return !row || row.isClosed
      ? "zavřeno"
      : `${time(row.openMinute)}${RANGE_DASH}${time(row.closeMinute)}`;
  });
  if (labels.every((label) => label === labels[0])) return labels[0]!;
  const groups: { from: number; to: number; label: string }[] = [];
  labels.forEach((label, index) => {
    const previous = groups.at(-1);
    if (previous?.label === label) previous.to = index;
    else groups.push({ from: index, to: index, label });
  });
  return groups
    .map(
      (group) =>
        `${names[group.from]}${group.to === group.from ? "" : `–${names[group.to]}`} ${group.label}`,
    )
    .join(" · ");
}
