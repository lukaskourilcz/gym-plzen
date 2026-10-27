import { formatMoney } from "@/lib/helpers/format";

export interface CancellationPrice {
  priceCents: number | null;
  creditPaidCents?: number;
  currency: string;
  loyaltyReward: number | null;
  additionalPeoplePaidCents: number;
}
/** Presentation only. A zero amount by itself never means a loyalty reward. */
export function cancellationPrice(value: CancellationPrice) {
  const amount =
    value.priceCents === null
      ? null
      : value.priceCents + value.additionalPeoplePaidCents;
  const price =
    amount === null
      ? "Cena není evidována"
      : formatMoney(amount, value.currency);
  const bonus = value.loyaltyReward !== null;
  const loyaltyNote = bonus
    ? " Zrušený bonusový vstup se nezapočítá do věrnosti. Nárok na další bonus se znovu vypočítá podle zbývajících rezervací."
    : "";
  return {
    amount,
    price,
    bonus,
    note:
      (amount === null
        ? "Zrušením nevzniká nárok na vrácení platby."
        : amount > 0
          ? `Zaplacených ${price} se podle obchodních podmínek nevrací.${value.creditPaidCents ? " Nevrací se ani část uhrazená kreditem." : ""}`
          : bonus
            ? "Jedná se o bonusový 10. vstup zdarma, nebyla za něj uhrazena žádná částka."
            : "Za tento vstup nebyla uhrazena žádná částka, není tedy co vracet.") +
      loyaltyNote,
  };
}
