import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { reservation } from "./reservations";
import { accessCodeStatus } from "./enums";

/**
 * A time-limited entry code for the Nuki keypad, bound to one reservation.
 * Codes are single-use in spirit and only valid within their window
 * (e.g. 15 min before start → end of the session).
 */
export const accessCode = pgTable(
  "access_code",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reservationId: uuid("reservation_id")
      .notNull()
      .references(() => reservation.id, { onDelete: "cascade" }),

    // The 6-digit code is stored hashed; we never need the plaintext back
    // after delivery. `codeLast2` helps admins eyeball-match support requests.
    codeHash: text("code_hash").notNull(),
    codeLast2: text("code_last2"),

    // Nuki authorization id, so we can revoke the code on the lock later.
    nukiAuthId: text("nuki_auth_id"),

    validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
    validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),

    status: accessCodeStatus("status").notNull().default("scheduled"),
    failureReason: text("failure_reason"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("access_code_reservation_idx").on(t.reservationId),
    index("access_code_status_idx").on(t.status),
  ],
);

/**
 * Entry log — synced from the Nuki lock activity feed. Records who actually
 * unlocked and when, independent of our own code bookkeeping.
 */
export const entryLog = pgTable(
  "entry_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Best-effort links; a raw unlock may not map to a reservation/user.
    reservationId: uuid("reservation_id").references(() => reservation.id, {
      onDelete: "set null",
    }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    accessCodeId: uuid("access_code_id").references(() => accessCode.id, {
      onDelete: "set null",
    }),

    // Raw fields from Nuki's log entry.
    nukiLogId: text("nuki_log_id").unique(),
    nukiName: text("nuki_name"), // authorization name shown on the lock
    action: text("action"), // e.g. "unlock", "unlatch"
    trigger: text("trigger"), // e.g. "keypad", "app"
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("entry_log_occurred_idx").on(t.occurredAt),
    index("entry_log_reservation_idx").on(t.reservationId),
  ],
);
