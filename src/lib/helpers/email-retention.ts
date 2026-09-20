/** Exact rolling window; daylight-saving changes do not extend retention. */
export const EMAIL_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export function emailRetentionCutoff(now = new Date()): Date {
  return new Date(now.getTime() - EMAIL_RETENTION_MS);
}
export function isEmailRetained(sentAt: Date, now = new Date()): boolean {
  return sentAt > emailRetentionCutoff(now) && sentAt <= now;
}
