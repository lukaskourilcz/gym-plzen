import { formatDateTime } from "./format";

/**
 * Czech copy for closing a time range over existing bookings. Pure, so the
 * service, the schedule form and the calendar say the same thing.
 */

/** "1 rezervaci" / "2 rezervace" / "5 rezervací" (accusative). */
export function reservationsAccusative(n: number): string {
  if (n === 1) return "1 rezervaci";
  if (n >= 2 && n <= 4) return `${n} rezervace`;
  return `${n} rezervací`;
}

export function closureConfirmationMessage(count: number): string {
  return `Uzavření zruší ${reservationsAccusative(count)} a zákazníkům odejde e-mail. Potvrďte znovu.`;
}

/** Summary of bookings a closure could not cancel, for the admin. */
export function closureFailureMessage(
  failed: ReadonlyArray<{ startsAt: Date | string }>,
): string {
  const times = failed
    .map((f) => formatDateTime(new Date(f.startsAt)))
    .join(", ");
  return `Blok je uložen, ale ${reservationsAccusative(failed.length)} se nepodařilo zrušit (${times}). Odešlete formulář znovu; blok se podruhé nevytvoří.`;
}
