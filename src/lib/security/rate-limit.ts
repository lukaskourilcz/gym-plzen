import { createHash } from "node:crypto";

interface WindowRecord {
  count: number;
  resetsAt: number;
}
const windows = new Map<string, WindowRecord>();
const MAX_WINDOWS = 10_000;
let nextCleanupAt = 0;

/**
 * Small process-local backstop for server actions. Supabase/Stripe rate limits
 * and an edge/WAF limit remain authoritative in a multi-instance deployment.
 */
export function takeRateLimit(
  scope: string,
  identifier: string,
  options: { limit: number; windowMs: number },
): boolean {
  const key = createHash("sha256")
    .update(`${scope}:${identifier}`)
    .digest("hex");
  const now = Date.now();
  if (now >= nextCleanupAt || windows.size >= MAX_WINDOWS) {
    for (const [storedKey, record] of windows)
      if (record.resetsAt <= now) windows.delete(storedKey);
    nextCleanupAt = now + 60_000;
  }
  const current = windows.get(key);
  if (!current && windows.size >= MAX_WINDOWS) return false;
  if (!current || current.resetsAt <= now) {
    windows.set(key, { count: 1, resetsAt: now + options.windowMs });
    return true;
  }
  if (current.count >= options.limit) return false;
  current.count += 1;
  return true;
}
