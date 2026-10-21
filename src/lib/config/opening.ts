/** Prague calendar boundaries, including the October daylight-saving change. */
export function openingAnnouncement(
  at: Date,
  copy?: { before: string; october: string; yearEnd: string },
): string | null {
  if (at < new Date("2026-09-30T22:00:00Z")) {
    return copy?.before ?? "OTEVÍRÁME 1. 10. • VSTUP 199 Kč PO CELÝ ŘÍJEN";
  }
  if (at < new Date("2026-10-31T23:00:00Z")) {
    return copy?.october ?? "MÁME OTEVŘENO • VSTUP 199 Kč PO CELÝ ŘÍJEN";
  }
  if (at < new Date("2026-12-31T23:00:00Z")) {
    return copy?.yearEnd ?? "LISTOPAD A PROSINEC • VSTUP 229 Kč";
  }
  return null;
}
