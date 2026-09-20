import type { NukiLogEntry } from "@/lib/integrations/nuki";

/** A successful keypad opening, never a failed attempt, app action or door sensor event. */
export function isSuccessfulKeypadUse(entry: NukiLogEntry): boolean {
  return Boolean(entry.authId) && entry.state === 0 &&
    entry.trigger === 255 && (entry.source == null || entry.source === 0 || entry.source === 1) &&
    [1, 3, 4, 5].includes(entry.action ?? -1) && Number.isFinite(Date.parse(entry.date));
}
