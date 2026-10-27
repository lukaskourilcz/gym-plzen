import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { reservation } from "./reservations";
import { profiles } from "./members";

/** Separate purchase; original reservation payment and its document never change. */
export const participantAddition = pgTable(
  "participant_addition",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reservationId: uuid("reservation_id")
      .notNull()
      .references(() => reservation.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    fromCount: integer("from_count").notNull(),
    toCount: integer("to_count").notNull(),
    amountCents: integer("amount_cents").notNull(),
    creditCents: integer("credit_cents").notNull().default(0),
    pricingMode: text("pricing_mode").notNull(),
    status: text("status")
      .$type<"pending" | "confirmed" | "failed" | "review_needed">()
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("participant_addition_user_idx").on(t.userId),
    index("participant_addition_reservation_idx").on(t.reservationId),
    uniqueIndex("participant_addition_pending_uidx")
      .on(t.reservationId)
      .where(sql`${t.status} = 'pending'`),
    check(
      "participant_addition_counts_check",
      sql`${t.fromCount} >= 0 and ${t.toCount} <= 2 and ${t.toCount} > ${t.fromCount}`,
    ),
    check("participant_addition_amount_check", sql`${t.amountCents} >= 0`),
    check(
      "participant_addition_status_check",
      sql`${t.status} in ('pending', 'confirmed', 'failed', 'review_needed')`,
    ),
    check(
      "participant_addition_mode_check",
      sql`${t.pricingMode} in ('flat', 'per_person')`,
    ),
  ],
);
