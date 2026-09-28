import {
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
import { bookingOrder, reservation } from "./reservations";

/**
 * Gapless per-year counter behind the document number. A single row per year,
 * incremented with `INSERT … ON CONFLICT DO UPDATE … RETURNING`, so two
 * concurrent payments can never be handed the same number : the increment and
 * the read are one atomic statement.
 */
export const documentCounter = pgTable("document_counter", {
  // e.g. "invoice:2026" : see documentCounterKey() in config/billing.
  key: text("key").primaryKey(),
  value: integer("value").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * A payment document ("doklad o zaplacení", or a tax document when the
 * operator is a VAT payer) issued for one paid reservation.
 *
 * Both parties are stored as snapshots rather than references. A document is a
 * record of what was true when it was issued: if the operator later moves
 * office or the customer renames their account, an already-issued document
 * must not silently change. That is also why the PDF is rendered on demand
 * from these columns instead of being stored as a blob : same input, same
 * document, no storage to keep in sync.
 */
export const invoice = pgTable(
  "invoice",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    number: text("number").notNull(),
    /** Year the sequence belongs to, so the counter can restart cleanly. */
    year: integer("year").notNull(),

    reservationId: uuid("reservation_id")
      .notNull()
      .references(() => reservation.id, { onDelete: "cascade" }),
    // Set for a multi-slot checkout: one document per order. The reservation
    // above is then the order's first slot.
    orderId: uuid("order_id").references(() => bookingOrder.id, {
      onDelete: "restrict",
    }),
    userId: uuid("user_id").references(() => profiles.id, {
      onDelete: "set null",
    }),

    issuedAt: timestamp("issued_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    /** Date of taxable supply: when the customer actually paid. */
    suppliedAt: timestamp("supplied_at", { withTimezone: true }).notNull(),

    totalCents: integer("total_cents").notNull(),
    baseCents: integer("base_cents").notNull(),
    vatCents: integer("vat_cents").notNull(),
    vatRatePercent: integer("vat_rate_percent").notNull().default(0),
    currency: text("currency").notNull().default("czk"),

    /** What was sold, in the customer's language. */
    description: text("description").notNull(),

    customerName: text("customer_name"),
    customerEmail: text("customer_email"),

    /** Frozen BillingProfile of the issuer at issue time. */
    supplier: jsonb("supplier").notNull(),

    /** When the document was last e-mailed, and where to. */
    sentAt: timestamp("sent_at", { withTimezone: true }),
    sentTo: text("sent_to"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("invoice_number_uidx").on(t.number),
    // One document per reservation: re-running fulfillment must not issue a
    // second number for a payment that already has one.
    uniqueIndex("invoice_reservation_uidx").on(t.reservationId),
    uniqueIndex("invoice_order_uidx").on(t.orderId),
    index("invoice_issued_at_idx").on(t.issuedAt),
    index("invoice_user_idx").on(t.userId),
  ],
);
