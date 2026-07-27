import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env.local" });

/**
 * drizzle-kit configuration. Migrations run against DIRECT_URL (the non-pooled
 * Supabase connection on port 5432) because DDL through pgbouncer is unreliable;
 * we fall back to DATABASE_URL when DIRECT_URL is not set.
 */
export default defineConfig({
  schema: "./src/lib/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  strict: true,
});
