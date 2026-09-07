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
  name: string; // stable, non-personal label, at most 20 characters
  code: number; // 6-digit numeric code
  allowedFrom: Date;
  allowedUntil: Date;
}

export interface CreateCodeResult {
  created: boolean;
  nukiAuthId?: string;
  error?: string;
}

/** Stable, non-personal label fitting every Nuki keypad's 20-character limit. */
export function keypadCodeName(accessCodeId: string): string {
  return `NAVI-${accessCodeId.replaceAll("-", "").slice(0, 15)}`;
}

interface NukiAuth {
  id: string;
  name: string;
  type: number;
  enabled: boolean;
  operationId?: unknown;
  error?: string;
  allowedFromDate?: string;
  allowedUntilDate?: string;
}

async function listKeypadAuths(): Promise<NukiAuth[]> {
  return httpRequest<NukiAuth[]>(
    `${API_BASE}/smartlock/${smartlockId()}/auth?types=13`,
    { headers: authHeader(), timeoutMs: 5_000 },
  );
}

/** A 204 acknowledges a queued operation, not a working code on the lock. */
export async function createKeypadCode(
  params: CreateCodeParams,
): Promise<CreateCodeResult> {
  if (!isNukiConfigured()) return { created: false, error: "nuki_not_configured" };
  if (!/^[1-9]{6}$/.test(String(params.code)) || String(params.code).startsWith("12") ||
      params.name.length > 20 || params.allowedUntil <= params.allowedFrom) {
    return { created: false, error: "invalid_keypad_code" };
  }
  try {
    // Do not blindly retry a mutation after a lost response. The persisted,
    // unique name lets the next pipeline attempt find and revoke an orphan.
    await httpRequest(`${API_BASE}/smartlock/${smartlockId()}/auth`, {
      method: "PUT", headers: authHeader(), timeoutMs: 5_000,
      json: {
        name: params.name, type: NUKI_TYPE_KEYPAD, code: params.code,
        remoteAllowed: false,
        allowedFromDate: params.allowedFrom.toISOString(),
        allowedUntilDate: params.allowedUntil.toISOString(),
      },
    });
    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt) await new Promise((resolve) => setTimeout(resolve, 1_000));
      const auth = (await listKeypadAuths()).find((item) => item.name === params.name);
      if (auth?.error) return { created: false, nukiAuthId: auth.id, error: "nuki_operation_failed" };
      if (auth && !auth.operationId && auth.enabled && auth.type === NUKI_TYPE_KEYPAD &&
          Date.parse(auth.allowedFromDate ?? "") === params.allowedFrom.getTime() &&
          Date.parse(auth.allowedUntilDate ?? "") === params.allowedUntil.getTime()) {
        return { created: true, nukiAuthId: auth.id };
      }
    }
    return { created: false, error: "nuki_creation_unconfirmed" };
  } catch (error) {
    logger.error(error, { where: "nuki.createKeypadCode" });
    return { created: false, error: "nuki_creation_unconfirmed" };
  }
}

/** Resolve even a timed-out creation before replacing or cancelling its code. */
export async function revokeKeypadCode(params: {
  nukiAuthId: string | null;
  name: string;
}): Promise<boolean> {
  if (!isNukiConfigured()) return false;
  try {
    const auths = await listKeypadAuths();
    const matches = auths.filter((item) => item.id === params.nukiAuthId || item.name === params.name);
    if (!matches.length) {
      // An unresolved create can still be queued. Absence without a known ID
      // is ambiguous, so require operator reconciliation instead of guessing
      // a propagation deadline and issuing a second valid code.
      return Boolean(params.nukiAuthId);
    }
    if (matches.some((item) => item.operationId)) return false;
    for (const auth of matches) {
      await httpRequest(`${API_BASE}/smartlock/${smartlockId()}/auth/${encodeURIComponent(auth.id)}`, {
        method: "DELETE", headers: authHeader(), timeoutMs: 5_000,
      });
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt) await new Promise((resolve) => setTimeout(resolve, 1_000));
      const remaining = await listKeypadAuths();
      if (!remaining.some((item) => matches.some((match) => match.id === item.id))) return true;
    }
    return false;
  } catch (error) {
    logger.error(error, { where: "nuki.revokeKeypadCode" });
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
