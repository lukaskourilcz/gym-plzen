import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./members";
import { reservation } from "./reservations";
import { messageChannel, messageKind, messageStatus } from "./enums";

/**
 * A single outbound message on a single channel. One reservation's access code
 * typically produces several rows (one per channel), which lets the admin see
 * at a glance whether the code reached the member by email / WhatsApp / SMS.
 */
export const messageDelivery = pgTable(
  "message_delivery",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    reservationId: uuid("reservation_id").references(() => reservation.id, {
      onDelete: "set null",
    }),

    channel: messageChannel("channel").notNull(),
    kind: messageKind("kind").notNull(),
    status: messageStatus("status").notNull().default("queued"),

    // Destination address/number at send time (denormalised for the audit log).
    recipient: text("recipient").notNull(),

    // Provider message id (Resend id, WhatsApp wamid, GoSMS id) for reconciling
    // delivery-status webhooks back to this row.
    providerMessageId: text("provider_message_id"),
    providerResponse: jsonb("provider_response"),
    failureReason: text("failure_reason"),

    // What this message was about, for messages that must be sent at most
    // once: "reservationConfirmed:<reservation>:<address>". Durable email
    // outboxes retain their key even after an uncertain provider response,
    // so retrying cannot silently create another accepted message.
    dedupeKey: text("dedupe_key"),

    sentAt: timestamp("sent_at"),
    deliveredAt: timestamp("delivered_at"),
    readAt: timestamp("read_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("message_delivery_reservation_idx").on(t.reservationId),
    index("message_delivery_provider_idx").on(t.providerMessageId),
    index("message_delivery_status_idx").on(t.status),
    index("message_delivery_created_idx").on(t.createdAt),
    // Null keys stay distinct in Postgres, so only the messages that carry a
    // key are constrained: the claim is taken by whoever inserts first.
    uniqueIndex("message_delivery_dedupe_uidx").on(t.dedupeKey),
  ],
);

/**
 * Marketing email campaigns sent from the administration. Recipients are
 * resolved at send time against members with `marketingConsent = true`.
 */
export const marketingCampaign = pgTable("marketing_campaign", {
  id: uuid("id").defaultRandom().primaryKey(),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  // "draft" | "scheduled" | "sending" | "sent"
  status: text("status").notNull().default("draft"),
  scheduledFor: timestamp("scheduled_for"),
  sentAt: timestamp("sent_at"),
  createdByAdminId: uuid("created_by_admin_id").references(() => profiles.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Exact sent content. Short-lived, server-only, never used for deduplication. */
export const emailArchive = pgTable(
  "email_archive",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerMessageId: text("provider_message_id").notNull().unique(),
    sender: text("sender").notNull(),
    recipient: text("recipient").notNull(),
    subject: text("subject").notNull(),
    html: text("html").notNull(),
    bodyText: text("body_text"),
    attachmentNames: jsonb("attachment_names")
      .$type<string[]>()
      .notNull()
      .default([]),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("email_archive_sent_at_idx").on(t.sentAt)],
);
