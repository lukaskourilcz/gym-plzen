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

// postgres.js connects lazily. This local fallback lets Next.js evaluate route
// modules during builds without opening a connection. Public pages already
// catch unavailable-database errors and show their demo/default state.
const databaseUrl =
  env.DATABASE_URL ??
  "postgres://unconfigured:unconfigured@127.0.0.1:5432/unconfigured?connect_timeout=1";

// `prepare: false` is required when connecting through the Supabase transaction
// pooler (pgbouncer), which does not support prepared statements.
const sql =
  globalForDb.__sql ??
  postgres(databaseUrl, {
    prepare: false,
    max: env.NODE_ENV === "production" ? 10 : 5,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    connect_timeout: 10,
  });

if (env.NODE_ENV !== "production") globalForDb.__sql = sql;

export const db = drizzle(sql, { schema });

export type Database = typeof db;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DatabaseExecutor = Database | Transaction;
export { schema };
