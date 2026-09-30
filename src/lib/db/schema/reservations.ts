import { sql } from "drizzle-orm";
import {
  index,
  boolean,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./members";
import { voucher } from "./marketing";
import { blockReason, bookingOrderStatus, reservationStatus } from "./enums";

/**
 * One checkout of one or more reservations, paid by a single payment. The
 * reservation stays the unit of a training slot (access code, pipeline,
 * rescheduling and cancellation are per reservation); the order is the unit
 * of purchase: one payment, one document, one voucher, one confirmation.
 * Reservations created before orders existed, and admin walk-ins, have none.
 */
export const bookingOrder = pgTable(
  "booking_order",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    status: bookingOrderStatus("status").notNull().default("pending"),
    totalCents: integer("total_cents").notNull(),
    currency: text("currency").default("czk").notNull(),

    // Contact snapshot shared by every reservation of the order.
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),

    confirmationTokenHash: text("confirmation_token_hash"),
    voucherId: uuid("voucher_id").references(() => voucher.id, {
      onDelete: "restrict",
    }),

    rulesAcceptedAt: timestamp("rules_accepted_at", { withTimezone: true }),
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),

    createdByAdminId: uuid("created_by_admin_id").references(
      () => profiles.id,
      {
        onDelete: "set null",
      },
    ),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("booking_order_user_created_id_idx").on(
      t.userId,
      t.createdAt.desc(),
      t.id.desc(),
    ),
    index("booking_order_status_created_idx").on(t.status, t.createdAt),
    index("booking_order_voucher_idx").on(t.voucherId),
    index("booking_order_created_by_admin_idx").on(t.createdByAdminId),
  ],
);

/**
 * A reservation is a single training slot. The gym holds one person at a time,
 * so overlap prevention is the central invariant : enforced in the service
 * layer (see lib/services/reservations.ts) and backed by an exclusion
 * constraint added in a migration (see NEEDED.md / drizzle notes).
 */
export const reservation = pgTable(
  "reservation",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Null for admin-created walk-in bookings without an account.
    userId: uuid("user_id").references(() => profiles.id, {
      onDelete: "set null",
    }),

    // The checkout this slot was bought in; null for older rows and walk-ins.
    orderId: uuid("order_id").references(() => bookingOrder.id, {
      onDelete: "set null",
    }),

    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),

    // A move holds both windows until the new access is verified. An abandoned
    // intent is cleaned up before the original window can be fulfilled again.
    rescheduleStartsAt: timestamp("reschedule_starts_at", {
      withTimezone: true,
    }),
    rescheduleEndsAt: timestamp("reschedule_ends_at", { withTimezone: true }),

    status: reservationStatus("status").notNull().default("pending"),
    accessRevocationPending: boolean("access_revocation_pending")
      .notNull()
      .default(false),
    confirmationTokenHash: text("confirmation_token_hash"),
    loyaltyReward: integer("loyalty_reward"),

    // Snapshot of contact details at booking time (denormalised on purpose so
    // history is preserved even if the member later edits their profile).
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),

    priceCents: integer("price_cents"), // null when covered by membership
    currency: text("currency").default("czk").notNull(),

    // Consents ticked at booking time. Required from every visitor, member or
    // guest, so the gym can show what was agreed to and when. Null on rows
    // created before the checkbox existed and on admin walk-in bookings.
    rulesAcceptedAt: timestamp("rules_accepted_at", { withTimezone: true }),
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),

    // Who created it, for the audit trail ("member" | admin user id).
    createdByAdminId: uuid("created_by_admin_id").references(
      () => profiles.id,
      {
        onDelete: "set null",
      },
    ),
    cancelledAt: timestamp("cancelled_at"),
    cancelReason: text("cancel_reason"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("reservation_starts_at_idx").on(t.startsAt),
    index("reservation_user_idx").on(t.userId),
    index("reservation_order_idx").on(t.orderId),
    index("reservation_user_created_id_idx").on(
      t.userId,
      t.createdAt.desc(),
      t.id.desc(),
    ),
    uniqueIndex("reservation_loyalty_reward_uidx")
      .on(t.userId, t.loyaltyReward)
      .where(
        sql`${t.loyaltyReward} is not null and ${t.status} <> 'cancelled'`,
      ),
    index("reservation_status_idx").on(t.status),
    index("reservation_confirmed_user_starts_idx")
      .on(t.userId, t.startsAt)
      .where(sql`${t.status} = 'confirmed'`),
  ],
);

/** Immutable audit record for the single customer-initiated term change. */
export const reservationReschedule = pgTable(
  "reservation_reschedule",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reservationId: uuid("reservation_id")
      .notNull()
      .references(() => reservation.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    previousStartsAt: timestamp("previous_starts_at", {
      withTimezone: true,
    }).notNull(),
    previousEndsAt: timestamp("previous_ends_at", {
      withTimezone: true,
    }).notNull(),
    newStartsAt: timestamp("new_starts_at", { withTimezone: true }).notNull(),
    newEndsAt: timestamp("new_ends_at", { withTimezone: true }).notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    // VOP 8.1: the audit row itself is also the database-level one-change
    // invariant. A reservation can never receive a second history row.
    uniqueIndex("reservation_reschedule_reservation_uidx").on(t.reservationId),
  ],
);

/**
 * A blocked slot removes a time range from availability without being a
 * booking : maintenance, holidays, private events.
 */
export const blockedSlot = pgTable(
  "blocked_slot",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    reason: blockReason("reason").notNull().default("other"),
    note: text("note"),
    createdByAdminId: uuid("created_by_admin_id").references(
      () => profiles.id,
      {
        onDelete: "set null",
      },
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("blocked_slot_starts_at_idx").on(t.startsAt)],
);

/**
 * Weekly opening hours. One row per day-of-week (0 = Sunday … 6 = Saturday).
 * `openMinute`/`closeMinute` are minutes from midnight in local time. A day
 * with no row (or `isClosed = true`) is treated as closed.
 */
export const openingHours = pgTable("opening_hours", {
  id: uuid("id").defaultRandom().primaryKey(),
  // 0-6, Sunday-based to match JS Date.getDay().
  dayOfWeek: smallint("day_of_week").notNull().unique(),
  openMinute: integer("open_minute").notNull(),
  closeMinute: integer("close_minute").notNull(),
  // Length of a bookable slot in minutes (e.g. 60).
  slotMinutes: integer("slot_minutes").notNull().default(60),
  isClosed: smallint("is_closed").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
