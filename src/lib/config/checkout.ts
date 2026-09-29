/** Comgate's payment session; pending slots remain held while its result is unresolved. */
export const PAYMENT_SESSION_MINUTES = 30;

/** Only holds that never started a gateway attempt are released at this age. */
export const UNSTARTED_HOLD_MINUTES = 32;
