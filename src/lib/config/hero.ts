/**
 * Admin-configurable settings for the public hero availability calendar.
 * Stored in `site_setting` and read by the home page.
 */

/** How many days ahead (including today) the hero calendar lets visitors browse. */
export const HERO_PREVIEW_DAYS_KEY = "hero.preview_days";

/** Default: today + the nearest 3 days = 4 days total. */
export const DEFAULT_HERO_PREVIEW_DAYS = 4;

/** Allowed range for the configurable look-ahead. */
export const MIN_HERO_PREVIEW_DAYS = 1;
export const MAX_HERO_PREVIEW_DAYS = 14;

/** Clamp any stored/typed value into the supported range. */
export function clampHeroPreviewDays(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_HERO_PREVIEW_DAYS;
  return Math.min(
    MAX_HERO_PREVIEW_DAYS,
    Math.max(MIN_HERO_PREVIEW_DAYS, Math.round(value)),
  );
}
