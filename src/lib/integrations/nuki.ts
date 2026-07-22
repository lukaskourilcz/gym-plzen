import { hasEnv, requireEnv } from "@/lib/env";
import { httpRequest } from "@/lib/helpers/http";
import { logger } from "@/lib/helpers/logger";

/**
 * Nuki Web API adapter : creates/removes time-limited keypad codes and reads
 * the lock activity log.
 *
 * A keypad code is a "smartlock auth" of type keypad (typeId 13) with an
 * allowed time window. Docs: https://api.nuki.io/
 */

const API_BASE = "https://api.nuki.io";

/** Nuki auth type for a keypad (numeric) code. */
const NUKI_TYPE_KEYPAD = 13;

export function isNukiConfigured(): boolean {
  return hasEnv("NUKI_API_TOKEN", "NUKI_SMARTLOCK_ID");
}

function authHeader(): Record<string, string> {
  const { NUKI_API_TOKEN } = requireEnv("NUKI_API_TOKEN");
  return { authorization: `Bearer ${NUKI_API_TOKEN}` };
}

function smartlockId(): string {
  const { NUKI_SMARTLOCK_ID } = requireEnv("NUKI_SMARTLOCK_ID");
  return NUKI_SMARTLOCK_ID;
}

export interface CreateCodeParams {
  name: string; // shown in the lock log, e.g. "Rez. #1234 – Jan Novák"
  code: number; // 6-digit numeric code
  allowedFrom: Date;
  allowedUntil: Date;
}

export interface CreateCodeResult {
  created: boolean;
  nukiAuthId?: string;
  error?: string;
}

/**
 * Create a time-limited keypad code on the lock. Nuki expects the code as a
 * number and times as ISO strings; the window uses `allowedFromDate`/
 * `allowedUntilDate`.
 */
export async function createKeypadCode(
  params: CreateCodeParams,
): Promise<CreateCodeResult> {
  if (!isNukiConfigured()) {
    logger.warn("Nuki not configured : keypad code not created");
    return { created: false, error: "nuki_not_configured" };
  }
  try {
    const res = await httpRequest<{ id?: string } | unknown>(
      `${API_BASE}/smartlock/${smartlockId()}/auth`,
      {
        method: "PUT",
        headers: authHeader(),
        retries: 2,
        json: {
          name: params.name,
          type: NUKI_TYPE_KEYPAD,
          code: params.code,
          allowedFromDate: params.allowedFrom.toISOString(),
          allowedUntilDate: params.allowedUntil.toISOString(),
        },
      },
    );
    // The PUT auth endpoint is asynchronous; the created auth id is resolved by
    // listing auths or via callback. We return whatever id came back if any.
    const id =
      res && typeof res === "object" && "id" in res
        ? String((res as { id: unknown }).id)
        : undefined;
    return { created: true, nukiAuthId: id };
  } catch (e) {
    logger.error(e, { where: "nuki.createKeypadCode" });
    return {
      created: false,
      error: e instanceof Error ? e.message : "unknown",
    };
  }
}

/** Remove a previously created keypad code (revocation / cleanup). */
export async function deleteAuth(nukiAuthId: string): Promise<boolean> {
  if (!isNukiConfigured()) return false;
  try {
    await httpRequest(
      `${API_BASE}/smartlock/${smartlockId()}/auth/${nukiAuthId}`,
      {
        method: "DELETE",
        headers: authHeader(),
        retries: 2,
      },
    );
    return true;
  } catch (e) {
    logger.error(e, { where: "nuki.deleteAuth", nukiAuthId });
    return false;
  }
}

export interface NukiLogEntry {
  id: string;
  name?: string;
  action?: number;
  trigger?: number;
  date: string;
}

/** Fetch recent lock log entries (used to populate the entry book). */
export async function fetchLog(limit = 50): Promise<NukiLogEntry[]> {
  if (!isNukiConfigured()) return [];
  try {
    return await httpRequest<NukiLogEntry[]>(
      `${API_BASE}/smartlock/${smartlockId()}/log?limit=${limit}`,
      { headers: authHeader(), retries: 2 },
    );
  } catch (e) {
    logger.error(e, { where: "nuki.fetchLog" });
    return [];
  }
}
