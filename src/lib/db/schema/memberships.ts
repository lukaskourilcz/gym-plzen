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
import { membershipStatus, paymentStatus, paymentType } from "./enums";

/**
 * Legacy subscription tables retained so existing databases and migrations
 * remain compatible. The application no longer creates or manages plans.
 */
export const membershipPlan = pgTable("membership_plan", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  priceCents: integer("price_cents").notNull(),
  currency: text("currency").default("czk").notNull(),
  // Billing interval as understood by Stripe ("month" | "week" | "year").
  interval: text("interval").notNull().default("month"),
  stripePriceId: text("stripe_price_id").unique(),
  stripeProductId: text("stripe_product_id"),
  // Sessions included per interval; null = unlimited.
  sessionsPerInterval: integer("sessions_per_interval"),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Legacy subscription rows; not used by the one-off-entry application flow. */
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
    stripeSubscriptionId: text("stripe_subscription_id").unique(),
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
 * A reservation payment record. Card data never touches our system; we mirror
 * only Stripe Checkout identifiers and payment state.
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
    membershipId: uuid("membership_id").references(() => membership.id, {
      onDelete: "set null",
    }),
    type: paymentType("type").notNull(),
    status: paymentStatus("status").notNull().default("pending"),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").default("czk").notNull(),
    stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
    stripeInvoiceId: text("stripe_invoice_id"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    failureReason: text("failure_reason"),
    paidAt: timestamp("paid_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("payment_user_idx").on(t.userId),
    index("payment_reservation_idx").on(t.reservationId),
    uniqueIndex("payment_checkout_session_uidx").on(t.stripeCheckoutSessionId),
  ],
);
