export const ACCESS_CODE_PREPARE_MINUTES = 24 * 60;
export function accessCodePreparationAt(startsAt: Date): Date {
  return new Date(startsAt.getTime() - ACCESS_CODE_PREPARE_MINUTES * 60_000);
}
export function isAccessCodePreparationDue(
  startsAt: Date,
  now = new Date(),
): boolean {
  return now >= accessCodePreparationAt(startsAt);
}
/** Earliest instant at which a verified reservation PIN may be emailed. */
export const ACCESS_CODE_NOTICE_MINUTES = 60;

export function accessCodeDeliveryAt(startsAt: Date): Date {
  return new Date(startsAt.getTime() - ACCESS_CODE_NOTICE_MINUTES * 60_000);
}

export function isAccessCodeDeliveryDue(
  startsAt: Date,
  now = new Date(),
): boolean {
  return now.getTime() >= accessCodeDeliveryAt(startsAt).getTime();
}

/** Sending a PIN early never grants entry before the reservation starts. */
export function accessCodeValidity(
  startsAt: Date,
  endsAt: Date,
  showerMinutes: number,
) {
  return {
    validFrom: new Date(startsAt),
    validUntil: new Date(endsAt.getTime() + showerMinutes * 60_000),
  };
}
