import { AsyncLocalStorage } from "node:async_hooks";
import postgres from "postgres";
import { requireEnv } from "@/lib/env";

// Separate pool: provider requests cannot exhaust the ordinary query pool.
// Transaction locks work through Supabase's transaction pooler as well.
let locks: ReturnType<typeof postgres> | undefined;
type LockContext = {
  keys: ReadonlySet<string>;
  tx: postgres.TransactionSql<Record<string, never>>;
  siblings: Map<string, Promise<void>>;
};
const held = new AsyncLocalStorage<LockContext>();

/*
 * A locked operation keeps its connection for the whole provider round trip
 * (Comgate create/status, later Nuki), typically one to three seconds. Two
 * customers paying while the watchdog reconciles already needs three; the
 * pool has no acquisition timeout, so a too-small pool turns into unexplained
 * multi-second submits rather than an error. Five covers the realistic
 * concurrency of one instance while staying well inside the Supabase pooler.
 */
const LOCK_POOL_SIZE = 5;

export async function withOperationLock<T>(
  key: string,
  work: () => Promise<T>,
): Promise<T> {
  const context = held.getStore();
  if (context?.keys.has(key)) return work();
  if (context) {
    // Keep one connection for the complete call chain. Otherwise five outer
    // operations can consume the pool and all wait forever for nested locks.
    // Sibling calls still need a local queue: a transaction's advisory lock
    // is reentrant, so the DB alone cannot serialize those siblings.
    const previous = context.siblings.get(key);
    let release!: () => void;
    const finished = new Promise<void>((resolve) => {
      release = resolve;
    });
    context.siblings.set(key, finished);
    try {
      await previous;
      await context.tx`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
      return await held.run(
        { ...context, keys: new Set([...context.keys, key]) },
        work,
      );
    } finally {
      release();
      if (context.siblings.get(key) === finished) context.siblings.delete(key);
    }
  }
  locks ??= postgres(requireEnv("DATABASE_URL").DATABASE_URL, {
    prepare: false,
    max: LOCK_POOL_SIZE,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return locks.begin(async (tx) => {
    await tx`set local lock_timeout = '5s'`;
    await tx`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
    // Business writes commit independently: never roll back a provider intent
    // after that provider may have performed an external side effect.
    return held.run({ keys: new Set([key]), tx, siblings: new Map() }, work);
  }) as Promise<T>;
}

export function withReservationLock<T>(id: string, work: () => Promise<T>) {
  return withOperationLock(`reservation:${id}`, work);
}
