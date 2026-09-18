import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Shared Postgres enums. Kept in one place so every table references the same
 * canonical set of values and TypeScript unions can be derived from them.
 */

/** A single training session is either a customer booking or an admin block. */
export const reservationStatus = pgEnum("reservation_status", [
  "pending", // created, awaiting payment
  "confirmed", // paid or covered by active membership
  "cancelled", // cancelled by member or admin
  "completed", // training slot has passed and member attended
  "no_show", // slot passed, no unlock recorded
]);

/** Why a slot on the calendar is unavailable when it is not a booking. */
export const blockReason = pgEnum("block_reason", [
  "maintenance",
  "holiday",
  "private_event",
  "other",
]);

/** Payment lifecycle mirrored from Comgate. */
export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "processing",
  "succeeded",
  "failed",
  "refunded",
]);

/** How a member pays for a given reservation. */
export const paymentType = pgEnum("payment_type", [
  "subscription", // covered by an active membership
  "one_off", // single card payment for one session
]);

/** Membership subscription lifecycle mirrored from Comgate. */
export const membershipStatus = pgEnum("membership_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "paused",
]);

/** Channels through which the entry code / notifications are delivered. */
export const messageChannel = pgEnum("message_channel", [
  "email",
  "whatsapp",
  "sms",
]);

/** Delivery lifecycle for an outbound message. */
export const messageStatus = pgEnum("message_status", [
  "queued",
  "sent",
  "delivered",
  "read",
  "failed",
]);

/** Category of an outbound message, for filtering/reporting. */
export const messageKind = pgEnum("message_kind", [
  "access_code",
  "reservation_confirmation",
  "reservation_reminder",
  "reservation_cancellation",
  "marketing",
  "system_alert",
  // Informational e-mail to the operator: a booking arrived, a time moved.
  "operator_notice",
]);

/** Lifecycle of a Nuki access code. */
export const accessCodeStatus = pgEnum("access_code_status", [
  "scheduled", // created, valid window in the future
  "active", // currently within its valid window
  "used", // an unlock has been recorded
  "expired", // window passed
  "revoked", // manually removed
  "failed", // could not be created on the lock
]);

/** Steps of the per-reservation reliability pipeline. */
export const pipelineStep = pgEnum("pipeline_step", [
  "payment", // paid → confirmed
  "code_created", // Nuki code generated
  "code_delivered", // code reached the member on ≥1 channel
]);

/** Outcome of a reliability pipeline step. */
export const pipelineStepStatus = pgEnum("pipeline_step_status", [
  "pending",
  "in_progress",
  "succeeded",
  "failed",
  "retrying",
]);

/** Severity of an operational alert pushed to the WhatsApp group. */
export const alertseverity = pgEnum("alert_severity", [
  "info",
  "warning",
  "critical",
]);

/** Which surface a CMS content block belongs to. */
export const cmsBlockType = pgEnum("cms_block_type", [
  "text",
  "richtext",
  "image",
  "file",
  "json",
]);

/** How a voucher reduces the one-off reservation price. */
export const voucherKind = pgEnum("voucher_kind", [
  "percentage",
  "fixed_amount",
]);

/** A claim is held during Checkout, then either consumed or released. */
export const voucherRedemptionStatus = pgEnum("voucher_redemption_status", [
  "reserved",
  "redeemed",
  "released",
]);

/** Newsletter lifecycle retained for suppression and consent history. */
export const newsletterSubscriptionStatus = pgEnum(
  "newsletter_subscription_status",
  ["subscribed", "unsubscribed"],
);
