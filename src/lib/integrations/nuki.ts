import { hasEnv, requireEnv } from "@/lib/env";
import { httpRequest } from "@/lib/helpers/http";
import { hashCode } from "@/lib/helpers/crypto";
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

function isNukiConfigured(): boolean {
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

interface NukiKeypadAuthorization {
  id: string | number;
  code?: number;
  type?: number;
}

async function listKeypadAuthorizations(): Promise<NukiKeypadAuthorization[]> {
  return httpRequest<NukiKeypadAuthorization[]>(
    `${API_BASE}/smartlock/${smartlockId()}/auth?types=${NUKI_TYPE_KEYPAD}`,
    { headers: authHeader(), timeoutMs: 7_000, retries: 1 },
  );
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveKeypadAuthId(
  codeHash: string,
  attempts = 3,
): Promise<string | undefined> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) await wait(attempt * 750);
    const authorizations = await listKeypadAuthorizations();
    const match = authorizations.find(
      (authorization) =>
        authorization.type === NUKI_TYPE_KEYPAD &&
        authorization.code != null &&
        hashCode(String(authorization.code).padStart(6, "0")) === codeHash,
    );
    if (match) return String(match.id);
  }
  return undefined;
}

/**
 * Create a time-limited keypad code on the lock. Nuki expects the code as a
 * number and times as ISO strings; the window uses `allowedFromDate`/
 * `allowedUntilDate`. A 204 response is only an acceptance signal, so the
 * authorization is read back before the code is considered provisioned.
 */
export async function createKeypadCode(
  params: CreateCodeParams,
): Promise<CreateCodeResult> {
  if (!isNukiConfigured()) {
    logger.warn("Nuki not configured : keypad code not created");
    return { created: false, error: "nuki_not_configured" };
  }
  try {
    await httpRequest(`${API_BASE}/smartlock/${smartlockId()}/auth`, {
      method: "PUT",
      headers: authHeader(),
      retries: 2,
      json: {
        name: params.name,
        type: NUKI_TYPE_KEYPAD,
        code: params.code,
        allowedFromDate: params.allowedFrom.toISOString(),
        allowedUntilDate: params.allowedUntil.toISOString(),
        allowedWeekDays: 0,
      },
    });
    const id = await resolveKeypadAuthId(hashCode(String(params.code)));
    return id
      ? { created: true, nukiAuthId: id }
      : { created: false, error: "nuki_auth_not_confirmed" };
  } catch (e) {
    logger.error(e, { where: "nuki.createKeypadCode" });
    return {
      created: false,
      error: e instanceof Error ? e.message : "unknown",
    };
  }
}

/** Resolve an authorization later when the asynchronous create was delayed. */
export async function findKeypadAuthIdByHash(
  codeHash: string,
): Promise<string | undefined> {
  if (!isNukiConfigured()) return undefined;
  try {
    return await resolveKeypadAuthId(codeHash, 1);
  } catch (e) {
    logger.error(e, { where: "nuki.findKeypadAuthIdByHash" });
    return undefined;
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
