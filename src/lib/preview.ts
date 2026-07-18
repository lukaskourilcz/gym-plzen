import { env } from "@/lib/env";
import { publicEnv, supabasePublicKey } from "@/lib/public-env";
import type { SessionUser } from "@/lib/auth/guards";

/**
 * Client-preview mode ("režim náhledu") — lets the whole app run with NO
 * Supabase, database, or login, so the site and administration can be shown
 * to the client before any external platform is linked.
 *
 * While active:
 *   - `getSessionUser()` returns {@link PREVIEW_ADMIN} — no login anywhere;
 *   - the `db` export is a stub that throws {@link PreviewDbError} on use, so
 *     pages fall back to their demo data (DummyJSON) instead of crashing;
 *   - server actions catch {@link PreviewDbError} and answer with a friendly
 *     "saving is disabled in preview" message;
 *   - a "Náhled" ribbon renders site-wide (components/preview-ribbon.tsx).
 *
 * Activation (server-only):
 *   - `PREVIEW_MODE=1|true`  → force ON (even with a database — careful);
 *   - `PREVIEW_MODE=0|false` → force OFF;
 *   - unset → automatic: ON only while BOTH the database and Supabase Auth
 *     are unconfigured. The moment real credentials land in env, preview
 *     turns itself off and normal auth takes over — nothing to undo.
 */

/** The synthetic admin identity used while preview mode is active. */
export const PREVIEW_ADMIN: SessionUser = {
  id: "00000000-0000-4000-8000-00000000cafe",
  email: "nahled@gym-plzen.cz",
  name: "Náhled — administrátor",
  role: "admin",
};

/** True while the no-login client preview is active. */
export function isPreviewMode(): boolean {
  const flag = env.PREVIEW_MODE?.trim().toLowerCase();
  if (flag === "1" || flag === "true") return true;
  if (flag === "0" || flag === "false") return false;

  const dbConfigured = Boolean(env.DATABASE_URL);
  const authConfigured = Boolean(publicEnv.NEXT_PUBLIC_SUPABASE_URL && supabasePublicKey);
  return !dbConfigured && !authConfigured;
}

/**
 * Thrown (synchronously) by the stub `db` when preview mode runs without a
 * database. Pages and actions treat it as "use demo data / refuse politely".
 */
export class PreviewDbError extends Error {
  constructor() {
    super(
      "Databáze není připojena (režim náhledu). Data jsou ukázková a ukládání je vypnuté.",
    );
    this.name = "PreviewDbError";
  }
}

/** User-facing message for write attempts while previewing. */
export const PREVIEW_WRITE_MESSAGE =
  "Režim náhledu: ukládání je vypnuté. Vše se zapne po připojení databáze a Supabase.";
