import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { profiles } from "./members";
import { bookingOrder, reservation } from "./reservations";
import { membershipStatus, paymentStatus, paymentType } from "./enums";

/**
 * A price selected by the moment the customer creates a reservation.
 *
 * `endsAt` is exclusive. The database migration also adds a GiST exclusion
 * constraint, so two periods can never overlap even when two administrators
 * save at the same time.
 */
export const pricingPeriod = pgTable(
  "pricing_period",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    priceCents: integer("price_cents").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
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
    check("pricing_period_price_positive", sql`${t.priceCents} > 0`),
    check("pricing_period_valid_range", sql`${t.endsAt} > ${t.startsAt}`),
    index("pricing_period_starts_at_idx").on(t.startsAt),
    index("pricing_period_created_by_admin_idx").on(t.createdByAdminId),
  ],
);

/**
 * A membership plan is an admin-editable product (name and price).
 * Members subscribe to a plan; the subscription state is recorded in payment history.
 */
export const membershipPlan = pgTable("membership_plan", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  priceCents: integer("price_cents").notNull(),
  currency: text("currency").default("czk").notNull(),
  // Billing interval for a historical plan ("month" | "week" | "year").
  interval: text("interval").notNull().default("month"),
  // Sessions included per interval; null = unlimited.
  sessionsPerInterval: integer("sessions_per_interval"),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** A member's subscription to a plan, managed by the operator. */
export const membership = pgTable(
  "membership",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    planId: uuid("plan_id").references(() => membershipPlan.id, {
      onDelete: "set null",
    }),
    status: membershipStatus("status").notNull().default("incomplete"),
    currentPeriodStart: timestamp("current_period_start"),
    currentPeriodEnd: timestamp("current_period_end"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    canceledAt: timestamp("canceled_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("membership_user_idx").on(t.userId)],
);

/**
 * A payment record : either a one-off session payment or a subscription
 * invoice. Card data never touches our system; we only store provider references.
 */
export const payment = pgTable(
  "payment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    reservationId: uuid("reservation_id").references(() => reservation.id, {
      onDelete: "set null",
    }),
    orderId: uuid("order_id").references(() => bookingOrder.id, {
      onDelete: "set null",
    }),
    membershipId: uuid("membership_id").references(() => membership.id, {
      onDelete: "set null",
    }),
    type: paymentType("type").notNull(),
    status: paymentStatus("status").notNull().default("pending"),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").default("czk").notNull(),
    provider: text("provider").notNull().default("legacy"),
    providerPaymentId: text("provider_payment_id"),
    providerMerchantId: text("provider_merchant_id"),
    providerEnvironment: text("provider_environment"),
    gatewayUrl: text("gateway_url"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    paidAt: timestamp("paid_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("payment_provider_id_uidx").on(t.provider, t.providerPaymentId),
    uniqueIndex("payment_active_reservation_uidx")
      .on(t.reservationId)
      .where(
        sql`${t.provider} = 'comgate' and ${t.status} in ('pending', 'processing', 'succeeded')`,
      ),
    uniqueIndex("payment_active_order_uidx")
      .on(t.orderId)
      .where(
        sql`${t.provider} = 'comgate' and ${t.status} in ('pending', 'processing', 'succeeded')`,
      ),
    index("payment_provider_check_idx").on(
      t.provider,
      t.status,
      t.lastCheckedAt,
    ),
    index("payment_user_idx").on(t.userId),
    index("payment_order_idx").on(t.orderId),
    index("payment_reservation_idx").on(t.reservationId),
    index("payment_reservation_created_id_idx").on(
      t.reservationId,
      t.createdAt.desc(),
      t.id.desc(),
    ),
  ],
);
