/**
 * Presentation helpers : currency, dates, phone. Formatting is Czech-locale by
 * default to match the site's primary audience.
 */

const DEFAULT_LOCALE = "cs-CZ";
const DEFAULT_TZ = "Europe/Prague";

/** Format an integer amount in the smallest currency unit (haléř/cent) as text. */
export function formatMoney(
  amountCents: number,
  currency = "CZK",
  locale = DEFAULT_LOCALE,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
  }).format(amountCents / 100);
}

/** Format a date+time for display, e.g. "18. 7. 2026, 15:00". */
export function formatDateTime(
  date: Date,
  locale = DEFAULT_LOCALE,
  timeZone = DEFAULT_TZ,
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
}

/** Format only the calendar date, e.g. "18. 7. 2026". */
export function formatDate(
  date: Date,
  locale = DEFAULT_LOCALE,
  timeZone = DEFAULT_TZ,
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone,
  }).format(date);
}

/** Format only the time, e.g. "15:00". */
export function formatTime(
  date: Date,
  locale = DEFAULT_LOCALE,
  timeZone = DEFAULT_TZ,
): string {
  return new Intl.DateTimeFormat(locale, {
    timeStyle: "short",
    timeZone,
  }).format(date);
}

/**
 * En dash flanked by non-breaking spaces. The client asked for the spacing;
 * the spaces are non-breaking so a range never wraps mid-way inside the narrow
 * slot buttons.
 */
export const RANGE_DASH = " – ";

/** Exact customer-facing range in the gym timezone, e.g. "8:00 – 9:15". */
export function formatTimeRange(start: Date, end: Date): string {
  return `${formatTime(start)}${RANGE_DASH}${formatTime(end)}`;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Čeká na potvrzení",
  confirmed: "Potvrzená",
  completed: "Dokončená",
  no_show: "Nevyužitá",
  cancelled: "Zrušená",
  failed: "Nedoručená",
  sent: "Odeslaná",
  delivered: "Doručená",
  read: "Přečtená",
};

/** Translate persisted machine statuses at the presentation boundary. */
export function formatStatus(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/** Convert minute-of-day (e.g. 900) to "HH:mm" (e.g. "15:00"). */
export function minutesToHHmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Parse "HH:mm" into minute-of-day, or null if malformed. */
export function hhmmToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}
