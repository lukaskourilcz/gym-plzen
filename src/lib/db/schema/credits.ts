import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./members";
import { reservation, blockedSlot } from "./reservations";
export const creditAccount = pgTable(
  "credit_account",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => profiles.id, { onDelete: "restrict" })
      .unique(),
    guestEmail: text("guest_email").unique(),
    guestName: text("guest_name"),
    balanceCents: integer("balance_cents").notNull().default(0),
    reservedCents: integer("reserved_cents").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    check(
      "credit_account_balance_check",
      sql`${t.balanceCents} >= ${t.reservedCents} and ${t.reservedCents} >= 0`,
    ),
    check(
      "credit_account_owner_check",
      sql`(${t.userId} is not null)::int + (${t.guestEmail} is not null)::int = 1`,
    ),
  ],
);
export const creditEntry = pgTable(
  "credit_entry",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => creditAccount.id, { onDelete: "restrict" }),
    amountCents: integer("amount_cents").notNull(),
    reason: text("reason").notNull(),
    operationKey: text("operation_key").notNull().unique(),
    reservationId: uuid("reservation_id").references(() => reservation.id, {
      onDelete: "restrict",
    }),
    actorId: uuid("actor_id").references(() => profiles.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("credit_entry_account_created_idx").on(t.accountId, t.createdAt),
    check("credit_entry_nonzero", sql`${t.amountCents} <> 0`),
  ],
);
export const creditHold = pgTable(
  "credit_hold",
  {
    operationKey: text("operation_key").primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => creditAccount.id, { onDelete: "restrict" }),
    amountCents: integer("amount_cents").notNull(),
    status: text("status")
      .$type<"reserved" | "captured" | "released">()
      .notNull()
      .default("reserved"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    check("credit_hold_amount_check", sql`${t.amountCents} >= 0`),
    check(
      "credit_hold_status_check",
      sql`${t.status} in ('reserved','captured','released')`,
    ),
  ],
);
export const reservationChange = pgTable(
  "reservation_change",
  {
    id: uuid("id").primaryKey(),
    reservationId: uuid("reservation_id")
      .notNull()
      .references(() => reservation.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    previousStartsAt: timestamp("previous_starts_at", {
      withTimezone: true,
    }).notNull(),
    previousPriceCents: integer("previous_price_cents").notNull(),
    newPriceCents: integer("new_price_cents").notNull(),
    creditCents: integer("credit_cents").notNull().default(0),
    cashCents: integer("cash_cents").notNull().default(0),
    status: text("status")
      .$type<
        | "awaiting_payment"
        | "applying"
        | "completed"
        | "cancelled"
        | "review_needed"
        | "refund_pending"
        | "refunded"
      >()
      .notNull(),
    blockId: uuid("block_id").references(() => blockedSlot.id, {
      onDelete: "restrict",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    quote: jsonb("quote")
      .$type<{ pricingVersion: number; termsVersion: string }>()
      .notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("reservation_change_status_idx").on(t.status, t.updatedAt),
    uniqueIndex("reservation_change_active_uidx")
      .on(t.reservationId)
      .where(
        sql`${t.status} in ('awaiting_payment','applying','review_needed','refund_pending')`,
      ),
  ],
);
