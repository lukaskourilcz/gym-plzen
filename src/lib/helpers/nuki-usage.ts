import type { NukiLogEntry } from "@/lib/integrations/nuki";

/** A successful keypad opening, never a failed attempt, app action or door sensor event. */
export function isSuccessfulKeypadUse(entry: NukiLogEntry): boolean {
  return (
    Boolean(entry.authId) &&
    entry.state === 0 &&
    entry.trigger === 255 &&
    (entry.source == null || entry.source === 0 || entry.source === 1) &&
    [1, 3, 4, 5].includes(entry.action ?? -1) &&
    Number.isFinite(Date.parse(entry.date))
  );
}

/** Source 2/3 is fingerprint/NFC, not a numeric-code attempt. */
export function isFailedKeypadUse(entry: NukiLogEntry): boolean {
  return (
    (entry.trigger === 255 || entry.trigger === 253) &&
    (entry.source == null || entry.source === 0 || entry.source === 1) &&
    entry.state != null &&
    entry.state !== 0 &&
    entry.state !== 225 &&
    entry.state !== 226 &&
    (entry.state === 224 ||
      entry.trigger === 253 ||
      [1, 3, 4, 5].includes(entry.action ?? -1)) &&
    Number.isFinite(Date.parse(entry.date))
  );
}

export function keypadFailureReason(state: number): string {
  const labels: Record<number, string> = {
    1: "Zablokovaný motor",
    2: "Akce zrušena",
    3: "Příliš brzy po předchozí akci",
    4: "Zámek je zaneprázdněný",
    5: "Nízké napětí motoru",
    6: "Chyba spojky",
    7: "Chyba napájení motoru",
    8: "Otevření nebylo dokončeno",
    9: "Přístup odmítnut",
    10: "Odmítnuto nočním režimem",
    224: "Nesprávný vstupní kód",
    254: "Jiná chyba zámku",
    255: "Neznámá chyba zámku",
  };
  return labels[state] ?? `Chyba zámku (${state})`;
}
