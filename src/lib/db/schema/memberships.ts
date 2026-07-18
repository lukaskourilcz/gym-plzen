import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./members";
import { reservation } from "./reservations";
import { membershipStatus, paymentStatus, paymentType } from "./enums";

/**
 * A membership plan is an admin-editable product (name, price, Stripe price id).
 * Members subscribe to a plan; the subscription state is mirrored from Stripe.
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

/** A member's subscription to a plan, kept in sync via Stripe webhooks. */
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
 * A payment record — either a one-off session payment or a subscription
 * invoice. Card data never touches our system; we only mirror Stripe state.
 */
export const payment = pgTable(
  "payment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
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
  ],
);
