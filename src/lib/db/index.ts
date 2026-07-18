import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import { PreviewDbError } from "@/lib/preview";
import * as schema from "./schema";

/**
 * Drizzle database client, backed by the `postgres` (postgres.js) driver
 * against Supabase Postgres.
 *
 * In development, Next.js hot-reload would otherwise open a new pool on every
 * change, so we cache the client on `globalThis`.
 *
 * When DATABASE_URL is not set (client-preview mode, see src/lib/preview.ts),
 * `db` is a stub that throws `PreviewDbError` the moment anything touches it —
 * no sockets, no timeouts. Callers already treat DB failures as "fall back to
 * defaults/demo data", so the preview renders instantly instead of hanging on
 * a connection attempt.
 */

const globalForDb = globalThis as unknown as {
  __sql?: ReturnType<typeof postgres>;
};

function createDb(connectionString: string) {
  // `prepare: false` is required when connecting through the Supabase
  // transaction pooler (pgbouncer), which does not support prepared statements.
  const sql =
    globalForDb.__sql ??
    postgres(connectionString, {
      prepare: false,
      max: env.NODE_ENV === "production" ? 10 : 1,
    });
  if (env.NODE_ENV !== "production") globalForDb.__sql = sql;
  return drizzle(sql, { schema });
}

type Db = ReturnType<typeof createDb>;

function createPreviewDbStub(): Db {
  return new Proxy(Object.create(null), {
    get(_target, prop) {
      // Stay inert for runtime introspection (await, logging, spreads).
      if (typeof prop === "symbol" || prop === "then") return undefined;
      throw new PreviewDbError();
    },
  }) as Db;
}

export const db: Db = env.DATABASE_URL ? createDb(env.DATABASE_URL) : createPreviewDbStub();

export type Database = typeof db;
export { schema };
