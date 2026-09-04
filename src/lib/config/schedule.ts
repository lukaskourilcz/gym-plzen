/**
 * Scheduling configuration & defaults.
 *
 * The gym is open every day 05:00–23:45 with 75-minute training windows laid
 * out back to back from opening time (05:00–06:15, 06:15–07:30, … 22:30–23:45),
 * which fills the day exactly 15 times. Only one person trains at a time, but a
 * 15-minute shower grace after a window is fine : one member may shower while
 * the next trains. Crucially that grace does NOT block the next window: overlap
 * is checked on the training window only, so back-to-back bookings are allowed
 * and two bookings can never land in the same window.
 *
 * All of these are defaults; opening hours and slot length are editable per
 * weekday in the admin, and the shower grace is an admin setting.
 */

export const DEFAULT_OPEN_MINUTE = 5 * 60; // 05:00
export const DEFAULT_CLOSE_MINUTE = 23 * 60 + 45; // 23:45
export const DEFAULT_SLOT_MINUTES = 75;

/** Access code becomes valid this many minutes before the slot start. */
export const CODE_LEAD_MINUTES = 15;

/** Default shower grace: the access code stays valid this long AFTER the slot. */
export const DEFAULT_SHOWER_MINUTES = 15;

/** Admin setting key overriding the shower grace. */
export const SHOWER_MINUTES_SETTING_KEY = "schedule.shower_minutes";

/**
 * How far ahead a visitor may book, in days including today.
 *
 * Configurable because a promotion can need a longer horizon than everyday
 * operation: an October promotion that must reach January needs about 130 days,
 * while the everyday default is 60.
 */
export const BOOKING_HORIZON_SETTING_KEY = "booking.horizon_days";

export const DEFAULT_BOOKING_HORIZON_DAYS = 60;

/** Allowed range: a week at minimum, a year at most. */
export const MIN_BOOKING_HORIZON_DAYS = 7;
export const MAX_BOOKING_HORIZON_DAYS = 365;

/** Clamp any stored or typed value into the supported range. */
export function clampBookingHorizonDays(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_BOOKING_HORIZON_DAYS;
  return Math.min(
    MAX_BOOKING_HORIZON_DAYS,
    Math.max(MIN_BOOKING_HORIZON_DAYS, Math.round(value)),
  );
}
