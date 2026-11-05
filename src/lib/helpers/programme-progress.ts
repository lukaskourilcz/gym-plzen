/** Presentation only: never changes a reservation's attendance or payment state. */
export function programmeProgress(
  booking: {
    startsAt: string;
    endsAt: string;
    codeCreated: boolean;
    codeUsed: boolean;
  },
  now: number,
) {
  const start = Date.parse(booking.startsAt);
  const end = Date.parse(booking.endsAt);
  const progress = Math.min(
    100,
    Math.max(0, ((now - start) / Math.max(1, end - start)) * 100),
  );
  const started = now >= start;
  const ended = now >= end;
  return {
    progress,
    tone: !started
      ? "neutral"
      : booking.codeUsed
        ? "success"
        : booking.codeCreated
          ? "danger"
          : "warning",
    label: !started
      ? "Nadcházející"
      : booking.codeUsed
        ? ended
          ? "Vstup potvrzen"
          : "Právě probíhá · vstup potvrzen"
        : !booking.codeCreated
          ? "Chybí připravený kód"
          : ended
            ? "Vstup nezaznamenán"
            : "Čeká na příchod",
  } as const;
}
