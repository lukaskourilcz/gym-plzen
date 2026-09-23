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
import { reservation } from "./reservations";
import { alertseverity, pipelineStep, pipelineStepStatus } from "./enums";

/**
 * Per-reservation reliability pipeline. Each reservation moves through
 * payment → code_created → code_delivered. A row per (reservation, step) lets
 * the watchdog retry failed steps and lets the admin see exactly where a
 * reservation is stuck.
 */
export const reservationPipeline = pgTable(
  "reservation_pipeline",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reservationId: uuid("reservation_id")
      .notNull()
      .references(() => reservation.id, { onDelete: "cascade" }),
    step: pipelineStep("step").notNull(),
    status: pipelineStepStatus("status").notNull().default("pending"),
    attempts: integer("attempts").default(0).notNull(),
    lastError: text("last_error"),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    // One row per step: `initPipeline` upserts against this, so a payment
    // confirmed twice (webhook and poll) cannot create a second pipeline.
    uniqueIndex("reservation_pipeline_step_uidx").on(t.reservationId, t.step),
    index("reservation_pipeline_reservation_idx").on(t.reservationId),
    index("reservation_pipeline_retry_idx").on(t.nextRetryAt),
  ],
);

/**
 * Operational alerts fanned out to the WhatsApp group. Persisted so the admin
 * has a history and so we can de-duplicate noisy repeated failures.
 */
export const systemAlert = pgTable(
  "system_alert",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    severity: alertseverity("severity").notNull().default("warning"),
    // Stable de-dupe key, e.g. "reservation:<id>:code_delivery".
    dedupeKey: text("dedupe_key"),
    title: text("title").notNull(),
    body: text("body"),
    context: jsonb("context"),
    // When the alert was pushed to the WhatsApp group (null = not yet sent).
    notifiedAt: timestamp("notified_at"),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("system_alert_dedupe_idx").on(t.dedupeKey),
    index("system_alert_created_idx").on(t.createdAt),
  ],
);

/**
 * A generic idempotency ledger for inbound webhooks (Comgate, Nuki, WhatsApp).
 * We record each provider event id once so retried deliveries are no-ops.
 */
export const webhookEvent = pgTable(
  "webhook_event",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: text("provider").notNull(), // "comgate" | "nuki" | "whatsapp"
    eventId: text("event_id").notNull(),
    payload: jsonb("payload"),
    processedAt: timestamp("processed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("webhook_event_provider_event_idx").on(t.provider, t.eventId),
  ],
);

/**
 * The record of important things that happened: a reservation confirmed,
 * cancelled or moved, a payment settled, an administrator's change. It exists
 * so the administration can answer "what happened to this booking, and who did
 * it" without reading application logs. Rows are written by the services that
 * perform the action and never updated.
 */
export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    // Who did it: the customer themselves, an administrator, or the system
    // (a payment notification, the watchdog).
    actorType: text("actor_type")
      .$type<"customer" | "admin" | "system">()
      .notNull(),
    actorId: uuid("actor_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    // Name or e-mail at the time, so the entry still reads the same after a
    // profile changes or when a guest booked without an account.
    actorLabel: text("actor_label"),
    // Stable key such as "reservation.rescheduled"; labels live in the app.
    action: text("action").notNull(),
    // The member the entry concerns, even when an administrator acted.
    memberId: uuid("member_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    reservationId: uuid("reservation_id").references(() => reservation.id, {
      onDelete: "set null",
    }),
    // One Czech sentence for the administration, written when it happened.
    summary: text("summary").notNull(),
    context: jsonb("context"),
  },
  (t) => [
    index("activity_log_occurred_idx").on(t.occurredAt),
    index("activity_log_member_idx").on(t.memberId),
    index("activity_log_reservation_idx").on(t.reservationId),
  ],
);
