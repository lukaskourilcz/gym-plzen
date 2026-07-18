import { z } from "zod";

/**
 * Reusable primitive schemas shared across forms.
 *
 * These schemas are intentionally **transform-free**: they validate the raw
 * shape of form input (as produced by React Hook Form) and are used *both*
 * client-side (via `zodResolver`) and server-side (in the action). Any type
 * conversion — "HH:mm" → minutes, date-string → `Date`, "" → `null` — happens
 * explicitly inside the action handler, so the schema's input and output types
 * match and one schema serves both sides.
 */

/** UUID — used for our own domain rows (reservations, plans, …). */
export const uuidSchema = z.string().uuid("Neplatné ID.");

/** Opaque id string (accepts uuids and other id formats). */
export const idSchema = z.string().min(1, "Neplatné ID.").max(255);

export const emailSchema = z.string().email("Neplatný e-mail.");

export const phoneSchema = z.string().min(9, "Neplatné telefonní číslo.").max(20);

/**
 * A datetime as produced by an `<input type="datetime-local">` or an ISO
 * string. Validated (parseable) but kept as a string; the handler calls
 * `new Date(...)`.
 */
export const dateTimeStringSchema = z
  .string()
  .min(1, "Zadejte datum a čas.")
  .refine((s) => !Number.isNaN(Date.parse(s)), "Neplatné datum.");

/** "HH:mm" time-of-day string (kept as string; handler converts to minutes). */
export const hhmmSchema = z
  .string()
  .regex(/^\d{1,2}:\d{2}$/, "Zadejte čas ve formátu HH:MM.");

/** Non-negative integer amount in the smallest currency unit (haléř). */
export const priceCentsSchema = z
  .number({ invalid_type_error: "Zadejte číslo." })
  .int("Cena musí být celé číslo.")
  .nonnegative("Cena nesmí být záporná.");

/** Optional email that also accepts an empty string (blank field). */
export const optionalEmail = z.union([z.literal(""), emailSchema]).optional();

/** Optional phone that also accepts an empty string (blank field). */
export const optionalPhone = z.union([z.literal(""), phoneSchema]).optional();

/** Optional free text (empty string allowed). */
export function optionalText(max = 1000) {
  return z.string().max(max).optional();
}
