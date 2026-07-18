/**
 * Photos for the booking-page carousel (and future gallery use).
 *
 * The current files are PLACEHOLDER visuals (dark studio-style SVG scenes in
 * `public/gym/`) until real photos arrive: drop the real images into
 * `public/gym/` and update the entries below — nothing else needs to change.
 * See NEEDED.md → "Fotografie gymu".
 */

export interface GymPhoto {
  src: string;
  alt: string;
  /** Short label shown over the photo. */
  label: string;
  /** Optional one-line note under the label. */
  note?: string;
}

export const GYM_PHOTOS: GymPhoto[] = [
  {
    src: "/gym/gym-01.svg",
    alt: "Silová zóna s rackem, osou a kotouči",
    label: "Silová zóna",
    note: "rack, osa a kotouče",
  },
  {
    src: "/gym/gym-02.svg",
    alt: "Stojan s řadou jednoruček",
    label: "Jednoručky",
    note: "kompletní řada vah",
  },
  {
    src: "/gym/gym-03.svg",
    alt: "Řada kettlebellů od nejlehčího po nejtěžší",
    label: "Kettlebelly",
    note: "od lehkých po těžké",
  },
  {
    src: "/gym/gym-04.svg",
    alt: "Lavice na bench press se stojanem a osou",
    label: "Bench press",
    note: "lavice a stojan",
  },
  {
    src: "/gym/gym-05.svg",
    alt: "Vstupní dveře s klávesnicí chytrého zámku",
    label: "Vstup na kód",
    note: "chytrý zámek Nuki",
  },
];
