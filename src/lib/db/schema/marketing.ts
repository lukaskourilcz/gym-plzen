import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./members";
import { reservation } from "./reservations";
import {
  newsletterSubscriptionStatus,
  voucherKind,
  voucherRedemptionStatus,
} from "./enums";

/** Admin-created discount code for a one-off reservation. */
export const voucher = pgTable(
  "voucher",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    kind: voucherKind("kind").notNull(),
    // Percentage points for percentage vouchers, haléř for fixed vouchers.
    value: integer("value").notNull(),
    maxRedemptions: integer("max_redemptions"),
    isActive: boolean("is_active").default(true).notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true }),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    createdByAdminId: uuid("created_by_admin_id").references(
      () => profiles.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("voucher_code_normalized_uidx").on(sql`upper(${t.code})`),
    index("voucher_active_validity_idx").on(
      t.isActive,
      t.validFrom,
      t.validUntil,
    ),
  ],
);

/** Audit record connecting a voucher claim to exactly one reservation. */
export const voucherRedemption = pgTable(
  "voucher_redemption",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    voucherId: uuid("voucher_id")
      .notNull()
      .references(() => voucher.id, { onDelete: "restrict" }),
    reservationId: uuid("reservation_id")
      .notNull()
      .references(() => reservation.id, { onDelete: "cascade" }),
    status: voucherRedemptionStatus("status").notNull().default("reserved"),
    originalPriceCents: integer("original_price_cents").notNull(),
    discountCents: integer("discount_cents").notNull(),
    finalPriceCents: integer("final_price_cents").notNull(),
    reservedUntil: timestamp("reserved_until", {
      withTimezone: true,
    }).notNull(),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("voucher_redemption_reservation_uidx").on(t.reservationId),
    index("voucher_redemption_voucher_status_idx").on(t.voucherId, t.status),
    index("voucher_redemption_reserved_until_idx").on(t.reservedUntil),
  ],
);

/** Email addresses collected by the public newsletter form. */
export const newsletterSubscriber = pgTable(
  "newsletter_subscriber",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    status: newsletterSubscriptionStatus("status")
      .notNull()
      .default("subscribed"),
    source: text("source").notNull().default("homepage"),
    consentedAt: timestamp("consented_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("newsletter_subscriber_email_normalized_uidx").on(t.email),
    index("newsletter_subscriber_status_created_idx").on(t.status, t.createdAt),
  ],
);
