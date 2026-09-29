import { and, asc, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { systemAlert } from "@/lib/db/schema";
import type { SystemAlert } from "@/lib/db/types";
import { env } from "@/lib/env";
import { logger } from "@/lib/helpers/logger";
import { sendTextMessage } from "@/lib/integrations/whatsapp";
import { notifyAlert } from "./operator-notifications";

/**
 * Operational alerting. Any failure in the reliability pipeline (or an uptime
 * check) records a `systemAlert` and fans it out to the WhatsApp group that
 * contains the operator and the developer.
 *
 * De-duplication: repeated failures with the same `dedupeKey` that are still
 * unresolved are collapsed into the existing row instead of spamming the group.
 */

export type AlertSeverity = SystemAlert["severity"];

export interface RaiseAlertParams {
  severity?: AlertSeverity;
  title: string;
  body?: string;
  dedupeKey?: string;
  context?: Record<string, unknown>;
}

/** Recipients (E.164) parsed from ALERT_WHATSAPP_RECIPIENTS. */
function alertRecipients(): string[] {
  return (env.ALERT_WHATSAPP_RECIPIENTS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Record and dispatch an alert. Returns the persisted alert. Safe to call from
 * anywhere : it never throws (a failure to alert must not break the caller).
 */
export async function raiseAlert(
  params: RaiseAlertParams,
): Promise<SystemAlert | null> {
  try {
    if (params.dedupeKey) {
      const [existing] = await db
        .select()
        .from(systemAlert)
        .where(
          and(
            eq(systemAlert.dedupeKey, params.dedupeKey),
            isNull(systemAlert.resolvedAt),
          ),
        )
        .limit(1);
      if (existing) {
        logger.warn("Duplicate alert suppressed", {
          dedupeKey: params.dedupeKey,
        });
        return existing;
      }
    }

    const [alert] = await db
      .insert(systemAlert)
      .values({
        severity: params.severity ?? "warning",
        title: params.title,
        body: params.body,
        dedupeKey: params.dedupeKey,
        context: params.context,
      })
      .returning();

    if (alert) await deliver(alert);
    return alert ?? null;
  } catch (e) {
    // Last-resort: at least get it into Sentry/console.
    logger.error(e, { where: "alerts.raiseAlert", title: params.title });
    return null;
  }
}

/** A failed operator e-mail stays pending so the watchdog can recover it. */
async function deliver(alert: SystemAlert): Promise<boolean> {
  await dispatchToWhatsApp(alert);
  // The WhatsApp group is one way in; e-mail is the one that works today.
  if (!(await notifyAlert(alert))) return false;
  await db
    .update(systemAlert)
    .set({ notifiedAt: new Date() })
    .where(eq(systemAlert.id, alert.id));
  return true;
}

/**
 * Deliver alerts that were written inside a database transaction (a payment
 * arriving for a booking that is no longer valid is recorded atomically with
 * the payment) and so could not be sent there. Without this they sat in the
 * administration unseen while a customer had paid for nothing. Never throws.
 */
export async function deliverPendingAlerts(limit = 10): Promise<number> {
  try {
    const pending = await db
      .select()
      .from(systemAlert)
      .where(
        and(
          isNull(systemAlert.notifiedAt),
          isNull(systemAlert.resolvedAt),
          gt(systemAlert.createdAt, new Date(Date.now() - 24 * 3_600_000)),
        ),
      )
      .orderBy(asc(systemAlert.createdAt))
      .limit(limit);
    let delivered = 0;
    for (const alert of pending) if (await deliver(alert)) delivered++;
    return delivered;
  } catch (e) {
    logger.error(e, { where: "alerts.deliverPendingAlerts" });
    return 0;
  }
}

/** Close one alert the operator has dealt with. */
export async function resolveAlertById(id: string): Promise<void> {
  await db
    .update(systemAlert)
    .set({ resolvedAt: new Date() })
    .where(and(eq(systemAlert.id, id), isNull(systemAlert.resolvedAt)));
}

/** Mark an alert (by dedupeKey) resolved so future occurrences alert again. */
export async function resolveAlert(dedupeKey: string): Promise<void> {
  await db
    .update(systemAlert)
    .set({ resolvedAt: new Date() })
    .where(
      and(eq(systemAlert.dedupeKey, dedupeKey), isNull(systemAlert.resolvedAt)),
    );
}

async function dispatchToWhatsApp(alert: SystemAlert): Promise<void> {
  const recipients = alertRecipients();
  if (recipients.length === 0) return;

  const emoji =
    alert.severity === "critical"
      ? "🔴"
      : alert.severity === "warning"
        ? "🟠"
        : "🔵";
  const body = `${emoji} ${alert.title}${alert.body ? `\n${alert.body}` : ""}`;

  await Promise.all(recipients.map((to) => sendTextMessage({ to, body })));
}

/** Recent alerts for the admin dashboard. */
export async function listRecentAlerts(limit = 50): Promise<SystemAlert[]> {
  return db
    .select()
    .from(systemAlert)
    .orderBy(desc(systemAlert.createdAt))
    .limit(limit);
}
