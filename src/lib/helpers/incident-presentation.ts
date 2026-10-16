import { z } from "zod";
import {
  INCIDENTS,
  INCIDENT_PHASES,
  parseIncident,
  type IncidentStep,
  type IncidentCode,
} from "@/lib/config/incidents";
import { redactIncidentDetail } from "./redaction";

type AlertLike = { title: string; body: string | null; context: unknown };
function validId(value: unknown) {
  const id = z.string().uuid().safeParse(value);
  return id.success ? id.data : null;
}
/** Read old records conservatively: history cannot prove a missing contact. */
export function incidentPresentation(alert: AlertLike) {
  const incident = parseIncident(alert.context);
  const root =
    alert.context && typeof alert.context === "object"
      ? (alert.context as Record<string, unknown>)
      : {};
  const reservationId =
    incident?.reservationId ??
    validId(root.reservationId) ??
    validId(alert.title.match(/Rezervace ([a-f0-9-]{36})/i)?.[1]);
  const legacyStep = alert.title.match(
    /krok "(payment|code_created|code_delivered)" selhal/,
  )?.[1] as IncidentStep | undefined;
  const legacyCode: IncidentCode | undefined =
    legacyStep === "code_created"
      ? /Nuki zatím nepotvrdilo/.test(alert.body ?? "")
        ? "code_unconfirmed"
        : "code_preparation_failed"
      : legacyStep
        ? "email_delivery_failed"
        : undefined;
  const description = incident
    ? INCIDENTS[incident.code]
    : legacyCode
      ? INCIDENTS[legacyCode]
      : null;
  return {
    incident,
    reservationId,
    title: description?.title ?? redactIncidentDetail(alert.title),
    cause:
      description?.cause ??
      (alert.body ? redactIncidentDetail(alert.body) : null),
    impact: description?.impact ?? null,
    action: description?.action ?? null,
    phase: incident
      ? INCIDENT_PHASES[incident.step]
      : legacyStep
        ? INCIDENT_PHASES[legacyStep]
        : null,
    legacy: !incident && !!legacyStep,
    technical:
      incident?.technicalDetail ??
      (legacyStep && alert.body ? redactIncidentDetail(alert.body) : null),
    reservationHref: reservationId
      ? `/admin/reservations?id=${reservationId}`
      : null,
    memberHref: incident?.userId ? `/admin/members/${incident.userId}` : null,
    messagesHref: reservationId ? `/admin/messages?q=${reservationId}` : null,
  };
}
