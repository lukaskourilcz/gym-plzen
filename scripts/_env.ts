/**
 * Load .env.local for standalone scripts (seed, set-admin). Next.js loads env
 * files automatically, but plain `tsx` runs do not : so scripts import this
 * first. Uses Node's built-in env-file loader (Node ≥ 20.12).
 */
import { existsSync } from "node:fs";

const loadEnvFile = (
  process as NodeJS.Process & {
    loadEnvFile?: (path: string) => void;
  }
).loadEnvFile;

for (const file of [".env.local", ".env"]) {
  if (existsSync(file) && loadEnvFile) {
    try {
      loadEnvFile(file);
    } catch {
      // ignore : variables may already be set in the environment.
    }
  }
}
