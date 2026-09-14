/** Prague calendar boundaries, including the October daylight-saving change. */
export function openingAnnouncement(at: Date): string | null {
  if (at < new Date("2026-09-30T22:00:00Z")) {
    return "OTEVÍRÁME 1. 10. • VSTUP 199 Kč PO CELÝ ŘÍJEN";
  }
  if (at < new Date("2026-10-31T23:00:00Z")) {
    return "MÁME OTEVŘENO • VSTUP 199 Kč PO CELÝ ŘÍJEN";
  }
  if (at < new Date("2026-12-31T23:00:00Z")) {
    return "LISTOPAD A PROSINEC • VSTUP 229 Kč";
  }
  return null;
}
