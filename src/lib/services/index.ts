/**
 * Barrel for the service layer. Services hold business logic and are the only
 * layer that talks to the database and integrations. Server Actions and route
 * handlers call services : never the DB directly.
 *
 * Namespaced re-exports avoid name collisions between services that each expose
 * a `listRecent` / `getX`:
 *
 *   import { reservations, cms } from "@/lib/services";
 *   await reservations.listRecent();
 */
export * as availability from "./availability";
export * as reservations from "./reservations";
export * as rescheduling from "./rescheduling";
export * as booking from "./booking";
export * as slots from "./slots";
export * as stats from "./stats";
export * as accessCodes from "./access-codes";
export * as notifications from "./notifications";
export * as fulfillment from "./fulfillment";
export * as pipeline from "./pipeline";
export * as alerts from "./alerts";
export * as members from "./members";
export * as memberships from "./memberships";
export * as loyalty from "./loyalty";
export * as schedule from "./schedule";
export * as cms from "./cms";
export * as media from "./media";
export * as messages from "./messages";
export * as emailTemplates from "./email-templates";
export * as entryLog from "./entry-log";
export * as vouchers from "./vouchers";
export * as newsletter from "./newsletter";
