/**
 * Scheduling configuration & defaults.
 *
 * The gym is open every day 06:00–22:00 with 1-hour training slots aligned to
 * the top of the hour (13:00–14:00, 14:00–15:00, …). Only one person trains at
 * a time, but a 15-minute shower grace after a slot is fine : one member may
 * shower while the next trains. Crucially that grace does NOT block the next
 * slot: overlap is checked on the training hour only, so back-to-back bookings
 * are allowed and two bookings can never land in the same hour.
 *
 * All of these are defaults; opening hours and slot length are editable per
 * weekday in the admin, and the shower grace is an admin setting.
 */

export const DEFAULT_OPEN_MINUTE = 6 * 60; // 06:00
export const DEFAULT_CLOSE_MINUTE = 22 * 60; // 22:00
export const DEFAULT_SLOT_MINUTES = 60;

/** Access code becomes valid this many minutes before the slot start. */
export const CODE_LEAD_MINUTES = 15;

/** Default shower grace: the access code stays valid this long AFTER the slot. */
export const DEFAULT_SHOWER_MINUTES = 15;

/** Admin setting key overriding the shower grace. */
export const SHOWER_MINUTES_SETTING_KEY = "schedule.shower_minutes";
