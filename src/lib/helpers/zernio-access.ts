import { toE164 } from "./phone";

export function zernioAccessPayload(input: {
  accountId: string;
  phone: string;
  reservationTime: string;
  pin: string;
  validFrom: string;
  validUntil: string;
}) {
  const phone = toE164(input.phone);
  if (!phone) throw new Error("Invalid WhatsApp recipient");
  return {
    accountId: input.accountId,
    participantId: phone.slice(1),
    templateName: "navi_rezervace_vstup_cs",
    templateLanguage: "cs",
    templateParams: [
      input.reservationTime,
      input.pin,
      input.validFrom,
      input.validUntil,
    ],
  };
}

export function zernioMessageId(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;
  const r = response as { success?: boolean; data?: { messageId?: unknown } };
  return r.success === true &&
    typeof r.data?.messageId === "string" &&
    r.data.messageId.length > 0
    ? r.data.messageId
    : null;
}
