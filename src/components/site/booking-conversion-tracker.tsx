"use client";

import {
  trackGooglePurchase,
  ANALYTICS_CONSENT_CHANGED,
} from "@/lib/analytics/google-analytics";
import { useEffect } from "react";
import { trackMetaEvent } from "@/lib/analytics/meta-pixel";

/**
 * Purchase measurement for a confirmed booking. `transactionId` is the order
 * (or, for an older booking, the reservation), so one payment is one
 * purchase however many slots it bought.
 */
export function BookingConversionTracker({
  transactionId,
  priceCents,
  currency,
  quantity = 1,
}: {
  transactionId: string;
  priceCents: number;
  currency: string;
  quantity?: number;
}) {
  const reservationId = transactionId;
  useEffect(() => {
    const track = () =>
      trackGooglePurchase(reservationId, priceCents, currency, quantity);
    track();
    window.addEventListener(ANALYTICS_CONSENT_CHANGED, track);
    return () => window.removeEventListener(ANALYTICS_CONSENT_CHANGED, track);
  }, [currency, priceCents, quantity, reservationId]);

  useEffect(() => {
    const normalizedCurrency = currency.toUpperCase();
    if (priceCents > 0) {
      trackMetaEvent(
        "Purchase",
        {
          value: priceCents / 100,
          currency: normalizedCurrency,
          num_items: quantity,
        },
        `reservation:${reservationId}:purchase`,
      );
      return;
    }
    trackMetaEvent(
      "Schedule",
      { value: 0, currency: normalizedCurrency },
      `reservation:${reservationId}:schedule`,
    );
  }, [currency, priceCents, quantity, reservationId]);

  return null;
}
