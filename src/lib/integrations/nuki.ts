import { hasEnv, requireEnv } from "@/lib/env";
import { httpRequest, HttpError } from "@/lib/helpers/http";
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
  pause: (ms: number) => Promise<void> = (ms) =>
    new Promise((r) => setTimeout(r, ms)),
) {
  const url = `${API_BASE}/smartlock/${config.lockId}/auth`;
  const headers = { authorization: `Bearer ${config.token}` };
  async function list() {
    return request<NukiAuth[]>(url, {
      headers,
      cache: "no-store",
      timeoutMs: 5000,
    });
  }
  async function recover(identity: CodeIdentity) {
    const matches = (await list()).filter(
      (auth) =>
        auth.type === NUKI_TYPE_KEYPAD &&
        String(auth.smartlockId) === config.lockId &&
        (!identity.nukiAuthId || auth.id === identity.nukiAuthId) &&
        /^[1-9]{6}$/.test(String(auth.code)) &&
        hashCode(String(auth.code)) === identity.codeHash &&
        Date.parse(auth.allowedFromDate ?? "") ===
          identity.allowedFrom.getTime() &&
        Date.parse(auth.allowedUntilDate ?? "") ===
          identity.allowedUntil.getTime(),
    );
    if (matches.length !== 1) return null;
    const auth = matches[0];
    if (
      !auth ||
      !auth.id ||
      !auth.enabled ||
      auth.operationId ||
      auth.error ||
      (auth.allowedWeekDays != null && auth.allowedWeekDays !== 127) ||
      (auth.allowedFromTime != null && auth.allowedFromTime !== 0) ||
      (auth.allowedUntilTime != null && auth.allowedUntilTime !== 0)
    )
      return null;
    return { nukiAuthId: auth.id, plaintext: String(auth.code) };
  }
  async function create(params: CreateCodeParams): Promise<CreateCodeResult> {
    if (
      !/^[1-9]{6}$/.test(String(params.code)) ||
      !Number.isFinite(params.allowedFrom.getTime()) ||
      !Number.isFinite(params.allowedUntil.getTime()) ||
      params.allowedFrom >= params.allowedUntil
    ) {
      return { created: false, error: "invalid_nuki_code_or_window" };
    }
    // Never repeat the mutation, even if its response is lost. GET can recover it.
    try {
      await request(url, {
        method: "PUT",
        headers,
        retries: 0,
        timeoutMs: 5000,
        json: {
          name: params.name.slice(0, 32),
          type: NUKI_TYPE_KEYPAD,
          code: params.code,
          remoteAllowed: false,
          allowedFromDate: params.allowedFrom.toISOString(),
          allowedUntilDate: params.allowedUntil.toISOString(),
          allowedWeekDays: 127,
          allowedFromTime: 0,
          allowedUntilTime: 0,
        },
      });
    } catch {
      // Outcome may be unknown; do not log the API body (it can contain a PIN).
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) await pause(1000);
      try {
        const result = await recover({
          ...params,
          codeHash: hashCode(String(params.code)),
        });
        if (result) return { created: true, nukiAuthId: result.nukiAuthId };
      } catch {
        /* The watchdog will reconcile without issuing another code. */
      }
    }
    return { created: false, error: "provisioning_unknown" };
  }
  return { create, recover };
}

function configuredClient() {
  const { NUKI_API_TOKEN, NUKI_SMARTLOCK_ID } = requireEnv(
    "NUKI_API_TOKEN",
    "NUKI_SMARTLOCK_ID",
  );
  return createNukiClient({ token: NUKI_API_TOKEN, lockId: NUKI_SMARTLOCK_ID });
}

