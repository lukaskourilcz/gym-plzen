import {
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./members";
import { blockReason, reservationStatus } from "./enums";

/**
 * A reservation is a single training slot. The gym holds one person at a time,
 * so overlap prevention is the central invariant — enforced in the service
 * layer (see lib/services/reservations.ts) and backed by an exclusion
 * constraint added in a migration (see NEEDED.md / drizzle notes).
 */
export const reservation = pgTable(
  "reservation",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Null for admin-created walk-in bookings without an account.
    userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),

    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),

    status: reservationStatus("status").notNull().default("pending"),

    // Snapshot of contact details at booking time (denormalised on purpose so
    // history is preserved even if the member later edits their profile).
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),

    priceCents: integer("price_cents"), // null when covered by membership
    currency: text("currency").default("czk").notNull(),

    // Who created it, for the audit trail ("member" | admin user id).
    createdByAdminId: uuid("created_by_admin_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    cancelledAt: timestamp("cancelled_at"),
    cancelReason: text("cancel_reason"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("reservation_starts_at_idx").on(t.startsAt),
    index("reservation_user_idx").on(t.userId),
    index("reservation_status_idx").on(t.status),
  ],
);

/**
 * A blocked slot removes a time range from availability without being a
 * booking — maintenance, holidays, private events.
 */
export const blockedSlot = pgTable(
  "blocked_slot",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    reason: blockReason("reason").notNull().default("other"),
    note: text("note"),
    createdByAdminId: uuid("created_by_admin_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
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
