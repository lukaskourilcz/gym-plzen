import assert from "node:assert/strict";
import test from "node:test";
import { siteHost } from "../../src/lib/helpers/site-url";
import {
  buildIcs,
  googleCalendarUrl,
  reservationCalendarEvent,
  toIcsUtc,
} from "../../src/lib/helpers/ics";

const STAMP = new Date("2026-08-01T09:00:00.000Z");

/** Unfolding per RFC 5545: drop every CRLF that is followed by one space. */
function unfold(ics: string): string {
  return ics.replace(/\r\n /g, "");
}

test("a reservation renders as a valid single-event calendar", () => {
  const ics = buildIcs(
    reservationCalendarEvent({
      reservationId: "res-1",
      startsAt: new Date("2026-08-30T16:00:00.000Z"),
      endsAt: new Date("2026-08-30T17:15:00.000Z"),
      address: "Křížkova 424/23, 301 00 Plzeň - Roudná",
      stamp: STAMP,
    }),
  );

  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
  assert.ok(ics.includes(`UID:res-1@${siteHost()}\r\n`));
  assert.match(ics, /DTSTART:20260830T160000Z\r\n/);
  assert.match(ics, /DTEND:20260830T171500Z\r\n/);
  assert.match(ics, /DTSTAMP:20260801T090000Z\r\n/);
  // Every newline is part of a CRLF pair, as the spec requires.
  assert.equal(ics.split("\r\n").length, ics.split("\n").length);
});

test("summer and winter reservations both keep their wall-clock hour", () => {
  // 18:00 Prague in CEST (UTC+2) and in CET (UTC+1). Storing the absolute
  // instant is what makes both come back as 18:00 in the reader's calendar.
  assert.equal(
    toIcsUtc(new Date("2026-07-15T16:00:00.000Z")),
    "20260715T160000Z",
  );
  assert.equal(
    toIcsUtc(new Date("2026-01-15T17:00:00.000Z")),
    "20260115T170000Z",
  );
  // The switch weekend itself: 03:00 CEST becomes 02:00 CET on 25 Oct 2026.
  assert.equal(
    toIcsUtc(new Date("2026-10-25T00:30:00.000Z")),
    "20261025T003000Z",
  );
});

test("special characters are escaped and long lines folded", () => {
  const ics = buildIcs({
    uid: `res-2@${siteHost()}`,
    start: new Date("2026-08-30T16:00:00.000Z"),
    end: new Date("2026-08-30T17:15:00.000Z"),
    summary: "Trénink; celý gym, jen pro vás",
    description: "Řádek jedna\nŘádek dvě",
    stamp: STAMP,
  });
  const text = unfold(ics);

  // A literal backslash precedes ; and , and newlines become \n.
  assert.ok(text.includes("SUMMARY:Trénink\\; celý gym\\, jen pro vás"), text);
  assert.ok(text.includes("DESCRIPTION:Řádek jedna\\nŘádek dvě"), text);

  // No line, folded or not, may exceed 75 octets on the wire.
  for (const line of ics.trimEnd().split("\r\n")) {
    assert.ok(Buffer.from(line, "utf8").length <= 75, `line too long: ${line}`);
  }
});

test("folding never splits a Czech character in half", () => {
  const description = "Dlouhý český popis s diakritikou ".repeat(5);
  const ics = buildIcs({
    uid: `res-3@${siteHost()}`,
    start: new Date("2026-08-30T16:00:00.000Z"),
    end: new Date("2026-08-30T17:15:00.000Z"),
    summary: "Trénink",
    description,
    stamp: STAMP,
  });

  assert.ok(ics.includes("\r\n "), "expected the long line to be folded");
  assert.ok(unfold(ics).includes(`DESCRIPTION:${description}`));
  // A byte-level split would surface as replacement characters.
  assert.doesNotMatch(ics, /�/);
});

test("the calendar entry carries the slot only, never a code or contact detail", () => {
  const event = reservationCalendarEvent({
    reservationId: "res-4",
    startsAt: new Date("2026-08-30T16:00:00.000Z"),
    endsAt: new Date("2026-08-30T17:15:00.000Z"),
    address: "Křížkova 424/23, 301 00 Plzeň - Roudná",
  });

  // There is no field for a secret to leak through: the builder accepts no
  // code, name, e-mail or phone, and a calendar entry syncs to third parties.
  assert.deepEqual(
    Object.keys(event).sort(),
    [
      "description",
      "end",
      "location",
      "stamp",
      "start",
      "summary",
      "uid",
    ].sort(),
  );

  const text = unfold(buildIcs({ ...event, stamp: STAMP }));
  // The only "@" in the file belongs to the gym's own UID domain.
  assert.equal(text.match(/@/g)?.length, 1);
  assert.ok(text.includes(`@${siteHost()}`));
  assert.doesNotMatch(text, /\+420/);
  // It says where the code comes from instead of carrying one.
  assert.match(text, /Vstupní kód vám pošleme e-mailem/);
});

test("the Google link carries the same instant and place", () => {
  const url = new URL(
    googleCalendarUrl(
      reservationCalendarEvent({
        reservationId: "res-5",
        startsAt: new Date("2026-08-30T16:00:00.000Z"),
        endsAt: new Date("2026-08-30T17:15:00.000Z"),
        address: "Křížkova 424/23",
      }),
    ),
  );

  assert.equal(
    url.origin + url.pathname,
    "https://calendar.google.com/calendar/render",
  );
  assert.equal(url.searchParams.get("action"), "TEMPLATE");
  assert.equal(
    url.searchParams.get("dates"),
    "20260830T160000Z/20260830T171500Z",
  );
  assert.equal(url.searchParams.get("location"), "Křížkova 424/23");
});
