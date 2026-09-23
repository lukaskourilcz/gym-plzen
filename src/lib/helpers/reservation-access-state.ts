import {
  accessCodeDeliveryAt,
  accessCodePreparationAt,
} from "@/lib/config/access-code-delivery";

export function reservationAccessState(
  input: {
    status: string;
    startsAt: Date;
    endsAt: Date;
    hold: boolean;
    code?: {
      provisionState: string;
      failureReason: string | null;
      revokeRequestedAt: Date | null;
    };
    delivered: boolean;
    enabled: boolean;
  },
  now = new Date(),
): { label: string; at?: Date } {
  if (input.hold) return { label: "Odebrání nepotvrzeno — termín blokovaný" };
  if (input.status === "cancelled") return { label: "Rezervace zrušená" };
  if (input.status === "pending") return { label: "Čeká na platbu" };
  if (input.endsAt <= now) return { label: "Termín již skončil" };
  if (input.code?.revokeRequestedAt)
    return { label: "Čeká na ověření odebrání kódu" };
  if (input.delivered) return { label: "Kód odeslán e-mailem" };
  if (!input.enabled) return { label: "Automatické kódy jsou vypnuté" };
  const prepareAt = accessCodePreparationAt(input.startsAt);
  if (!input.code && prepareAt > now)
    return { label: "Vytvoření naplánováno", at: prepareAt };
  if (input.code?.provisionState === "ready") {
    const sendAt = accessCodeDeliveryAt(input.startsAt);
    return sendAt > now
      ? { label: "Kód připraven — odeslání", at: sendAt }
      : { label: "Kód připraven — čeká na odeslání" };
  }
  if (input.code?.failureReason === "device_offline")
    return { label: "Zámek nedostupný — přípravu opakujeme" };
  if (input.code?.provisionState === "submitted")
    return { label: "Čeká na potvrzení Nuki" };
  return { label: "Kód se připravuje" };
}
