import { siteHost } from "@/lib/helpers/site-url";

/**
 * Minimal iCalendar (RFC 5545) writer for a single reservation, plus the
 * equivalent Google Calendar template link.
 *
 * Times are written as UTC instants (`...Z`). A `Date` is an absolute moment,
 * so this is exact across the CET/CEST switch and needs no hand-rolled
 * VTIMEZONE block: every calendar renders it back in the reader's own zone,
 * which for this gym's customers is Europe/Prague.
 */

export interface CalendarEvent {
  /** Globally unique, stable across re-downloads so calendars update in place. */
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  location?: string;
  description?: string;
  url?: string;
  /** Injectable for tests; defaults to now. */
  stamp?: Date;
  sequence?: number;
}

/** `20260830T160000Z` : the basic UTC form every calendar accepts. */
export function toIcsUtc(date: Date): string {
  return `${date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "")}`;
}

/** RFC 5545 §3.3.11: backslash, semicolon, comma and newlines are special. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * RFC 5545 §3.1: no line may exceed 75 octets. Folding counts bytes, not
 * characters, or a Czech diacritic straddling the limit would be split
 * mid-sequence and arrive as mojibake.
 */
function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let cursor = 0;
  let limit = 75;
  while (cursor < bytes.length) {
    let end = Math.min(cursor + limit, bytes.length);
    // Never cut inside a multi-byte character: continuation bytes are 10xxxxxx.
    while (
      end > cursor &&
      end < bytes.length &&
      (bytes[end]! & 0xc0) === 0x80
    ) {
      end -= 1;
    }
    parts.push(bytes.subarray(cursor, end).toString("utf8"));
    cursor = end;
    // Continuation lines start with one space, which counts toward the 75.
    limit = 74;
  }
  return parts.join("\r\n ");
}

/** Build a complete single-event calendar document. */
export function buildIcs(event: CalendarEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NAVI Private Gym//Rezervace//CS",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `SEQUENCE:${event.sequence ?? 0}`,
    `DTSTAMP:${toIcsUtc(event.stamp ?? new Date())}`,
    `DTSTART:${toIcsUtc(event.start)}`,
    `DTEND:${toIcsUtc(event.end)}`,
    `SUMMARY:${escapeText(event.summary)}`,
    ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
    ...(event.description
      ? [`DESCRIPTION:${escapeText(event.description)}`]
      : []),
    ...(event.url ? [`URL:${escapeText(event.url)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  // CRLF throughout, including the trailing break, as the spec requires.
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

/** The same event as a Google Calendar "add event" link. */
export function googleCalendarUrl(
  event: Pick<
    CalendarEvent,
    "start" | "end" | "summary" | "location" | "description"
  >,
): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.summary,
    dates: `${toIcsUtc(event.start)}/${toIcsUtc(event.end)}`,
  });
  if (event.description) params.set("details", event.description);
  if (event.location) params.set("location", event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Czech copy for a reservation, shared by the .ics route and both pages. */
export const RESERVATION_CALENDAR_SUMMARY = "Trénink · NAVI Private Gym";

/**
 * Map a reservation onto a calendar event. Deliberately carries no access code
 * and no personal data beyond the slot itself: a calendar entry is routinely
 * synced to third-party servers and shared devices.
 */
export function reservationCalendarEvent(params: {
  reservationId: string;
  startsAt: Date;
  endsAt: Date;
  address?: string | null;
  stamp?: Date;
  sequence?: number;
}): CalendarEvent {
  return {
    uid: `${params.reservationId}@${siteHost()}`,
    start: params.startsAt,
    end: params.endsAt,
    summary: RESERVATION_CALENDAR_SUMMARY,
    location: params.address ?? undefined,
    description:
      "Soukromý trénink v NAVI Private Gym. Vstupní kód vám pošleme e-mailem před začátkem rezervace.",
    stamp: params.stamp,
    sequence: params.sequence,
  };
}
