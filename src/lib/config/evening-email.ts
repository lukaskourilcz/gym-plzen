import { z } from "zod";
import { minuteOfDay } from "@/lib/helpers/datetime";

export const EVENING_EMAIL_START_KEY = "messages.access_code_evening_from";
export const DEFAULT_EVENING_EMAIL_START = 21 * 60;
export const eveningEmailStartSchema = z.object({
  time: z
    .string()
    .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Zadejte čas od 00:00 do 23:59."),
});
export function eveningEmailStart(value: unknown): number {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < 1440
    ? value
    : DEFAULT_EVENING_EMAIL_START;
}
export function accessCodeEmailTemplate(startsAt: Date, from: number) {
  return minuteOfDay(startsAt) >= eveningEmailStart(from)
    ? "access_code_evening"
    : "access_code";
}
