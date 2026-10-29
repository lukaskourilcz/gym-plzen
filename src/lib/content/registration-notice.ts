/** Copy is independent for each placement; destinations and loyalty rules stay in the booking flow. */
export type RegistrationNoticePlacement = "calendar" | "checkout";
export interface RegistrationNoticeCopy<T = string> {
  title: T;
  body: T;
  link: T;
  guestNote: T;
}

const defaults: RegistrationNoticeCopy = {
  title: "S účtem máš každý vstup přehledně",
  body: "Zaregistruj se a přihlas ještě před zaplacením. Rezervace vytvořené po přihlášení najdeš ve svém účtu a každý {freeEntryEvery}. vstup máš zdarma. Dřívější rezervace bez přihlášení se k účtu automaticky nepřiřazují.",
  link: "Přihlásit se nebo se zaregistrovat",
  guestNote: "Pokračovat můžeš i bez registrace.",
};

export const REGISTRATION_NOTICE_DEFAULTS = {
  "booking.registration.calendar.title": defaults.title,
  "booking.registration.calendar.body": defaults.body,
  "booking.registration.calendar.link": defaults.link,
  "booking.registration.calendar.guestNote": defaults.guestNote,
  "booking.registration.checkout.title": defaults.title,
  "booking.registration.checkout.body": defaults.body,
  "booking.registration.checkout.link": defaults.link,
  "booking.registration.checkout.guestNote": defaults.guestNote,
} as const;

export function registrationNoticeFields(
  placement: RegistrationNoticePlacement,
) {
  return {
    title: `booking.registration.${placement}.title`,
    body: `booking.registration.${placement}.body`,
    link: `booking.registration.${placement}.link`,
    guestNote: `booking.registration.${placement}.guestNote`,
  } as const;
}

export function registrationNoticeCopy(
  get: (key: keyof typeof REGISTRATION_NOTICE_DEFAULTS) => string,
  placement: RegistrationNoticePlacement,
): RegistrationNoticeCopy {
  const fields = registrationNoticeFields(placement);
  return {
    title: get(fields.title),
    body: get(fields.body),
    link: get(fields.link),
    guestNote: get(fields.guestNote),
  };
}
