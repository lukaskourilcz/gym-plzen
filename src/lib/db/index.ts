import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * Drizzle database client, backed by the `postgres` (postgres.js) driver
 * against Supabase Postgres.
 *
 * In development, Next.js hot-reload would otherwise open a new pool on every
 * change, so we cache the client on `globalThis`.
 */

const globalForDb = globalThis as unknown as {
  __sql?: ReturnType<typeof postgres>;
};

// `prepare: false` is required when connecting through the Supabase transaction
// pooler (pgbouncer), which does not support prepared statements.
const sql =
  globalForDb.__sql ??
  postgres(env.DATABASE_URL, {
    prepare: false,
    max: env.NODE_ENV === "production" ? 10 : 1,
  });

if (env.NODE_ENV !== "production") globalForDb.__sql = sql;

export const db = drizzle(sql, { schema });

export type Database = typeof db;
export { schema };
