import { env } from "@/lib/env";
import { safeEqual } from "./crypto";

/**
 * Authorize a cron request. Vercel Cron sends `Authorization: Bearer <secret>`;
 * we compare it (constant-time) against CRON_SECRET. Returns true when allowed.
 */
export function isAuthorizedCron(request: Request): boolean {
  if (!env.CRON_SECRET) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "");
  return safeEqual(token, env.CRON_SECRET);
}
