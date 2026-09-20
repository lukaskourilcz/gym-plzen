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

export interface CodeIdentity {
  codeHash: string;
  allowedFrom: Date;
  allowedUntil: Date;
  nukiAuthId?: string | null;
}

interface NukiAuth {
  id: string;
  smartlockId: number;
  type: number;
  code?: number;
  enabled: boolean;
  allowedFromDate?: string;
  allowedUntilDate?: string;
  allowedWeekDays?: number;
  allowedFromTime?: number;
  allowedUntilTime?: number;
  operationId?: unknown;
  error?: string;
}

/** Read back the actual authorization. An accepted PUT alone is not success. */
export function createNukiClient(
  config: { token: string; lockId: string },
  request: typeof httpRequest = httpRequest,
  pause: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
) {
  const url = `${API_BASE}/smartlock/${config.lockId}/auth`;
  const headers = { authorization: `Bearer ${config.token}` };
  async function list() {
    return request<NukiAuth[]>(url, { headers, cache: "no-store", timeoutMs: 5000 });
  }
  async function recover(identity: CodeIdentity) {
    const matches = (await list()).filter((auth) =>
      auth.type === NUKI_TYPE_KEYPAD &&
      String(auth.smartlockId) === config.lockId &&
      (!identity.nukiAuthId || auth.id === identity.nukiAuthId) &&
      /^[1-9]{6}$/.test(String(auth.code)) &&
      hashCode(String(auth.code)) === identity.codeHash &&
      Date.parse(auth.allowedFromDate ?? "") === identity.allowedFrom.getTime() &&
      Date.parse(auth.allowedUntilDate ?? "") === identity.allowedUntil.getTime(),
    );
    if (matches.length !== 1) return null;
    const auth = matches[0];
    if (!auth || !auth.id || !auth.enabled || auth.operationId || auth.error ||
        (auth.allowedWeekDays != null && auth.allowedWeekDays !== 127) ||
        (auth.allowedFromTime != null && auth.allowedFromTime !== 0) ||
        (auth.allowedUntilTime != null && auth.allowedUntilTime !== 0)) return null;
    return { nukiAuthId: auth.id, plaintext: String(auth.code) };
  }
  async function create(params: CreateCodeParams): Promise<CreateCodeResult> {
    if (!/^[1-9]{6}$/.test(String(params.code)) ||
        !Number.isFinite(params.allowedFrom.getTime()) ||
        !Number.isFinite(params.allowedUntil.getTime()) ||
        params.allowedFrom >= params.allowedUntil) {
      return { created: false, error: "invalid_nuki_code_or_window" };
    }
    // Never repeat the mutation, even if its response is lost. GET can recover it.
    try {
      await request(url, {
        method: "PUT", headers, retries: 0, timeoutMs: 5000,
        json: {
          name: params.name.slice(0, 32), type: NUKI_TYPE_KEYPAD,
          code: params.code, remoteAllowed: false,
          allowedFromDate: params.allowedFrom.toISOString(),
          allowedUntilDate: params.allowedUntil.toISOString(),
          allowedWeekDays: 127, allowedFromTime: 0, allowedUntilTime: 0,
        },
      });
    } catch {
      // Outcome may be unknown; do not log the API body (it can contain a PIN).
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) await pause(1000);
      try {
        const result = await recover({ ...params, codeHash: hashCode(String(params.code)) });
        if (result) return { created: true, nukiAuthId: result.nukiAuthId };
      } catch { /* The watchdog will reconcile without issuing another code. */ }
    }
    return { created: false, error: "provisioning_unknown" };
  }
  return { create, recover };
}

function configuredClient() {
  const { NUKI_API_TOKEN, NUKI_SMARTLOCK_ID } = requireEnv("NUKI_API_TOKEN", "NUKI_SMARTLOCK_ID");
  return createNukiClient({ token: NUKI_API_TOKEN, lockId: NUKI_SMARTLOCK_ID });
}

export async function createKeypadCode(params: CreateCodeParams): Promise<CreateCodeResult> {
  if (!isNukiConfigured()) return { created: false, error: "nuki_not_configured" };
  return configuredClient().create(params);
}

/** Recover plaintext only from a matching, synced Nuki authorization, never storage. */
export async function recoverKeypadCode(identity: CodeIdentity) {
  if (!isNukiConfigured()) return null;
  return configuredClient().recover(identity);
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
    // Deletion is asynchronous too. Do not release the reservation until the
    // authorization has actually disappeared from the device's synced state.
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) await new Promise((resolve) => setTimeout(resolve, 1000));
      const auths = await httpRequest<NukiAuth[]>(
        `${API_BASE}/smartlock/${smartlockId()}/auth`,
        { headers: authHeader(), cache: "no-store", timeoutMs: 5000 },
      );
      if (!auths.some((auth) => auth.id === nukiAuthId)) return true;
    }
    return false;
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
