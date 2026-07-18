/**
 * Barrel export for the full database schema. Import tables from here so the
 * drizzle client and app code share one source of truth:
 *
 *   import { reservation, user } from "@/lib/db/schema";
 */
export * from "./auth";
export * from "./enums";
export * from "./members";
export * from "./reservations";
export * from "./memberships";
export * from "./access";
export * from "./messaging";
export * from "./cms";
export * from "./system";
