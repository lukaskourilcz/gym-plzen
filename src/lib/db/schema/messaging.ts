import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
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
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
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
  createdByAdminId: text("created_by_admin_id").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
