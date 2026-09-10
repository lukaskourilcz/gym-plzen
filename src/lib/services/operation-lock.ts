import { AsyncLocalStorage } from "node:async_hooks";
import postgres from "postgres";
import { requireEnv } from "@/lib/env";

// Separate pool: provider requests cannot exhaust the ordinary query pool.
// Transaction locks work through Supabase's transaction pooler as well.
let locks: ReturnType<typeof postgres> | undefined;
const held = new AsyncLocalStorage<ReadonlySet<string>>();

export async function withOperationLock<T>(
  key: string,
  work: () => Promise<T>,
): Promise<T> {
  if (held.getStore()?.has(key)) return work();
  locks ??= postgres(requireEnv("DATABASE_URL").DATABASE_URL, {
    prepare: false,
    max: 2,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return locks.begin(async (tx) => {
    await tx`set local lock_timeout = '5s'`;
    await tx`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
    // Business writes commit independently: never roll back a provider intent
    // after that provider may have performed an external side effect.
    return held.run(new Set([...(held.getStore() ?? []), key]), work);
  }) as Promise<T>;
}

export function withReservationLock<T>(id: string, work: () => Promise<T>) {
  return withOperationLock(`reservation:${id}`, work);
}
