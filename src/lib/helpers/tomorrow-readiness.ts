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
  | "failed";

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
): DeliveryCheck {
  if (!applicable) return "not_applicable";
  if (!storedStatus)
    return now < accessCodeDeliveryAt(startsAt) ? "scheduled" : "pending";
  if (["queued", "sent", "delivered", "read", "failed"].includes(storedStatus))
    return storedStatus as DeliveryCheck;
  return "pending";
}
