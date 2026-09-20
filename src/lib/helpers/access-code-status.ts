/** Derive time-based status even before a background job updates the row. */
export function accessCodeStatusLabel(code: {
  status: string; validFrom: Date; validUntil: Date;
}, now = new Date()): string {
  if (code.status === "revoked") return "Zrušený";
  if (code.status === "expired" || code.validUntil <= now) return "Platnost skončila";
  if (code.status === "failed") return "Nepotvrzený v Nuki";
  if (code.validFrom > now) return "Čeká na začátek";
  return "Platný";
}
