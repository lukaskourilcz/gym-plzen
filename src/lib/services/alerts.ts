import { INCIDENTS, parseIncident } from "@/lib/config/incidents";
import { withOperationLock } from "./operation-lock";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";
import { db, type DatabaseExecutor } from "@/lib/db";
import { systemAlert } from "@/lib/db/schema";
import type { SystemAlert } from "@/lib/db/types";
import { env } from "@/lib/env";
import { logger } from "@/lib/helpers/logger";
import { sendTextMessage } from "@/lib/integrations/whatsapp";
import { notifyAlert } from "./operator-notifications";
import {
  incidentUpdates,
  type IncidentResolution,
  type IncidentUpdate,
} from "@/lib/config/incident-updates";
import { redactIncidentDetail } from "@/lib/helpers/redaction";

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
    return params.dedupeKey
      ? await withOperationLock(`alert:${params.dedupeKey}`, () =>
          raiseAlertUnlocked(params),
        )
      : await raiseAlertUnlocked(params);
  } catch (error) {
    logger.error(error, { where: "alerts.raiseAlert.lock" });
    return null;
  }
}
async function raiseAlertUnlocked(
  params: RaiseAlertParams,
): Promise<SystemAlert | null> {
  try {
    const incoming = parseIncident(params.context);
    const diagnosis = incoming
      ? `${incoming.attempts ? `Pokus č. ${incoming.attempts}. ` : ""}${INCIDENTS[incoming.code].cause}`
      : null;
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
        const previous = parseIncident(existing.context);
        const severityRank = { info: 0, warning: 1, critical: 2 };
        const escalated =
          Boolean(incoming) &&
          severityRank[params.severity ?? "warning"] >
            severityRank[existing.severity];
        const update: IncidentUpdate = {
          at: new Date().toISOString(),
          kind: "repeated",
          message: diagnosis ?? "Problém byl znovu zachycen.",
        };
        const context = {
          ...(existing.context && typeof existing.context === "object"
            ? existing.context
            : {}),
          ...(incoming ? params.context : {}),
          ...(escalated ? { incidentNotificationStage: params.severity } : {}),
          ...(incoming
            ? {
                incident: {
                  ...incoming,
                  firstSeenAt:
                    previous?.firstSeenAt ?? existing.createdAt.toISOString(),
                  occurrences: (previous?.occurrences ?? 1) + 1,
                  attempts: Math.max(
                    previous?.attempts ?? 0,
                    incoming.attempts,
                  ),
                },
              }
            : {}),
          incidentUpdates: [
            ...incidentUpdates(existing.context).slice(-11),
            update,
          ],
        };
        const [updated] = await db
          .update(systemAlert)
          .set({
            title: incoming ? params.title : existing.title,
            body: incoming ? (params.body ?? existing.body) : existing.body,
            context,
            severity: escalated ? params.severity : existing.severity,
            notifiedAt: escalated ? null : existing.notifiedAt,
          })
          .where(
            and(
              eq(systemAlert.id, existing.id),
              isNull(systemAlert.resolvedAt),
            ),
          )
          .returning();
        if (updated && escalated) await deliver(updated);
        return updated ?? existing;
      }
    }

    const [alert] = await db
      .insert(systemAlert)
      .values({
        severity: params.severity ?? "warning",
        title: params.title,
        body: params.body,
        dedupeKey: params.dedupeKey,
        context: {
          ...params.context,
          incidentUpdates: [
            {
              at: new Date().toISOString(),
              kind: "opened",
              message:
                diagnosis ?? "Systém zaznamenal problém a založil incident.",
            } satisfies IncidentUpdate,
          ],
        },
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
  return withOperationLock(`alert-delivery:${alert.id}`, async () => {
    const [current] = await db
      .select()
      .from(systemAlert)
      .where(eq(systemAlert.id, alert.id))
      .limit(1);
    if (!current || current.resolvedAt) return false;
    if (current.notifiedAt) return true;
    await dispatchToWhatsApp(current);
    if (!(await notifyAlert(current))) return false;
    await db
      .update(systemAlert)
      .set({ notifiedAt: new Date() })
      .where(
        and(
          eq(systemAlert.id, current.id),
          eq(systemAlert.severity, current.severity),
          isNull(systemAlert.resolvedAt),
        ),
      );
    return true;
  });
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
export async function resolveAlertById(id: string, note = ""): Promise<void> {
  await closeAlerts(
    eq(systemAlert.id, id),
    { kind: "manual", message: note.trim() || "Incident uzavřen správcem." },
    db,
  );
}

/** Close the operator's snapshot only; later incidents must remain visible. */
export async function resolveAllOpenAlerts(
  before: Date,
  note = "",
): Promise<void> {
  await closeAlerts(
    lte(systemAlert.createdAt, before),
    {
      kind: "manual",
      message: note.trim() || "Incident uzavřen správcem hromadně.",
    },
    db,
  );
}

/** Mark an alert (by dedupeKey) resolved so future occurrences alert again. */
export async function resolveAlert(
  dedupeKey: string | string[],
  resolution: IncidentResolution,
  executor: DatabaseExecutor = db,
): Promise<void> {
  await closeAlerts(
    typeof dedupeKey === "string"
      ? eq(systemAlert.dedupeKey, dedupeKey)
      : inArray(systemAlert.dedupeKey, dedupeKey),
    resolution,
    executor,
  );
}

async function closeAlerts(
  predicate: SQL,
  resolution: IncidentResolution,
  executor: DatabaseExecutor,
): Promise<void> {
  const now = new Date();
  const update: IncidentUpdate = {
    at: now.toISOString(),
    kind: resolution.kind,
    message: redactIncidentDetail(resolution.message),
  };
  // Append to the current row in the same statement that closes it. Concurrent
  // retries cannot duplicate the closing entry or discard a previous update.
  const root = sql`case when jsonb_typeof(${systemAlert.context}) = 'object'
    then ${systemAlert.context} else '{}'::jsonb end`;
  const history = sql`case when jsonb_typeof(${systemAlert.context}->'incidentUpdates') = 'array'
    then ${systemAlert.context}->'incidentUpdates' else '[]'::jsonb end`;
  await executor
    .update(systemAlert)
    .set({
      resolvedAt: now,
      context: sql`jsonb_set(${root}, '{incidentUpdates}', ${history} || ${JSON.stringify([update])}::jsonb)`,
    })
    .where(and(predicate, isNull(systemAlert.resolvedAt)));
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

/** Keep older open incidents visible when newer incidents have closed. */
export async function dashboardAlerts(closedSince: Date) {
  const [open, recentClosed] = await Promise.all([
    db
      .select({
        alert: systemAlert,
        total: sql<number>`count(*) over ()`.mapWith(Number),
      })
      .from(systemAlert)
      .where(isNull(systemAlert.resolvedAt))
      .orderBy(desc(systemAlert.createdAt), desc(systemAlert.id))
      .limit(4),
    db
      .select()
      .from(systemAlert)
      .where(gt(systemAlert.resolvedAt, closedSince))
      .orderBy(desc(systemAlert.resolvedAt), desc(systemAlert.id))
      .limit(3),
  ]);
  return {
    open: open.map((row) => row.alert),
    openCount: open[0]?.total ?? 0,
    recentClosed,
  };
}
