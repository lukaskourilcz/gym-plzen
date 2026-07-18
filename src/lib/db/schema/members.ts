import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Extended member profile — everything about a customer that Better Auth's
 * `user` table does not hold. One row per user, keyed by `user.id`.
 *
 * Kept separate from the auth `user` table so the auth schema stays a clean
 * mirror of the library and so GDPR-relevant fields (consents, phone) live in
 * one auditable place.
 */
export const memberProfile = pgTable("member_profile", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),

  // Contact — phone is E.164, required for WhatsApp/SMS code delivery.
  phone: text("phone"),
  phoneVerified: boolean("phone_verified").default(false).notNull(),

  // Stripe customer handle (created lazily on first checkout).
  stripeCustomerId: text("stripe_customer_id").unique(),

  // Notification channel preferences (email is always on).
  notifyByWhatsapp: boolean("notify_by_whatsapp").default(true).notNull(),
  notifyBySms: boolean("notify_by_sms").default(false).notNull(),

  // GDPR — explicit, timestamped consents.
  marketingConsent: boolean("marketing_consent").default(false).notNull(),
  marketingConsentAt: timestamp("marketing_consent_at"),
  termsAcceptedAt: timestamp("terms_accepted_at"),

  note: text("note"), // internal admin note, not shown to the member

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
