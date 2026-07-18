import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * `profiles` — the app's user table under **Supabase Auth**.
 *
 * Supabase owns the `auth.users` table (identity, credentials, OAuth). We keep
 * one `profiles` row per user, whose `id` equals the `auth.users` id (a uuid).
 * A trigger on `auth.users` inserts the profile on sign-up (see the profiles
 * migration), and the app also creates it lazily as a fallback. `email` and
 * `fullName` are mirrored here so member lists don't need to query the `auth`
 * schema.
 *
 * There is intentionally no cross-schema foreign key to `auth.users` (Supabase
 * manages that lifecycle); `id` is a logical link.
 */
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),

  // Mirrored from auth.users for convenient listing/joins.
  email: text("email"),
  fullName: text("full_name"),

  // Authorization: "admin" unlocks the administration.
  role: text("role").default("member").notNull(),

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
