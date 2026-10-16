import type { Reservation } from "@/lib/db/types";
import {
  INCIDENTS,
  INCIDENT_PHASES,
  contactIncidentKey,
  isContactFailure,
  type IncidentStep,
  type PipelineFailure,
  type IncidentContext,
} from "@/lib/config/incidents";
import { redactIncidentDetail } from "@/lib/helpers/redaction";
import { formatDateTime } from "@/lib/helpers/format";
import type { RaiseAlertParams } from "./alerts";

/** No PIN, address, token or provider payload is copied into incident metadata. */
export function buildReservationIncident(input: {
  booking: Pick<
    Reservation,
    "id" | "userId" | "contactName" | "startsAt" | "endsAt"
  >;
  step: IncidentStep;
  failure: PipelineFailure;
  attempts: number;
  nextRetryAt: Date | null;
  now?: Date;
}): RaiseAlertParams {
  const now = input.now ?? new Date(),
    { booking, failure, step } = input;
  const description = INCIDENTS[failure.code];
  const incident: IncidentContext = {
    version: 1,
    code: failure.code,
    reservationId: booking.id,
    userId: booking.userId,
    customerName: booking.contactName?.trim().slice(0, 120) || null,
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
    step,
    attempts: input.attempts,
    nextRetryAt: input.nextRetryAt?.toISOString() ?? null,
    technicalDetail: failure.detail
      ? redactIncidentDetail(failure.detail)
      : null,
    firstSeenAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    occurrences: 1,
  };
  return {
    severity:
      booking.startsAt.getTime() - now.getTime() <= 60 * 60_000
        ? "critical"
        : "warning",
    dedupeKey: isContactFailure(failure.code)
      ? contactIncidentKey(booking.id)
      : `reservation:${booking.id}:${step}`,
    title: description.title,
    body: [
      `Termín: ${formatDateTime(booking.startsAt)}. Zákazník: ${incident.customerName ?? "bez uvedeného jména"}.`,
      `Fáze: ${INCIDENT_PHASES[step]}.`,
      description.cause,
      description.impact,
      `Co udělat: ${description.action}`,
      input.attempts ? `Počet pokusů: ${input.attempts}.` : null,
      input.nextRetryAt
        ? `Další automatický pokus: ${formatDateTime(input.nextRetryAt)}.`
        : null,
    ]
      .filter(Boolean)
      .join("\n"),
    context: { reservationId: booking.id, step, incident },
  };
}
