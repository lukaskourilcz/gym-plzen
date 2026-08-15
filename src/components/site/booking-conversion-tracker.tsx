"use client";

import { useEffect } from "react";
import { trackMetaEvent } from "@/lib/analytics/meta-pixel";

export function BookingConversionTracker({
  reservationId,
  priceCents,
  currency,
}: {
  reservationId: string;
  priceCents: number;
  currency: string;
}) {
  useEffect(() => {
    const normalizedCurrency = currency.toUpperCase();
    if (priceCents > 0) {
      trackMetaEvent(
        "Purchase",
        { value: priceCents / 100, currency: normalizedCurrency },
        `reservation:${reservationId}:purchase`,
      );
      return;
    }
    trackMetaEvent(
      "Schedule",
      { value: 0, currency: normalizedCurrency },
      `reservation:${reservationId}:schedule`,
    );
  }, [currency, priceCents, reservationId]);

  return null;
}
