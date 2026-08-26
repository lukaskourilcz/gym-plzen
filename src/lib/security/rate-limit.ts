import { createHash } from "node:crypto";

interface WindowRecord {
  count: number;
  resetsAt: number;
}
const windows = new Map<string, WindowRecord>();
const MAX_TRACKED_WINDOWS = 10_000;
const CLEANUP_INTERVAL = 256;
let windowsCreatedSinceCleanup = 0;

function pruneWindows(now: number): void {
  for (const [key, record] of windows) {
    if (record.resetsAt <= now) windows.delete(key);
  }
  windowsCreatedSinceCleanup = 0;
}

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
  const current = windows.get(key);
  if (!current || current.resetsAt <= now) {
    windowsCreatedSinceCleanup += 1;
    if (
      windowsCreatedSinceCleanup >= CLEANUP_INTERVAL ||
      windows.size >= MAX_TRACKED_WINDOWS
    ) {
      pruneWindows(now);
    }
    if (windows.size >= MAX_TRACKED_WINDOWS) {
      const oldestKey = windows.keys().next().value as string | undefined;
      if (oldestKey) windows.delete(oldestKey);
    }
    windows.set(key, { count: 1, resetsAt: now + options.windowMs });
    return true;
  }
  if (current.count >= options.limit) return false;
  current.count += 1;
  return true;
}
