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
import { z } from "zod";

export const ANNOUNCEMENT_SETTING_KEY = "content.announcement";
/** Old CMS copy is retained only for a read-only fallback until the first save. */
export const LEGACY_ANNOUNCEMENT_KEYS = [
  "home.opening.before",
  "home.opening.october",
  "home.opening.yearEnd",
  "home.opening.cta",
] as const;

export const announcementSchema = z.object({
  enabled: z.boolean(),
  title: z.string().trim().min(1, "Zadejte hlavní text lišty.").max(500),
  showSecondLine: z.boolean(),
  secondLine: z.string().trim().max(1000),
});
export type Announcement = z.infer<typeof announcementSchema>;

/** No write, migration or automatic schedule applies to the new manual banner. */
export function resolveAnnouncement(
  value: unknown,
  at: Date,
  copy: { before: string; october: string; yearEnd: string; cta: string },
): Announcement {
  const saved = announcementSchema.safeParse(value);
  if (saved.success) return saved.data;
  const title = openingAnnouncement(at, copy);
  return {
    enabled: title !== null,
    title: title ?? copy.yearEnd,
    showSecondLine: true,
    secondLine: copy.cta,
  };
}
