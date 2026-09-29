import { createHash } from "node:crypto";

interface WindowRecord {
  count: number;
  resetsAt: number;
}
export function createRateLimiter({
  maxRecords = 10_000,
  now = Date.now,
}: { maxRecords?: number; now?: () => number } = {}) {
  const windows = new Map<string, WindowRecord>();
  let nextSweepAt = 0;
  return (
    scope: string,
    identifier: string,
    options: { limit: number; windowMs: number },
  ): boolean => {
    if (options.limit < 1 || options.windowMs <= 0) return false;
    const instant = now();
    if (instant >= nextSweepAt || windows.size >= maxRecords) {
      for (const [key, record] of windows)
        if (record.resetsAt <= instant) windows.delete(key);
      nextSweepAt = instant + 60_000;
    }
    const key = createHash("sha256")
      .update(`${scope}:${identifier}`)
      .digest("hex");
    const current = windows.get(key);
    if (!current || current.resetsAt <= instant) {
      // Never evict a live block to make room: that would let an attacker
      // repeatedly regain their allowance by filling the cache.
      if (!current && windows.size >= maxRecords) return false;
      windows.set(key, { count: 1, resetsAt: instant + options.windowMs });
      return true;
    }
    if (current.count >= options.limit) return false;
    current.count += 1;
    return true;
  };
}

/**
 * Small process-local backstop for server actions. Supabase/Comgate rate limits
 * and an edge/WAF limit remain authoritative in a multi-instance deployment.
 */
export const takeRateLimit = createRateLimiter();