export async function createKeypadCode(
  params: CreateCodeParams,
): Promise<CreateCodeResult> {
  if (!isNukiConfigured())
    return { created: false, error: "nuki_not_configured" };
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
  authId?: string;
  state?: number;
  source?: number;
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

/** Server-only admin read: no mutation, and no PINs in logs or persistent cache. */
export async function readKeypadCodes(): Promise<
  Array<{
    id: string;
    code: string;
    enabled: boolean;
    allowedFromDate?: string;
    allowedUntilDate?: string;
    allowedWeekDays?: number;
    allowedFromTime?: number;
    allowedUntilTime?: number;
    pending: boolean;
    rejected: boolean;
  }>
> {
  if (!isNukiConfigured()) throw new Error("Nuki not configured");
  const lockId = smartlockId();
  const auths = await httpRequest<NukiAuth[]>(
    `${API_BASE}/smartlock/${lockId}/auth`,
    {
      headers: authHeader(),
      cache: "no-store",
      timeoutMs: 5000,
    },
  );
  return auths
    .filter(
      (auth) =>
        auth.type === NUKI_TYPE_KEYPAD &&
        String(auth.smartlockId) === lockId &&
        /^[1-9]{6}$/.test(String(auth.code)),
    )
    .map((auth) => ({
      id: auth.id,
      code: String(auth.code),
      enabled: auth.enabled,
      allowedFromDate: auth.allowedFromDate,
      allowedUntilDate: auth.allowedUntilDate,
      allowedWeekDays: auth.allowedWeekDays,
      allowedFromTime: auth.allowedFromTime,
      allowedUntilTime: auth.allowedUntilTime,
      pending: Boolean(auth.operationId),
      rejected: Boolean(auth.error),
    }));
}

/** Paginate the retained activity history; never turn an API failure into "unused". */
export async function readKeypadUsageLog(
  from: Date,
): Promise<{ entries: NukiLogEntry[]; complete: boolean }> {
  if (!isNukiConfigured()) throw new Error("Nuki not configured");
  const entries: NukiLogEntry[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20; page++) {
    const query = new URLSearchParams({
      limit: "50",
      fromDate: from.toISOString(),
    });
    if (cursor) query.set("id", cursor);
    const batch = await httpRequest<NukiLogEntry[]>(
      `${API_BASE}/smartlock/${smartlockId()}/log?${query}`,
      { headers: authHeader(), cache: "no-store", timeoutMs: 5000, retries: 0 },
    );
    entries.push(...batch);
    if (batch.length < 50) return { entries, complete: true };
    const next = batch[batch.length - 1]?.id;
    if (!next || next === cursor) break;
    cursor = next;
  }
  return { entries, complete: false };
}

export type IntentInspection =
  | { state: "ready"; nukiAuthId: string; plaintext: string }
  | { state: "pending" | "absent" | "offline" | "conflict" }
  | { state: "rejected"; nukiAuthId: string };

/** A durable client never treats an unavailable/stale list as confirmed absence. */
export function createDurableNukiClient(
  config: { token: string; lockId: string },
  request: typeof httpRequest = httpRequest,
) {
  const base = `${API_BASE}/smartlock/${config.lockId}`;
  const headers = { authorization: `Bearer ${config.token}` };
  const read = <T>(path: string) =>
    request<T>(`${base}${path}`, {
      headers,
      cache: "no-store",
      timeoutMs: 5000,
    });
  async function inspect(identity: CodeIdentity): Promise<IntentInspection> {
    const device = await read<{ serverState: number }>("");
    if (device.serverState !== 0) return { state: "offline" };
    const auths = await read<NukiAuth[]>("/auth");
    const matches = auths.filter(
      (a) =>
        a.type === NUKI_TYPE_KEYPAD &&
        String(a.smartlockId) === config.lockId &&
        ((identity.nukiAuthId && a.id === identity.nukiAuthId) ||
          (a.code != null && hashCode(String(a.code)) === identity.codeHash)),
    );
    if (!matches.length) return { state: "absent" };
    if (matches.length !== 1) return { state: "conflict" };
    const a = matches[0]!;
    if (a.operationId) return { state: "pending" };
    if (a.error) return { state: "rejected", nukiAuthId: a.id };
    if (
      !a.id ||
      !a.enabled ||
      !a.code ||
      hashCode(String(a.code)) !== identity.codeHash ||
      Date.parse(a.allowedFromDate ?? "") !== identity.allowedFrom.getTime() ||
      Date.parse(a.allowedUntilDate ?? "") !==
        identity.allowedUntil.getTime() ||
      (a.allowedWeekDays != null && a.allowedWeekDays !== 127) ||
      (a.allowedFromTime != null && a.allowedFromTime !== 0) ||
      (a.allowedUntilTime != null && a.allowedUntilTime !== 0)
    )
      return { state: "conflict" };
    return { state: "ready", nukiAuthId: a.id, plaintext: String(a.code) };
  }
  async function submit(
    params: CreateCodeParams,
  ): Promise<"accepted" | "rejected" | "unknown"> {
    if (
      !/^[1-9]{6}$/.test(String(params.code)) ||
      String(params.code).startsWith("12")
    )
      return "rejected";
    try {
      await request(`${base}/auth`, {
        method: "PUT",
        headers,
        retries: 0,
        timeoutMs: 5000,
        json: {
          name: params.name.slice(0, 32),
          type: NUKI_TYPE_KEYPAD,
          code: params.code,
          remoteAllowed: false,
          allowedFromDate: params.allowedFrom.toISOString(),
          allowedUntilDate: params.allowedUntil.toISOString(),
          allowedWeekDays: 127,
          allowedFromTime: 0,
          allowedUntilTime: 0,
        },
      });
      return "accepted";
    } catch (error) {
      // Only definite validation/auth/rate-limit rejection permits resubmission.
      return error instanceof HttpError &&
        [400, 401, 403, 404, 422, 429].includes(error.status)
        ? "rejected"
        : "unknown";
    }
  }
  async function remove(id: string): Promise<boolean> {
    const device = await read<{ serverState: number }>("");
    if (device.serverState !== 0) return false;
    const before = await read<NukiAuth[]>("/auth");
    if (!before.some((a) => a.id === id)) return true;
    try {
      await request(`${base}/auth/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers,
        retries: 0,
        timeoutMs: 5000,
      });
    } catch {
      return false;
    }
    // API acceptance isn't revocation: require an online device and read-back.
    const afterDevice = await read<{ serverState: number }>("");
    return (
      afterDevice.serverState === 0 &&
      !(await read<NukiAuth[]>("/auth")).some((a) => a.id === id)
    );
  }
  return { inspect, submit, remove };
}
export function durableNukiClient(lockId: string) {
  return createDurableNukiClient({
    token: requireEnv("NUKI_API_TOKEN").NUKI_API_TOKEN,
    lockId,
  });
}

/** Connectivity reported by Nuki Cloud; does not prove physical door operation. */
export async function readLockConnectivity(): Promise<
  "online" | "offline" | "unknown"
> {
  if (!isNukiConfigured()) return "unknown";
  try {
    const device = await httpRequest<{ serverState?: number }>(
      `${API_BASE}/smartlock/${smartlockId()}`,
      {
        headers: authHeader(),
        cache: "no-store",
        timeoutMs: 5000,
        retries: 0,
      },
    );
    return device.serverState === 0
      ? "online"
      : typeof device.serverState === "number"
        ? "offline"
        : "unknown";
  } catch {
    return "unknown";
  }
}
