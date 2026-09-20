/** Earliest instant at which a reservation PIN may be created and emailed. */
export const ACCESS_CODE_NOTICE_MINUTES = 60;

export function accessCodeDeliveryAt(startsAt: Date): Date {
  return new Date(startsAt.getTime() - ACCESS_CODE_NOTICE_MINUTES * 60_000);
}

export function isAccessCodeDeliveryDue(startsAt: Date, now = new Date()): boolean {
  return now.getTime() >= accessCodeDeliveryAt(startsAt).getTime();
}
