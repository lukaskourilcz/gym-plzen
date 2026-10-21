/** VOP 8.1 and 8.5: the request must arrive at least 24 hours in advance. */
export const RESCHEDULE_CUTOFF_HOURS = 24;
export const MAX_CUSTOMER_RESCHEDULES = 1;
const RESCHEDULE_CUTOFF_MS = RESCHEDULE_CUTOFF_HOURS * 60 * 60 * 1_000;

export type RescheduleIneligibilityReason =
  "not_confirmed" | "already_changed" | "started" | "inside_cutoff";

export type RescheduleEligibility =
  | { eligible: true; deadline: Date }
  | {
      eligible: false;
      reason: RescheduleIneligibilityReason;
      deadline: Date;
    };

type EligibilityReservation = { status: string; startsAt: Date };

/** Pure rule evaluation shared by the profile UI, page guard, and write path. */
export function getRescheduleEligibility(
  value: EligibilityReservation,
  alreadyRescheduled: boolean,
  now = new Date(),
): RescheduleEligibility {
  const deadline = new Date(value.startsAt.getTime() - RESCHEDULE_CUTOFF_MS);
  if (value.status !== "confirmed") {
    return { eligible: false, reason: "not_confirmed", deadline };
  }
  if (alreadyRescheduled) {
    return { eligible: false, reason: "already_changed", deadline };
  }
  if (value.startsAt.getTime() <= now.getTime()) {
    return { eligible: false, reason: "started", deadline };
  }
  if (now.getTime() > deadline.getTime()) {
    return { eligible: false, reason: "inside_cutoff", deadline };
  }
  return { eligible: true, deadline };
}

export function rescheduleReasonMessage(
  reason: RescheduleIneligibilityReason,
): string {
  switch (reason) {
    case "already_changed":
      return "Tuto rezervaci už jste jednou změnili.";
    case "inside_cutoff":
      return "Termín lze změnit nejpozději 24 hodin před jeho začátkem.";
    case "started":
      return "Probíhající nebo uplynulý termín už nelze změnit.";
    case "not_confirmed":
      return "Změnit lze pouze zaplacenou a potvrzenou rezervaci.";
  }
}
