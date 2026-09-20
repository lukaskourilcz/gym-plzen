/**
 * Presentation helpers : currency, dates, phone. Formatting is Czech-locale by
 * default to match the site's primary audience.
 */

import { cachedDateTimeFormat } from "./datetime";

const DEFAULT_LOCALE = "cs-CZ";
const DEFAULT_TZ = "Europe/Prague";

/* Same reasoning as the date formatter cache: construction is the cost. */
const numberFormatters = new Map<string, Intl.NumberFormat>();
function cachedNumberFormat(
  locale: string,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = numberFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    numberFormatters.set(key, formatter);
  }
  return formatter;
}

/** Format an integer amount in the smallest currency unit (haléř/cent) as text. */
export function formatMoney(
  amountCents: number,
  currency = "CZK",
  locale = DEFAULT_LOCALE,
): string {
  return cachedNumberFormat(locale, {
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
  return cachedDateTimeFormat(locale, {
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
  return cachedDateTimeFormat(locale, {
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
  return cachedDateTimeFormat(locale, {
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

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Čeká na zaplacení",
  processing: "Zpracovává se",
  succeeded: "Zaplaceno",
  failed: "Neproběhla",
  refunded: "Vrácena",
};

/** State of a payment attempt, for the administration. */
export function formatPaymentStatus(status: string): string {
  return PAYMENT_STATUS_LABELS[status] ?? status;
}

const CHANNEL_LABELS: Record<string, string> = {
  email: "E-mail",
  whatsapp: "WhatsApp",
  sms: "SMS",
};

/** Delivery channel of a message, for the administration. */
export function formatChannel(channel: string): string {
  return CHANNEL_LABELS[channel] ?? channel;
}

const MESSAGE_KIND_LABELS: Record<string, string> = {
  access_code: "Vstupní kód",
  reservation_confirmation: "Potvrzení rezervace",
  reservation_reminder: "Připomínka rezervace",
  reservation_cancellation: "Zrušení rezervace",
  marketing: "Novinky",
  system_alert: "Systémové upozornění",
  operator_notice: "Upozornění pro provozovatele",
};

/** What a message was about, for the administration. */
export function formatMessageKind(kind: string): string {
  return MESSAGE_KIND_LABELS[kind] ?? kind;
}

const SEVERITY_LABELS: Record<string, string> = {
  info: "Informace",
  warning: "Varování",
  critical: "Kritické",
};

/** Severity of an operational alert, for the administration. */
export function formatSeverity(severity: string): string {
  return SEVERITY_LABELS[severity] ?? severity;
}

const LOCK_ACTION_LABELS: Record<string, string> = {
  keypad_open: "Otevření kódem",
  unlock: "Odemčení",
  lock: "Zamčení",
  unlatch: "Otevření dveří",
  lock_n_go: "Zamknout a odejít",
};

const LOCK_TRIGGER_LABELS: Record<string, string> = {
  system: "Systém",
  manual: "Ručně",
  button: "Tlačítko na zámku",
  automatic: "Automaticky",
  keypad: "Klávesnice",
  auto_lock: "Automatické zamčení",
  app: "Aplikace",
  web: "Nuki Web",
  accessory: "Příslušenství",
};

/** What the lock did, in the entry book. */
export function formatLockAction(action: string): string {
  return LOCK_ACTION_LABELS[action] ?? action;
}

/** What made the lock act, in the entry book. */
export function formatLockTrigger(trigger: string): string {
  return LOCK_TRIGGER_LABELS[trigger] ?? trigger;
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
