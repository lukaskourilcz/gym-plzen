import { rows } from "./setup";
import {
  rescheduleReservation,
  type RescheduleReservationInput,
} from "../../src/lib/services/rescheduling";
import { CREDIT_TERMS_VERSION } from "../../src/lib/config/credits";

/** These suites exercise the access-code/move state machine, not pricing.
 * Seed an explicitly confirmed, zero-difference financial intent in the
 * isolated test database. Pricing/payment end-to-end lives in its own suite.
 */
export async function fundedReschedule(input: RescheduleReservationInput) {
  const [current] = await rows<{
    user_id: string;
    starts_at: Date;
    price_cents: number;
  }>(
    "select user_id, starts_at, price_cents from reservation where id=$1 and user_id=$2",
    [input.reservationId, input.userId],
  );
  if (!current) return rescheduleReservation(input);
  const [active] = await rows<{ id: string }>(
    "select id from reservation_change where reservation_id=$1 and status='applying'",
    [input.reservationId],
  );
  let id = active?.id;
  const now = input.now ?? new Date();
  if (id) {
    await rows(
      "update reservation_change set starts_at=$2, ends_at=$3, created_at=$4 where id=$1",
      [
        id,
        input.startsAt,
        new Date(input.startsAt.getTime() + 60 * 60000),
        now,
      ],
    );
  } else {
    const [created] = await rows<{ id: string }>(
      `insert into reservation_change
      (id,reservation_id,user_id,starts_at,ends_at,previous_starts_at,previous_price_cents,new_price_cents,status,expires_at,quote,created_at)
      values (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$6,'applying',$7,$8::jsonb,$9) returning id`,
      [
        input.reservationId,
        input.userId,
        input.startsAt,
        new Date(input.startsAt.getTime() + 60 * 60000),
        current.starts_at,
        current.price_cents,
        new Date(now.getTime() + 30 * 60000),
        JSON.stringify({
          pricingVersion: 1,
          termsVersion: CREDIT_TERMS_VERSION,
        }),
        now,
      ],
    );
    id = created!.id;
  }
  return rescheduleReservation({ ...input, financialChangeId: id });
}
