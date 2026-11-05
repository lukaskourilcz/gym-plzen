import {
  accessCodeDeliveryAt,
  accessCodePreparationAt,
} from "@/lib/config/access-code-delivery";
import { hashCode } from "@/lib/helpers/crypto";

export type CodeCheck =
  "scheduled" | "missing" | "preparing" | "match" | "mismatch" | "unavailable";
export type DeliveryCheck =
  | "not_applicable"
  | "scheduled"
  | "pending"
  | "queued"
  | "sent"
  | "delivered"
  | "read"
  | "sent_early"
  | "failed";

/** Ready means all work due now is complete; T-60 delivery is not an error. */
export function tomorrowReadiness(row: {
  status: string;
  codeCheck: CodeCheck | "awaiting_payment";
  codeProblem?: boolean;
  email: DeliveryCheck | "awaiting_payment";
  whatsApp: DeliveryCheck | "awaiting_payment";
  whatsAppEnabled: boolean;
}) {
  if (row.status !== "confirmed")
    return { state: "waiting", label: "Čeká na platbu" } as const;
  if (
    row.codeProblem ||
    ["missing", "mismatch", "unavailable"].includes(row.codeCheck) ||
    ["failed", "sent_early", "not_applicable"].includes(row.email) ||
    (row.whatsAppEnabled && ["failed", "sent_early"].includes(row.whatsApp))
  )
    return { state: "error", label: "Vyžaduje kontrolu" } as const;
  if (row.codeCheck !== "match")
    return { state: "waiting", label: "Čeká na vytvoření kódu" } as const;
  if (
    ["pending", "queued"].includes(row.email) ||
    (row.whatsAppEnabled && ["pending", "queued"].includes(row.whatsApp))
  )
    return { state: "waiting", label: "Čeká na odeslání" } as const;
  return { state: "ready", label: "Připraveno" } as const;
}

type StoredCode = {
  status: string;
  provisionState: string;
  nukiAuthId: string | null;
  codeHash: string;
  validFrom: Date;
  validUntil: Date;
} | null;

type NukiCode = {
  id: string;
  code: string;
  enabled: boolean;
  allowedFromDate?: string;
  allowedUntilDate?: string;
  allowedWeekDays?: number;
  allowedFromTime?: number;
  allowedUntilTime?: number;
  pending: boolean;
  rejected: boolean;
};

/** Compare on the server; only the verdict reaches the admin page. */
export function checkTomorrowCode(
  startsAt: Date,
  code: StoredCode,
  nuki: readonly NukiCode[] | null,
  now: Date,
): CodeCheck {
  if (!code)
    return now < accessCodePreparationAt(startsAt) ? "scheduled" : "missing";
  if (
    code.provisionState !== "ready" ||
    !code.nukiAuthId ||
    code.status === "failed"
  )
    return "preparing";
  if (!nuki) return "unavailable";
  const match = nuki.find((item) => item.id === code.nukiAuthId);
  if (!match) return "mismatch";
  return match.enabled &&
    !match.pending &&
    !match.rejected &&
    hashCode(match.code) === code.codeHash &&
    Date.parse(match.allowedFromDate ?? "") === code.validFrom.getTime() &&
    Date.parse(match.allowedUntilDate ?? "") === code.validUntil.getTime() &&
    (match.allowedWeekDays == null || match.allowedWeekDays === 127) &&
    (match.allowedFromTime == null || match.allowedFromTime === 0) &&
    (match.allowedUntilTime == null || match.allowedUntilTime === 0)
    ? "match"
    : "mismatch";
}

export function checkTomorrowDelivery(
  startsAt: Date,
  applicable: boolean,
  storedStatus: string | null,
  now: Date,
  sentAt: Date | null = null,
): DeliveryCheck {
  if (!applicable) return "not_applicable";
  if (!storedStatus)
    return now < accessCodeDeliveryAt(startsAt) ? "scheduled" : "pending";
  // Allow a minute for harmless clock skew, but expose historical deliveries
  // that predate the promised T-60 window instead of treating them as ready.
  if (
    sentAt &&
    ["sent", "delivered", "read"].includes(storedStatus) &&
    sentAt.getTime() < accessCodeDeliveryAt(startsAt).getTime() - 60_000
  )
    return "sent_early";
  if (["queued", "sent", "delivered", "read", "failed"].includes(storedStatus))
    return storedStatus as DeliveryCheck;
  return "pending";
}
